import crypto from "crypto";
import { getQuestion } from "./question-loader";
import { getCannedResponse } from "./canned-responses";
import { checkSinglePrompt } from "./single-prompt-checker";

// In-memory session and audit storage for runtime / local MVP
const sessions = new Map();
const auditEvents = [];

export function getControlsForState(state) {
  switch (state) {
    case "awaiting_first_attempt":
      return ["answer", "steps", "options", "not_sure", "note"];
    case "active":
      return ["answer", "steps", "options", "not_sure", "show_solution", "note"];
    case "reflection":
      return ["reflection_options", "skip", "note"];
    case "transfer_offered":
      return ["accept", "decline", "note"];
    case "transfer_active":
      return ["answer", "steps", "options", "not_sure", "note"];
    default:
      return [];
  }
}

export function createSession(questionId) {
  const question = getQuestion(questionId || "ratio_share_001");
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    state: "awaiting_first_attempt",
    question_id: question.question_id,
    question_version: question.version || 1,
    hint_level: 0,
    attempt_count: 0,
    turn_number: 1,
    turn_cap: 12,
    input_mode: "keypad",
    flags: [],
    next_target: "final",
    created_at: new Date().toISOString(),
    asked_probe_ids: [],
    attempts: [],
    history: [],
  };

  const initialText = getCannedResponse("level0_prompt");
  const initialSinglePromptCheck = checkSinglePrompt(initialText);

  const initialTutorTurn = {
    turn_number: 1,
    speaker: "tutor",
    kind: "canned",
    text: initialText,
    controls: getControlsForState("awaiting_first_attempt"),
    choices: [],
    hint_level: 0,
    model: "template",
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: null, // single_prompt applies to delivered tutor hints (Levels 1-4), not Level 0
    timestamp: new Date().toISOString(),
  };

  session.history.push(initialTutorTurn);

  sessions.set(sessionId, session);

  // Record audit event for session creation
  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    event_type: "session_created",
    question_id: question.question_id,
    hint_level: 0,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  return buildSessionView(session, question, initialTutorTurn);
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const question = getQuestion(session.question_id);
  const lastTutorHistory = [...session.history].reverse().find((h) => h.speaker === "tutor") || {
    kind: "canned",
    text: getCannedResponse("level0_prompt"),
    controls: getControlsForState(session.state),
    choices: [],
  };

  return buildSessionView(session, question, lastTutorHistory);
}

export function processSessionEvent(sessionId, eventBody) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const question = getQuestion(session.question_id);
  const { event, answer_text, response_duration_ms = 0 } = eventBody;

  // Legality check: "not_sure" and "submit" are valid in awaiting_first_attempt, active, transfer_active
  const validStates = ["awaiting_first_attempt", "active", "transfer_active"];
  if (!validStates.includes(session.state)) {
    throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
  }

  if (event === "not_sure") {
    return handleNotSureEvent(session, question, response_duration_ms);
  } else if (event === "submit") {
    return handleSubmitEvent(session, question, answer_text, response_duration_ms);
  } else {
    throw new Error(`Unsupported event: ${event}`);
  }
}

function handleNotSureEvent(session, question, durationMs) {
  // 1. In awaiting_first_attempt, transition to active
  if (session.state === "awaiting_first_attempt") {
    session.state = "active";
  }

  // 2. Hint level rises by one and NEVER above 4
  const oldLevel = session.hint_level;
  if (session.hint_level < 4) {
    session.hint_level = Math.min(session.hint_level + 1, 4);
  } else {
    session.hint_level = 4;
  }
  const newLevel = session.hint_level;

  // 3. Attempt is stored with response_type=not_sure and counted=false (attempt_count unchanged)
  const attemptRecord = {
    attempt_id: crypto.randomUUID(),
    attempt_number: session.attempt_count, // preserved, NOT incremented
    hint_level: newLevel,
    response_type: "not_sure",
    answer_text: null,
    counted: false,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  };
  session.attempts.push(attemptRecord);

  // 4. Counts toward turn cap
  session.turn_number += 1;

  // 5. Select next unused probe for new level, or canned fallback/encouragement if exhausted
  const availableProbes = (question.scaffold_probes || []).filter(
    (p) => p.min_level <= newLevel && !session.asked_probe_ids.includes(p.probe_id)
  );

  let tutorText = "";
  let turnKind = "probe_template";

  if (availableProbes.length > 0) {
    const selectedProbe = availableProbes[0];
    session.asked_probe_ids.push(selectedProbe.probe_id);
    tutorText = selectedProbe.template;
    turnKind = "probe_template";
    session.next_target = "probe";
  } else {
    // When no unused probe remains: Levels 1-3 use fallback_l{level}; Level 4 uses encouragement
    if (newLevel >= 1 && newLevel <= 3) {
      tutorText = getCannedResponse(`fallback_l${newLevel}`);
      turnKind = "fallback";
    } else {
      tutorText = getCannedResponse("encouragement");
      turnKind = "canned";
    }
    session.next_target = "final";
  }

  const singlePromptResult = checkSinglePrompt(tutorText);

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: turnKind,
    text: tutorText,
    controls: getControlsForState(session.state),
    choices: [],
    hint_level: newLevel,
    model: "template",
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: singlePromptResult.passed,
    timestamp: new Date().toISOString(),
  };

  session.history.push({
    turn_number: session.turn_number,
    speaker: "student",
    event: "not_sure",
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });

  session.history.push(tutorTurn);

  // Record audit event for not_sure escalation
  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: session.id,
    event_type: "not_sure_escalation",
    old_level: oldLevel,
    hint_level: newLevel,
    attempt_number: session.attempt_count,
    duration_ms: durationMs,
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: singlePromptResult.passed,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  return {
    session: getCleanSessionState(session),
    tutor: tutorTurn,
    attempt: attemptRecord,
    audit_event: auditEvent,
    linked_session_id: null,
  };
}

function handleSubmitEvent(session, question, answerText, durationMs) {
  // 1. In awaiting_first_attempt, transition to active
  if (session.state === "awaiting_first_attempt") {
    session.state = "active";
  }

  // 2. Counted attempt
  session.attempt_count += 1;
  session.turn_number += 1;

  const currentAttemptNumber = session.attempt_count;
  const currentHintLevel = session.hint_level;

  const attemptRecord = {
    attempt_id: crypto.randomUUID(),
    attempt_number: currentAttemptNumber,
    hint_level: currentHintLevel,
    response_type: "answer",
    answer_text: answerText,
    counted: true,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  };
  session.attempts.push(attemptRecord);

  // 3. Verifier check
  const canonicalValue = String(question.accepted_answer_spec?.canonical_value || "").trim();
  const cleanedInput = String(answerText || "")
    .trim()
    .replace(/^\$/, "")
    .trim();

  const isCorrect = cleanedInput === canonicalValue;

  let tutorText = "";
  let turnKind = "authored";

  if (isCorrect) {
    session.state = "reflection";
    // Correct answer does NOT raise hint level (Criterion 2)
    tutorText = `Spot on! ${answerText} is the correct answer. Take a moment to reflect on your method.`;
    turnKind = "authored";
    session.next_target = "reflection";
  } else {
    // Incorrect answer: policy escalates hint level by +1 (capped at 4)
    if (session.hint_level < 4) {
      session.hint_level = Math.min(session.hint_level + 1, 4);
    } else {
      session.hint_level = 4;
    }

    // Select content for resulting level:
    // First probe not yet asked in authored order whose min_level <= hint_level.
    // If none remains, canned fallback_l{level} with no model call.
    const availableProbes = (question.scaffold_probes || []).filter(
      (p) => p.min_level <= session.hint_level && !session.asked_probe_ids.includes(p.probe_id)
    );

    if (availableProbes.length > 0) {
      const probe = availableProbes[0];
      session.asked_probe_ids.push(probe.probe_id);
      tutorText = probe.template;
      turnKind = "probe_template";
      session.next_target = "probe";
    } else {
      if (session.hint_level >= 1 && session.hint_level <= 3) {
        tutorText = getCannedResponse(`fallback_l${session.hint_level}`);
        turnKind = "fallback";
      } else {
        tutorText = getCannedResponse("fallback_l4") || getCannedResponse("encouragement");
        turnKind = "fallback";
      }
      session.next_target = "final";
    }
  }

  const singlePromptResult = checkSinglePrompt(tutorText);

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: turnKind,
    text: tutorText,
    controls: getControlsForState(session.state),
    choices: isCorrect && question.reflection ? question.reflection.options : [],
    hint_level: session.hint_level,
    model: "template",
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: singlePromptResult.passed,
    timestamp: new Date().toISOString(),
  };

  session.history.push({
    turn_number: session.turn_number,
    speaker: "student",
    event: "submit",
    answer_text: answerText,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });

  session.history.push(tutorTurn);

  // Record audit event
  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: session.id,
    event_type: "attempt_submitted",
    attempt_number: currentAttemptNumber,
    hint_level: session.hint_level,
    attempt_hint_level: currentHintLevel,
    answer_text: answerText,
    duration_ms: durationMs,
    is_correct: isCorrect,
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: singlePromptResult.passed,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  return {
    session: getCleanSessionState(session),
    tutor: tutorTurn,
    attempt: attemptRecord,
    audit_event: auditEvent,
    is_correct: isCorrect,
    linked_session_id: null,
  };
}

function getCleanSessionState(session) {
  return {
    id: session.id,
    state: session.state,
    question_id: session.question_id,
    question_version: session.question_version,
    hint_level: session.hint_level,
    attempt_count: session.attempt_count,
    turn_number: session.turn_number,
    turn_cap: session.turn_cap,
    input_mode: session.input_mode,
    flags: session.flags,
    next_target: session.next_target,
    attempts: session.attempts,
  };
}

function buildSessionView(session, question, tutorTurn) {
  const questionView = {
    question_id: question.question_id,
    version: question.version || 1,
    title: question.title,
    stem: question.stem,
    answer_type: question.accepted_answer_spec?.type || "numeric",
    unit: question.accepted_answer_spec?.unit || "",
    answer_requires_unit: question.accepted_answer_spec?.answer_requires_unit || false,
    reasoning_options: question.reasoning_options || [],
    has_diagram: question.has_diagram || false,
  };

  return {
    session: getCleanSessionState(session),
    question: questionView,
    tutor: {
      kind: tutorTurn.kind,
      text: tutorTurn.text,
      controls: tutorTurn.controls || getControlsForState(session.state),
      choices: tutorTurn.choices || [],
      hint_level: tutorTurn.hint_level ?? session.hint_level,
      model: tutorTurn.model || "template",
      prompt_version: tutorTurn.prompt_version || "1.0.0",
      policy_version: tutorTurn.policy_version || "1.0.0",
      trace_status: tutorTurn.trace_status || "missing",
      single_prompt: tutorTurn.single_prompt !== undefined ? tutorTurn.single_prompt : checkSinglePrompt(tutorTurn.text).passed,
    },
    linked_session_id: null,
  };
}

export function getAuditEvents(sessionId) {
  if (sessionId) {
    return auditEvents.filter((e) => e.session_id === sessionId);
  }
  return auditEvents;
}
