import crypto from "crypto";
import { getQuestion } from "./question-loader";
import { getCannedResponse } from "./canned-responses";
import { checkSinglePrompt } from "./single-prompt-checker";
import { normalise, scrubPii } from "./normaliser";
import {
  classifyMisconception,
  MISCONCEPTION_TAXONOMY,
  MISCONCEPTION_CONFIDENCE_THRESHOLD,
  TARGETED_SCAFFOLD_PROMPTS,
  NEUTRAL_DIAGNOSTIC_PROBE,
} from "./misconception-classifier";
import { checkSafetyGuard } from "./safety-guard";
import { inputScreen } from "./input-screen";
import { checkCandidateLeakage } from "./leak-checker";

// In-memory session and audit storage for runtime / local MVP
const sessions = new Map();
const auditEvents = [];

export function renderSolutionTurn(question) {
  const steps = (question.solution_steps || []).map((step, idx) => {
    const unitStr = step.unit ? ` ${step.unit}` : "";
    return `Step ${idx + 1}: ${step.description}. ${step.target_expression} = ${step.target_value}${unitStr}.`;
  });
  const canonicalValue = question.accepted_answer_spec?.canonical_value || "";
  const canonicalUnit = question.accepted_answer_spec?.unit ? ` ${question.accepted_answer_spec.unit}` : "";
  const answerLine = `So the answer is ${canonicalValue}${canonicalUnit}.`;
  const transferOffer = getCannedResponse("transfer_offer");
  return `${steps.join(" ")} ${answerLine} ${transferOffer}`;
}

export function renderExampleTurn(question) {
  const example = question.isomorphic_worked_example;
  if (!example) {
    return `${getCannedResponse("fallback_l4")} ${getCannedResponse("support_withheld_notice")}`;
  }
  const steps = (example.solution_steps || []).map((step) => step.description);
  const exampleText = `Example: ${example.stem} ${steps.join(" ")} So the answer is ${example.final_answer}.`;
  const withheldNotice = getCannedResponse("support_withheld_notice");
  return `${exampleText} ${withheldNotice}`;
}

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

export function createSession(questionId, options = {}) {
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
    dialogue_mode: options.dialogue_mode || "template",
    allow_level_5: options.allow_level_5 || false,
    flags: [],
    next_target: "final",
    consecutive_cannot_verify: 0,
    created_at: new Date().toISOString(),
    asked_probe_ids: [],
    attempts: [],
    misconception_events: [],
    notes: [],
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
    prompt_type: null,
    safety_verdict: "allow",
    misconception_code: null,
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
  const { event } = eventBody;

  // A note is valid in ANY state (including terminal or non-terminal)
  if (event === "note") {
    return handleNoteEvent(session, question, eventBody);
  }

  // Handle transfer decisions in transfer_offered
  if (event === "accept" || event === "decline") {
    if (session.state !== "transfer_offered") {
      throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
    }
    return handleTransferDecisionEvent(session, question, eventBody);
  }

  // Handle "show_solution"
  if (event === "show_solution") {
    if (session.state === "transfer_active") {
      throw new Error("transition_not_allowed: show_solution not allowed in transfer_active");
    }
    const validSolutionStates = ["active", "awaiting_first_attempt"];
    if (!validSolutionStates.includes(session.state)) {
      throw new Error(`transition_not_allowed: event show_solution not allowed in state ${session.state}`);
    }
    return handleShowSolutionEvent(session, question, eventBody);
  }

  // Legality check: "not_sure" and "submit" are valid in awaiting_first_attempt, active, transfer_active
  const validStates = ["awaiting_first_attempt", "active", "transfer_active"];
  if (!validStates.includes(session.state)) {
    throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
  }

  if (event === "not_sure") {
    return handleNotSureEvent(session, question, eventBody.response_duration_ms || 0);
  } else if (event === "submit") {
    return handleSubmitEvent(session, question, eventBody);
  } else {
    throw new Error(`Unsupported event: ${event}`);
  }
}

function handleNoteEvent(session, question, eventBody) {
  const { note_text = "" } = eventBody;
  const scrubbedText = scrubPii(note_text);

  // Input Screen check on note
  const screenResult = inputScreen(scrubbedText);
  if (screenResult.hit) {
    if (screenResult.category === "worrying_disclosure" && !session.flags.includes("worrying_disclosure")) {
      session.flags.push("worrying_disclosure");
    }
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "safety_incident",
      category: screenResult.category,
      canned_key: screenResult.canned_key,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: screenResult.text,
      controls: getControlsForState(session.state),
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };

    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      note: null,
      audit_event: auditEvent,
      linked_session_id: null,
    };
  }

  const noteRecord = {
    id: crypto.randomUUID(),
    session_id: session.id,
    state_at_save: session.state,
    body: scrubbedText,
    created_at: new Date().toISOString(),
  };

  if (!session.notes) session.notes = [];
  session.notes.push(noteRecord);

  // Note is NOT a pipeline turn and changes no counter in any non-terminal state
  const noteAckText = getCannedResponse("note_ack");
  const singlePromptResult = checkSinglePrompt(noteAckText);

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: "canned",
    text: noteAckText,
    controls: getControlsForState(session.state),
    choices: [],
    hint_level: session.hint_level,
    model: "template",
    prompt_version: "1.0.0",
    policy_version: "1.0.0",
    trace_status: "missing",
    single_prompt: singlePromptResult.passed,
    timestamp: new Date().toISOString(),
  };

  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: session.id,
    event_type: "note_saved",
    state_at_save: session.state,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  return {
    session: getCleanSessionState(session),
    tutor: tutorTurn,
    note: noteRecord,
    audit_event: auditEvent,
    linked_session_id: null,
  };
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

function handleSubmitEvent(session, question, eventBody) {
  const {
    answer_text,
    step_expressions,
    selected_reasoning_option,
    confidence_rating,
    response_duration_ms = 0,
    simulate_tool_failure = false,
    simulated_classification,
    simulate_unsafe_feedback,
    dialogue_mode,
  } = eventBody;

  if (dialogue_mode) {
    session.dialogue_mode = dialogue_mode;
  }

  // Mutual exclusivity rule: answer_text and step_expressions are mutually exclusive
  if (answer_text && step_expressions && step_expressions.length > 0) {
    throw new Error("invalid_request: answer_text and step_expressions are mutually exclusive");
  }

  // At least one of answer_text, step_expressions, selected_reasoning_option is required
  if (!answer_text && (!step_expressions || step_expressions.length === 0) && !selected_reasoning_option) {
    throw new Error("invalid_request: at least one of answer_text, step_expressions, selected_reasoning_option is required");
  }

  // Input Screen check on answer or step text (Criterion 5)
  const rawInput = answer_text || (step_expressions && step_expressions[0]) || "";
  const screenResult = inputScreen(rawInput);
  if (screenResult.hit) {
    if (screenResult.category === "worrying_disclosure" && !session.flags.includes("worrying_disclosure")) {
      session.flags.push("worrying_disclosure");
    }
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "safety_incident",
      category: screenResult.category,
      canned_key: screenResult.canned_key,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: screenResult.text,
      controls: getControlsForState(session.state),
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };

    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      attempt: null,
      audit_event: auditEvent,
      linked_session_id: null,
    };
  }

  // 1. Tool failure handling (Criterion 7)
  if (simulate_tool_failure) {
    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: session.attempt_count,
      hint_level: session.hint_level,
      response_type: "answer",
      answer_text: answer_text || null,
      step_expressions: step_expressions || null,
      selected_reasoning_option: selected_reasoning_option || null,
      confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
      counted: false,
      status: "cannot_verify",
      state: "tool_failure",
      duration_ms: response_duration_ms,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const tutorText = getCannedResponse("tool_failure_notice");
    const singlePromptResult = checkSinglePrompt(tutorText);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: tutorText,
      controls: getControlsForState(session.state),
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: singlePromptResult.passed,
      timestamp: new Date().toISOString(),
    };

    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "tool_failure",
      status: "cannot_verify",
      state: "tool_failure",
      duration_ms: response_duration_ms,
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

  // 2. Option-only submission (Criterion 1)
  if (selected_reasoning_option && !answer_text && (!step_expressions || step_expressions.length === 0)) {
    if (session.state === "awaiting_first_attempt") {
      session.state = "active";
    }

    session.turn_number += 1;

    const optionMeta = (question.reasoning_options || []).find((opt) => opt.option_id === selected_reasoning_option);
    let tutorText = "";
    let turnKind = "authored";

    // Map option to misconception hint or solution step
    if (selected_reasoning_option === "opt_diff") {
      tutorText = "Dividing $60 by 3 assumes 3 equal parts in total. Think about how many parts Leo and Maya have together.";
      turnKind = "probe_template";
    } else if (selected_reasoning_option === "opt_parts") {
      tutorText = "Finding the value of 1 part is a great method! How many total parts make up the ratio 2 : 3?";
      turnKind = "probe_template";
    } else {
      tutorText = `You selected: "${optionMeta?.label || selected_reasoning_option}". What is your next calculation?`;
      turnKind = "authored";
    }

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: session.attempt_count,
      hint_level: session.hint_level,
      response_type: "reasoning_option",
      response_target: null, // forbidden/stored null for option-only submit per SPEC §3.2
      selected_reasoning_option: selected_reasoning_option,
      confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
      counted: false,
      duration_ms: response_duration_ms,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const singlePromptResult = checkSinglePrompt(tutorText);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: turnKind,
      text: tutorText,
      controls: getControlsForState(session.state),
      choices: [],
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
      selected_reasoning_option: selected_reasoning_option,
      duration_ms: response_duration_ms,
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);

    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "reasoning_option_selected",
      selected_reasoning_option: selected_reasoning_option,
      duration_ms: response_duration_ms,
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

  // 3. Step expression submission (Criterion 2)
  if (step_expressions && step_expressions.length > 0) {
    if (session.state === "awaiting_first_attempt") {
      session.state = "active";
    }

    const stepRaw = String(step_expressions[0] || "").trim();
    const stepNorm = normalise(stepRaw, "step");

    let matchedStep = null;
    for (const step of question.solution_steps || []) {
      if (step.target_expression) {
        const targetNorm = normalise(step.target_expression, "step");
        if (
          stepNorm.canonical_expression === targetNorm.canonical_expression ||
          stepNorm.canonical_value === step.target_value ||
          stepRaw === step.target_expression
        ) {
          matchedStep = step;
          break;
        }
      }
    }

    if (matchedStep) {
      session.attempt_count += 1;
      session.turn_number += 1;
      session.consecutive_cannot_verify = 0;

      const attemptRecord = {
        attempt_id: crypto.randomUUID(),
        attempt_number: session.attempt_count,
        hint_level: session.hint_level,
        response_type: "step",
        response_target: "step",
        step_expressions: [stepRaw],
        selected_reasoning_option: selected_reasoning_option || null,
        confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
        counted: true,
        duration_ms: response_duration_ms,
        created_at: new Date().toISOString(),
      };
      session.attempts.push(attemptRecord);

      const tutorText = `Good work on step: ${matchedStep.description}! What is your next calculation?`;
      const singlePromptResult = checkSinglePrompt(tutorText);

      const tutorTurn = {
        turn_number: session.turn_number,
        speaker: "tutor",
        kind: "authored",
        text: tutorText,
        controls: getControlsForState(session.state),
        choices: [],
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
        step_expressions: [stepRaw],
        duration_ms: response_duration_ms,
        timestamp: new Date().toISOString(),
      });
      session.history.push(tutorTurn);

      const auditEvent = {
        event_id: crypto.randomUUID(),
        session_id: session.id,
        event_type: "step_submitted",
        step_id: matchedStep.step_id,
        duration_ms: response_duration_ms,
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
    } else {
      // Row 5b: parsed expression matching no step
      // Returns cannot_verify with state=ok; pipeline turn, counted=false, consecutive_cannot_verify UNCHANGED
      session.turn_number += 1;

      const attemptRecord = {
        attempt_id: crypto.randomUUID(),
        attempt_number: session.attempt_count,
        hint_level: session.hint_level,
        response_type: "step",
        response_target: "step",
        step_expressions: [stepRaw],
        selected_reasoning_option: selected_reasoning_option || null,
        confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
        counted: false,
        status: "cannot_verify",
        state: "ok",
        duration_ms: response_duration_ms,
        created_at: new Date().toISOString(),
      };
      session.attempts.push(attemptRecord);

      const tutorText = getCannedResponse("enter_the_number");
      const singlePromptResult = checkSinglePrompt(tutorText);

      const tutorTurn = {
        turn_number: session.turn_number,
        speaker: "tutor",
        kind: "canned",
        text: tutorText,
        controls: getControlsForState(session.state),
        choices: [],
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
        step_expressions: [stepRaw],
        duration_ms: response_duration_ms,
        timestamp: new Date().toISOString(),
      });
      session.history.push(tutorTurn);

      const auditEvent = {
        event_id: crypto.randomUUID(),
        session_id: session.id,
        event_type: "step_unmatched",
        step_expressions: [stepRaw],
        duration_ms: response_duration_ms,
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
  }

  // 4. Regular answer_text submission (Criteria 2, 4, 5, 6)
  const norm = normalise(answer_text, "answer");

  // Handle parse failures (Criteria 5 and 6)
  if (norm.parse_issue === "comma_ambiguous" || norm.parse_issue === "unparsed") {
    session.consecutive_cannot_verify = (session.consecutive_cannot_verify || 0) + 1;

    let tutorText = "";
    let turnKind = "canned";

    if (session.consecutive_cannot_verify === 1) {
      // First occurrence: ask for rephrase, not a pipeline turn, counters unchanged
      if (norm.parse_issue === "comma_ambiguous") {
        tutorText = getCannedResponse("use_dot_for_decimals");
      } else {
        tutorText = getCannedResponse("rephrase_request");
      }
    } else {
      // Second in a row: switch to structured mode, add ambiguity_review flag
      session.input_mode = "structured";
      if (!session.flags.includes("ambiguity_review")) {
        session.flags.push("ambiguity_review");
      }
      tutorText = getCannedResponse("structured_mode_notice");
      session.turn_number += 1;
    }

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: session.attempt_count,
      hint_level: session.hint_level,
      response_type: "final_answer",
      response_target: "final",
      answer_text: answer_text,
      selected_reasoning_option: selected_reasoning_option || null,
      confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
      counted: false,
      status: "cannot_verify",
      state: "ok",
      parse_issue: norm.parse_issue,
      duration_ms: response_duration_ms,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const singlePromptResult = checkSinglePrompt(tutorText);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: turnKind,
      text: tutorText,
      controls: getControlsForState(session.state),
      choices: [],
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
      answer_text: answer_text,
      duration_ms: response_duration_ms,
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);

    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "unparsed_submission",
      parse_issue: norm.parse_issue,
      consecutive_cannot_verify: session.consecutive_cannot_verify,
      duration_ms: response_duration_ms,
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

  // Valid parsed answer resets consecutive_cannot_verify
  session.consecutive_cannot_verify = 0;

  if (session.state === "awaiting_first_attempt") {
    session.state = "active";
  }

  session.attempt_count += 1;
  session.turn_number += 1;

  const currentAttemptNumber = session.attempt_count;
  const currentHintLevel = session.hint_level;

  const canonicalValue = String(question.accepted_answer_spec?.canonical_value || "").trim();
  const cleanedInput = String(norm.canonical_value || answer_text || "")
    .trim()
    .replace(/^\$/, "")
    .trim();

  const isCorrect = cleanedInput === canonicalValue;

  let tutorText = "";
  let turnKind = "authored";
  let promptType = null;
  let classificationResult = null;
  let misconceptionEvent = null;
  const isLlmMode = session.dialogue_mode === "llm" || !!simulated_classification;

  if (isCorrect) {
    session.state = "reflection";
    tutorText = `Spot on! ${answer_text} is the correct answer. Take a moment to reflect on your method.`;
    turnKind = "authored";
    session.next_target = "reflection";
  } else {
    // Incorrect answer: policy escalates hint level by +1 (capped at 4)
    if (session.hint_level < 4) {
      session.hint_level = Math.min(session.hint_level + 1, 4);
    } else {
      session.hint_level = 4;
    }

    if (isLlmMode) {
      // Run Misconception Classifier (Criterion 1, 2, 4)
      classificationResult = classifyMisconception({
        question,
        answer_text: cleanedInput,
        canonical_value: canonicalValue,
        simulated_classification,
      });

      // Persist misconception_event (SPEC §2.3, Criterion 4)
      misconceptionEvent = {
        id: crypto.randomUUID(),
        session_id: session.id,
        turn_id: session.turn_number,
        student_id: session.student_id || "student_default",
        skill_id: question.skill_id,
        code: classificationResult.code,
        confidence: classificationResult.confidence,
        source: classificationResult.source || "classifier",
        evidence: classificationResult.evidence,
        alternative_labels: classificationResult.alternative_labels || [],
        cited_exemplar_ids: classificationResult.cited_exemplar_ids || [],
        recommended_prompt_type: classificationResult.recommended_prompt_type,
        reviewer_status: "unreviewed", // Starts unreviewed, visible to teachers only
        created_at: new Date().toISOString(),
      };
      if (!session.misconception_events) session.misconception_events = [];
      session.misconception_events.push(misconceptionEvent);

      promptType = classificationResult.recommended_prompt_type;

      // Criterion 1: Targeted scaffold when confidence >= threshold without naming the label
      if (promptType === "targeted_scaffold") {
        tutorText =
          TARGETED_SCAFFOLD_PROMPTS[classificationResult.code] ||
          TARGETED_SCAFFOLD_PROMPTS.unit_rate_error;
        turnKind = "targeted_scaffold";
        session.next_target = "probe";
      } else {
        // Criterion 2: Diagnostic probe (neutral question) when confidence < threshold
        promptType = "diagnostic_probe";
        tutorText = NEUTRAL_DIAGNOSTIC_PROBE;
        turnKind = "diagnostic_probe";
        session.next_target = "probe";
      }
    } else {
      // Template mode default: probe_template or fallback_l{level}
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
  }

  // Student values marked correct this attempt or earlier
  const verifiedStudentValues = isCorrect ? [cleanedInput] : [];
  for (const att of session.attempts) {
    if (att.status === "partially_correct" || att.response_type === "step") {
      if (att.step_expressions) verifiedStudentValues.push(...att.step_expressions);
    }
  }

  // Produced probe values
  const producedProbeValues = [];
  for (const probeId of session.asked_probe_ids) {
    const p = (question.scaffold_probes || []).find((pr) => pr.probe_id === probeId);
    if (p && p.expected_value) producedProbeValues.push(p.expected_value);
  }

  const selectedProbeTemplate = (question.scaffold_probes || []).find(
    (p) => session.asked_probe_ids.includes(p.probe_id)
  )?.template || "";

  // Candidate turn check (AG-09, SPEC WF-09): candidate checks run on model / simulated candidates
  const isCandidateTurn =
    isLlmMode ||
    !!eventBody.simulate_candidate ||
    !!eventBody.simulate_guard_allow_leaked_candidate ||
    !!simulate_unsafe_feedback;

  let safetyVerdict = "allow";

  if (isCandidateTurn) {
    let candidateText = tutorText;
    if (simulate_unsafe_feedback) {
      candidateText = "You are stupid and behind other students who did this smart!";
    }
    if (eventBody.simulate_candidate) {
      candidateText = eventBody.simulate_candidate;
    }
    if (eventBody.simulate_guard_allow_leaked_candidate) {
      candidateText = eventBody.simulate_guard_allow_leaked_candidate;
    }

    // 1. Safety Guard check on tutor candidate
    const forbiddenStrings = session.hint_level < 5 ? [canonicalValue, `$${canonicalValue}`] : [];
    let safetyResult = checkSafetyGuard(candidateText, {
      hint_level: session.hint_level,
      forbidden_strings: forbiddenStrings,
    });

    if (eventBody.simulate_guard_allow_leaked_candidate) {
      // Simulate Guard erroneously returning allow on leaked candidate
      safetyResult = { verdict: "allow" };
    }

    // 2. Deterministic leakage check on candidate (AG-09, Criterion 6)
    const leakCheck = checkCandidateLeakage(candidateText, {
      hint_level: session.hint_level,
      question,
      selected_probe_template: selectedProbeTemplate,
      verified_student_values: verifiedStudentValues,
      produced_probe_values: producedProbeValues,
    });

    // Criterion 10: Deterministic hit overrides guard "allow"
    if (!leakCheck.passed) {
      safetyVerdict = "block";
    } else {
      safetyVerdict = safetyResult.verdict;
    }

    if (safetyVerdict !== "allow") {
      tutorText = getCannedResponse(`fallback_l${session.hint_level}`) || getCannedResponse("encouragement");
      turnKind = "fallback";
    } else {
      tutorText = candidateText;
    }
  } else {
    safetyVerdict = "allow";
  }

  const singlePromptResult = checkSinglePrompt(tutorText);

  const attemptRecord = {
    attempt_id: crypto.randomUUID(),
    attempt_number: currentAttemptNumber,
    hint_level: currentHintLevel,
    response_type: "final_answer",
    response_target: "final",
    answer_text: answer_text,
    selected_reasoning_option: selected_reasoning_option || null,
    confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
    counted: true,
    duration_ms: response_duration_ms,
    misconception_code: !isCorrect && classificationResult ? classificationResult.code : null,
    prompt_type: !isCorrect ? promptType : null,
    reviewer_status: !isCorrect && classificationResult ? "unreviewed" : null,
    created_at: new Date().toISOString(),
  };
  session.attempts.push(attemptRecord);

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: turnKind,
    text: tutorText,
    controls: getControlsForState(session.state),
    choices: isCorrect && question.reflection ? question.reflection.options : [],
    hint_level: session.hint_level,
    model: !isCorrect && isLlmMode ? "classifier" : "template",
    prompt_type: !isCorrect ? promptType : null,
    safety_verdict: safetyVerdict,
    misconception_code: !isCorrect && classificationResult ? classificationResult.code : null,
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
    answer_text: answer_text,
    duration_ms: response_duration_ms,
    timestamp: new Date().toISOString(),
  });

  session.history.push(tutorTurn);

  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: session.id,
    event_type: "attempt_submitted",
    attempt_number: currentAttemptNumber,
    hint_level: session.hint_level,
    attempt_hint_level: currentHintLevel,
    answer_text: answer_text,
    selected_reasoning_option: selected_reasoning_option || null,
    confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
    duration_ms: response_duration_ms,
    is_correct: isCorrect,
    misconception_code: !isCorrect && classificationResult ? classificationResult.code : null,
    prompt_type: !isCorrect ? promptType : null,
    safety_verdict: safetyVerdict,
    reviewer_status: !isCorrect && classificationResult ? "unreviewed" : null,
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
    misconception_event: misconceptionEvent,
    audit_event: auditEvent,
    is_correct: isCorrect,
    linked_session_id: null,
  };
}

function handleShowSolutionEvent(session, question, eventBody) {
  const durationMs = eventBody.response_duration_ms || 0;
  if (eventBody.allow_level_5 !== undefined) {
    session.allow_level_5 = !!eventBody.allow_level_5;
  }
  const allowLevel5 = session.allow_level_5 === true;

  // Counted substantive attempts (counted === true). Note: "not_sure" has counted === false
  const countedAttempts = session.attempt_count;

  // The 4 Level 5 conditions:
  // (a) level is 4
  // (b) attempt_count >= 3 counted attempts
  // (c) student pressed "Show me the solution"
  // (d) allow_level_5 is true
  const isLevel4 = session.hint_level === 4;
  const hasMinAttempts = countedAttempts >= 3;

  session.turn_number += 1;

  if (isLevel4 && hasMinAttempts && allowLevel5) {
    // Criterion 2 & 7: All 4 conditions met -> Level 5 solution turn
    session.hint_level = 5;
    session.state = "transfer_offered";
    session.next_target = "transfer";

    const tutorText = renderSolutionTurn(question);
    const turnKind = "solution";

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: countedAttempts,
      hint_level: 5,
      response_type: "show_solution",
      answer_text: null,
      counted: false,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: turnKind,
      text: tutorText,
      controls: getControlsForState("transfer_offered"),
      choices: [],
      hint_level: 5,
      model: "template",
      prompt_type: null,
      safety_verdict: "allow",
      misconception_code: null,
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };

    session.history.push({
      turn_number: session.turn_number,
      speaker: "student",
      event: "show_solution",
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);

    // Criterion 4: Audit row records hint_level, attempt_count, and policy_version
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "solution_revealed",
      hint_level: 5,
      attempt_count: countedAttempts,
      policy_version: "1.0.0",
      duration_ms: durationMs,
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
  } else if (isLevel4 && hasMinAttempts && !allowLevel5) {
    // Criterion 3 & 8: (a)-(c) true, but allow_level_5 is false
    // Tutor provides isomorphic example + support_withheld_notice (kind=authored),
    // records support_withheld, state stays active, item answer not shown
    if (!session.flags.includes("support_withheld")) {
      session.flags.push("support_withheld");
    }

    const tutorText = renderExampleTurn(question);
    const turnKind = "authored";

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: countedAttempts,
      hint_level: session.hint_level,
      response_type: "show_solution",
      answer_text: null,
      counted: false,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: turnKind,
      text: tutorText,
      controls: getControlsForState(session.state),
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_type: null,
      safety_verdict: "allow",
      misconception_code: null,
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };

    session.history.push({
      turn_number: session.turn_number,
      speaker: "student",
      event: "show_solution",
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);

    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "support_withheld",
      support_withheld: true,
      hint_level: session.hint_level,
      attempt_count: countedAttempts,
      policy_version: "1.0.0",
      duration_ms: durationMs,
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
  } else {
    // Criterion 1 & 9: Any other condition unmet
    // Level is UNCHANGED. Next unused probe at current level, or canned encouragement if none left.
    // Request is audited.
    const availableProbes = (question.scaffold_probes || []).filter(
      (p) => p.min_level <= session.hint_level && !session.asked_probe_ids.includes(p.probe_id)
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
      tutorText = getCannedResponse("encouragement");
      turnKind = "canned";
      session.next_target = "final";
    }

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: countedAttempts,
      hint_level: session.hint_level,
      response_type: "show_solution",
      answer_text: null,
      counted: false,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: turnKind,
      text: tutorText,
      controls: getControlsForState(session.state),
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_type: null,
      safety_verdict: "allow",
      misconception_code: null,
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: checkSinglePrompt(tutorText).passed,
      timestamp: new Date().toISOString(),
    };

    session.history.push({
      turn_number: session.turn_number,
      speaker: "student",
      event: "show_solution",
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);

    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "solution_request_denied",
      hint_level: session.hint_level,
      attempt_count: countedAttempts,
      reason: !isLevel4 ? "level_below_4" : !hasMinAttempts ? "attempts_below_3" : "conditions_unmet",
      policy_version: "1.0.0",
      duration_ms: durationMs,
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
}

function handleTransferDecisionEvent(session, question, eventBody) {
  const { event } = eventBody;
  if (event === "accept") {
    // Moves to transfer_active
    session.state = "transfer_active";
    session.hint_level = 0;
    session.attempt_count = 0;
    session.turn_number += 1;
    const initialText = getCannedResponse("level0_prompt");
    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: initialText,
      controls: getControlsForState("transfer_active"),
      choices: [],
      hint_level: 0,
      model: "template",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };
    session.history.push({
      turn_number: session.turn_number,
      speaker: "student",
      event: "accept_transfer",
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "transfer_accepted",
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      audit_event: auditEvent,
      linked_session_id: null,
    };
  } else if (event === "decline") {
    session.state = "declined";
    session.turn_number += 1;
    const declineText = getCannedResponse("transfer_declined_ack");
    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: declineText,
      controls: [],
      choices: [],
      hint_level: session.hint_level,
      model: "template",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };
    session.history.push({
      turn_number: session.turn_number,
      speaker: "student",
      event: "decline_transfer",
      timestamp: new Date().toISOString(),
    });
    session.history.push(tutorTurn);
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "transfer_declined",
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      audit_event: auditEvent,
      linked_session_id: null,
    };
  }
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
    input_mode: session.input_mode || "keypad",
    dialogue_mode: session.dialogue_mode || "template",
    allow_level_5: session.allow_level_5 || false,
    flags: session.flags || [],
    next_target: session.next_target,
    consecutive_cannot_verify: session.consecutive_cannot_verify || 0,
    attempts: session.attempts,
    misconception_events: session.misconception_events || [],
    notes: session.notes || [],
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
      prompt_type: tutorTurn.prompt_type || null,
      safety_verdict: tutorTurn.safety_verdict || "allow",
      misconception_code: tutorTurn.misconception_code || null,
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
