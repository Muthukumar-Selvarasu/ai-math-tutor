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
import { selectTransferPartner } from "./transfer-selector";
import { recommendNextQuestion } from "./practice-planner";
import {
  updateLearnerModel,
  runLearnerRollup,
  buildStudentDashboard,
  validateDashboardLanguage,
  resetLearnerStore,
} from "./learner-model";
import { getDiagramAsset, validateDiagram } from "./diagram-service";
import {
  StudentStateEstimator,
  deriveTone,
  validateStudentState,
} from "./student-state-estimator";
import {
  MathVerifierAgent,
  verifyExpression,
  applyOverlay,
  clearVerifierCache,
  getVerifierCache,
  simplifyRatio,
  areRatiosEquivalent,
  isRatioSwapped,
  validatePureResultSchema,
} from "./math-verifier";

// In-memory session and audit storage for runtime / local MVP
const sessions = new Map();
const auditEvents = [];
const idempotencyStore = new Map();

function computeAndApplyStudentState(session, currentAttempt = null) {
  const priorAttempts = session.attempts || [];
  const studentState = StudentStateEstimator.estimate({
    priorAttempts,
    currentAttempt,
  });
  const tone = deriveTone(studentState);
  session.student_state = studentState;
  session.tone = tone;
  return { studentState, tone };
}

export function generateSessionSummary(session) {
  const verifierOutcomes = (session.attempts || []).map((att) => {
    if (att.response_type === "not_sure") {
      return {
        attempt_number: att.attempt_number,
        status: "not_sure",
        hint_level: att.hint_level,
        counted: false,
      };
    }
    return {
      attempt_number: att.attempt_number,
      status: att.verifier_outcome?.status_post_overlay || att.verifier_outcome?.status || att.status || "unverified",
      progress: att.verifier_outcome?.progress || null,
      hint_level: att.hint_level,
      counted: Boolean(att.counted),
    };
  });

  const hintLevels = (session.history || [])
    .map((h) => h.hint_level)
    .filter((l) => l !== undefined && l !== null);

  return {
    session_id: session.id,
    question_id: session.question_id,
    state: session.state,
    end_reason: session.end_reason || null,
    total_attempts: session.attempt_count,
    turn_number: session.turn_number,
    pipeline_turns: session.pipeline_turns || 0,
    hint_levels: hintLevels.length > 0 ? hintLevels : [session.hint_level],
    distinct_hint_levels: Array.from(new Set(hintLevels.length > 0 ? hintLevels : [session.hint_level])),
    final_hint_level: session.hint_level,
    verifier_outcomes: verifierOutcomes,
    transfer_result: session.transfer_outcome || null,
    flags: session.flags ? [...session.flags] : [],
    created_at: session.created_at,
    ended_at: session.ended_at || new Date().toISOString(),
  };
}

export function checkAndApplyInactivity(session, simulatedMinutes = 0) {
  if (!session) return;
  const terminalStates = ["completed", "declined", "stuck", "abandoned"];
  if (terminalStates.includes(session.state)) return;

  const now = Date.now();
  const lastActive = session.last_activity_at
    ? new Date(session.last_activity_at).getTime()
    : new Date(session.created_at || now).getTime();
  const elapsedMinutes = (now - lastActive) / (60 * 1000) + (simulatedMinutes || 0);

  if (elapsedMinutes >= 30) {
    session.state = "abandoned";
    session.end_reason = "abandoned";
    session.ended_at = new Date(lastActive + 30 * 60 * 1000).toISOString();
    if (session.state === "transfer_active" || session.linked_session_id) {
      session.transfer_outcome = "skipped";
      if (session.linked_session_id) {
        const orig = sessions.get(session.linked_session_id);
        if (orig) {
          orig.transfer_outcome = "skipped";
          if (orig.summary) orig.summary.transfer_result = "skipped";
        }
      }
    }
    session.summary = generateSessionSummary(session);
    auditEvents.push({
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "session_abandoned",
      end_reason: "abandoned",
      timestamp: new Date().toISOString(),
    });
  }
}

export function setSessionLastActivity(sessionId, timestamp) {
  const session = sessions.get(sessionId);
  if (session) {
    session.last_activity_at = timestamp;
  }
}

export function setSessionTurnCap(sessionId, cap) {
  const session = sessions.get(sessionId);
  if (session) {
    session.turn_cap = cap;
  }
}

export function getIdempotencyRecord(key) {
  return idempotencyStore.get(key) || null;
}

export function saveIdempotencyRecord(key, record) {
  idempotencyStore.set(key, record);
}

export function deleteIdempotencyRecord(key) {
  idempotencyStore.delete(key);
}

export function clearIdempotencyStore() {
  idempotencyStore.clear();
}

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
    case "completed":
    case "declined":
    case "stuck":
    case "abandoned":
      return ["summary", "next_question", "note"];
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
    student_id: options.student_id || "student_default",
    state: "awaiting_first_attempt",
    question_id: question.question_id,
    question_version: question.version || 1,
    hint_level: 0,
    attempt_count: 0,
    mastery_estimate: 0.0,
    turn_number: 1,
    turn_cap: options.turn_cap || 12,
    pipeline_turns: 0,
    last_activity_at: new Date().toISOString(),
    ended_at: null,
    summary: null,
    offered_next_question_id: null,
    recommended_next_question: null,
    input_mode: "keypad",
    dialogue_mode: options.dialogue_mode || "template",
    allow_level_5: options.allow_level_5 || false,
    flags: [],
    next_target: "final",
    active_probe_id: null,
    matched_step_ids: [],
    consecutive_cannot_verify: 0,
    created_at: new Date().toISOString(),
    asked_probe_ids: [],
    attempts: [],
    misconception_events: [],
    notes: [],
    history: [],
    linked_session_id: null,
    mastery_confidence: 0.0,
    transfer_outcome: null,
    end_reason: null,
    offered_transfer_question_id: null,
    recommended: Boolean(options.recommended),
    recommendation: options.recommendation_meta || null,
  };

  const initialStudentState = StudentStateEstimator.estimate({ priorAttempts: [] });
  const initialTone = deriveTone(initialStudentState);
  session.student_state = initialStudentState;
  session.tone = initialTone;

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
    student_state: initialStudentState,
    tone: initialTone,
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

  // Availability check for diagram (SPEC WF-13, FR-09)
  if (question.has_diagram && question.diagram_id) {
    const diagAsset = getDiagramAsset(question.diagram_id) || question.diagram;
    if (!diagAsset || diagAsset.approval_status !== "approved") {
      question.is_withheld = true;
      question.withheld_reason = "no_approved_variant";
      session.flags.push("diagram_unapproved");
      initialTutorTurn.text = "This question has been withheld because its visual diagram is unapproved or missing.";
    } else {
      const minLevel = diagAsset.min_level || 3;
      const initialValidation = validateDiagram(diagAsset, question, minLevel, session.allow_level_5);
      if (!initialValidation.valid) {
        question.is_withheld = true;
        question.withheld_reason = initialValidation.reason || "diagram_validation_failed";
        session.flags.push("diagram_validation_failed");
        initialTutorTurn.text = "This question has been withheld because its visual diagram failed validation.";
      }
    }
  }

  sessions.set(sessionId, session);

  // Record audit events for session creation and question selection (SPEC WF-02)
  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    event_type: "session_created",
    question_id: question.question_id,
    hint_level: 0,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  const questionSelectionEvent = {
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    event_type: "question_selection",
    question_id: question.question_id,
    hint_level: 0,
    recommended: Boolean(options.recommended),
    edge_type: options.recommendation_meta?.edge_type || "direct_selection",
    timestamp: new Date().toISOString(),
  };
  const view = buildSessionView(session, question, initialTutorTurn);
  view.audit_event = questionSelectionEvent;
  return view;
}

export function getSession(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  checkAndApplyInactivity(session, options.simulated_idle_minutes || 0);

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

  checkAndApplyInactivity(session, eventBody.simulated_idle_minutes || 0);

  const question = getQuestion(session.question_id);
  const { event } = eventBody;

  // A note is valid in ANY state (including terminal or non-terminal)
  if (event === "note") {
    return handleNoteEvent(session, question, eventBody);
  }

  // Terminal state check: only 'note' is allowed in terminal states (PRD §8.5.1)
  const terminalStates = ["completed", "declined", "stuck", "abandoned"];
  if (terminalStates.includes(session.state)) {
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "transition_not_allowed",
      attempted_event: event,
      state: session.state,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    throw new Error(`transition_not_allowed: event ${event} not allowed in terminal state ${session.state}`);
  }

  // Handle transfer decisions in transfer_offered
  if (event === "accept" || event === "decline") {
    if (session.state !== "transfer_offered") {
      const auditEvent = {
        event_id: crypto.randomUUID(),
        session_id: session.id,
        event_type: "transition_not_allowed",
        attempted_event: event,
        state: session.state,
        timestamp: new Date().toISOString(),
      };
      auditEvents.push(auditEvent);
      throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
    }
    return handleTransferDecisionEvent(session, question, eventBody);
  }

  // Handle reflection choices and skip in reflection
  if (event === "reflection_choice" || event === "skip") {
    if (session.state !== "reflection") {
      const auditEvent = {
        event_id: crypto.randomUUID(),
        session_id: session.id,
        event_type: "transition_not_allowed",
        attempted_event: event,
        state: session.state,
        timestamp: new Date().toISOString(),
      };
      auditEvents.push(auditEvent);
      throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
    }
    return handleReflectionChoiceEvent(session, question, eventBody);
  }

  // Handle "show_solution": allowed ONLY in active state (PRD §8.5.1, Criterion 5)
  if (event === "show_solution") {
    if (session.state !== "active") {
      const auditEvent = {
        event_id: crypto.randomUUID(),
        session_id: session.id,
        event_type: "transition_not_allowed",
        attempted_event: "show_solution",
        state: session.state,
        timestamp: new Date().toISOString(),
      };
      auditEvents.push(auditEvent);
      throw new Error(`transition_not_allowed: show_solution not allowed in ${session.state}`);
    }
    return handleShowSolutionEvent(session, question, eventBody);
  }

  // Legality check: "not_sure" and "submit" are valid in awaiting_first_attempt, active, transfer_active
  const validStates = ["awaiting_first_attempt", "active", "transfer_active"];
  if (!validStates.includes(session.state)) {
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "transition_not_allowed",
      attempted_event: event,
      state: session.state,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    throw new Error(`transition_not_allowed: event ${event} not allowed in state ${session.state}`);
  }

  let result;
  if (event === "not_sure") {
    result = handleNotSureEvent(session, question, eventBody.response_duration_ms || 0, eventBody.idempotency_key);
  } else if (event === "submit" || event === "attempt") {
    result = handleSubmitEvent(session, question, eventBody);
  } else {
    const auditEvent = {
      event_id: crypto.randomUUID(),
      session_id: session.id,
      event_type: "transition_not_allowed",
      attempted_event: event,
      state: session.state,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    throw new Error(`transition_not_allowed: unsupported event ${event}`);
  }

  if (result && result.tutor) {
    result.tutor.diagram = getDiagramView(session, question);
  }
  return result;
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

  const { studentState, tone } = computeAndApplyStudentState(session, null);

  // 3. Attempt is stored with response_type=not_sure and counted=false (attempt_count unchanged)
  const attemptRecord = {
    attempt_id: crypto.randomUUID(),
    attempt_number: session.attempt_count, // preserved, NOT incremented
    hint_level: newLevel,
    response_type: "not_sure",
    answer_text: null,
    counted: false,
    duration_ms: durationMs,
    student_state: studentState,
    tone: tone,
    created_at: new Date().toISOString(),
  };
  session.attempts.push(attemptRecord);

  // 4. Counts toward turn cap
  session.turn_number += 1;
  session.pipeline_turns = (session.pipeline_turns || 0) + 1;
  session.last_activity_at = new Date().toISOString();

  let tutorText = "";
  let turnKind = "probe_template";

  if (session.pipeline_turns >= session.turn_cap) {
    session.state = "stuck";
    session.end_reason = "turn_cap_reached";
    if (!session.flags.includes("turn_cap_reached")) {
      session.flags.push("turn_cap_reached");
    }
    session.active_probe_id = null;
    tutorText = getCannedResponse("turn_cap_notice");
    turnKind = "canned";
    const nextQ = recommendNextQuestion(session.student_id || "student_default", {
      sessions: getAllSessions(),
      excludeQuestionIds: [session.question_id],
    });
    session.offered_next_question_id = nextQ ? nextQ.question_id : null;
    session.recommended_next_question = nextQ;
    session.summary = generateSessionSummary(session);
    session.next_target = "final";
  } else {
    // 5. Select next unused probe for new level, or canned fallback/encouragement if exhausted
    const availableProbes = (question.scaffold_probes || []).filter(
      (p) => p.min_level <= newLevel && !session.asked_probe_ids.includes(p.probe_id)
    );

    if (availableProbes.length > 0) {
      const selectedProbe = availableProbes[0];
      session.asked_probe_ids.push(selectedProbe.probe_id);
      session.active_probe_id = selectedProbe.probe_id;
      tutorText = selectedProbe.template;
      turnKind = "probe_template";
      session.next_target = "probe";
    } else {
      session.active_probe_id = null;
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
    student_state: studentState,
    tone: tone,
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

  const idempotencyKey = eventBody.idempotency_key || null;
  const simulateCrash = Boolean(eventBody.simulate_crash_before_turn_persist);

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
    const { studentState, tone } = computeAndApplyStudentState(session, null);
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
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      verifier_result: {
        schema_version: "1.0",
        status: "cannot_verify",
        state: "tool_failure",
        confidence: null,
        input_kind: null,
        canonical_value: null,
        unit: null,
        canonical_expression: null,
        matched_solution_step: null,
        path_id: null,
        matched_step_ids: [],
        matched_solution_step_post_overlay: null,
        status_post_overlay: "cannot_verify",
        overlay_applied: false,
        accepted_answer: null,
        response_target: "final",
      },
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

    const { studentState, tone } = computeAndApplyStudentState(session, null);

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
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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
      session.hint_level = Math.min(session.hint_level + 1, 4);

      if (!session.matched_step_ids) session.matched_step_ids = [];
      const isNewStep = !session.matched_step_ids.includes(matchedStep.step_id);
      const stepProgress = isNewStep ? "advancing" : "stalled";
      if (isNewStep) {
        session.matched_step_ids.push(matchedStep.step_id);
      }

      const tempAttempt = {
        status: "partially_correct",
        status_post_overlay: "partially_correct",
        canonical_value: matchedStep.target_value,
        step_expressions: [stepRaw],
        progress: stepProgress,
        is_correct: false,
      };
      const { studentState, tone } = computeAndApplyStudentState(session, tempAttempt);

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
        status: "partially_correct",
        state: "ok",
        matched_solution_step: matchedStep.step_id,
        matched_step_ids: [matchedStep.step_id],
        progress: stepProgress,
        accepted_answer: false,
        duration_ms: response_duration_ms,
        student_state: studentState,
        tone: tone,
        created_at: new Date().toISOString(),
      };
      session.attempts.push(attemptRecord);

      const tutorText = `Good work on step: ${matchedStep.description}! What is your next calculation?`;
      const singlePromptResult = checkSinglePrompt(tutorText);

      const verifierResult = {
        schema_version: "1.0",
        status: "partially_correct",
        state: "ok",
        confidence: 0.98,
        input_kind: "expression",
        canonical_value: matchedStep.target_value,
        canonical_expression: matchedStep.target_expression,
        matched_solution_step: matchedStep.step_id,
        matched_step_ids: [matchedStep.step_id],
        matched_solution_step_post_overlay: matchedStep.step_id,
        status_post_overlay: "partially_correct",
        progress: stepProgress,
        overlay_applied: true,
        accepted_answer: false,
        response_target: "step",
      };

      const tutorTurn = {
        turn_number: session.turn_number,
        speaker: "tutor",
        kind: "authored",
        text: tutorText,
        controls: getControlsForState(session.state),
        choices: [],
        hint_level: session.hint_level,
        model: "template",
        student_state: studentState,
        tone: tone,
        prompt_version: "1.0.0",
        policy_version: "1.0.0",
        trace_status: "missing",
        verifier_result: verifierResult,
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

      const { studentState, tone } = computeAndApplyStudentState(session, null);

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
        student_state: studentState,
        tone: tone,
        created_at: new Date().toISOString(),
      };
      session.attempts.push(attemptRecord);

      const tutorText = getCannedResponse("enter_the_number");
      const singlePromptResult = checkSinglePrompt(tutorText);

      const verifierResult = {
        schema_version: "1.0",
        status: "cannot_verify",
        state: "ok",
        confidence: 0.98,
        input_kind: "expression",
        canonical_value: null,
        canonical_expression: stepNorm.canonical_expression || stepRaw,
        matched_solution_step: null,
        matched_step_ids: [],
        matched_solution_step_post_overlay: null,
        status_post_overlay: "cannot_verify",
        overlay_applied: true,
        accepted_answer: false,
        response_target: "step",
      };

      const tutorTurn = {
        turn_number: session.turn_number,
        speaker: "tutor",
        kind: "canned",
        text: tutorText,
        controls: getControlsForState(session.state),
        choices: [],
        hint_level: session.hint_level,
        model: "template",
        student_state: studentState,
        tone: tone,
        prompt_version: "1.0.0",
        policy_version: "1.0.0",
        trace_status: "missing",
        verifier_result: verifierResult,
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

  // 4. Regular answer_text submission (Criteria 2, 4, 5, 6, STU-11)
  const responseTarget =
    eventBody.response_target ||
    (session.active_probe_id ? "probe" : "final");
  const fieldKind = responseTarget === "probe" ? "step" : "answer";

  // Run MathVerifierAgent (AG-02)
  const { pureResult, outcome: verifierOutcome } = MathVerifierAgent.runTurn({
    question,
    input: answer_text,
    fieldKind,
    responseTarget,
    session,
    simulate_tool_failure,
  });

  // Handle Internal Inconsistency (Criterion 7)
  if (question?.flagged && question?.answer_key_inconsistency) {
    if (!session.flags.includes("answer_key_inconsistency")) {
      session.flags.push("answer_key_inconsistency");
    }
    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: session.attempt_count,
      hint_level: session.hint_level,
      response_type: "final_answer",
      response_target: responseTarget,
      answer_text,
      counted: false,
      status: "cannot_verify",
      state: "ok",
      duration_ms: response_duration_ms,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);
    const tutorText = getCannedResponse("tool_failure_notice");
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
      single_prompt: true,
      timestamp: new Date().toISOString(),
    };
    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      attempt: attemptRecord,
      audit_event: null,
      linked_session_id: null,
    };
  }

  const norm = normalise(answer_text, fieldKind);

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
      session.pipeline_turns = (session.pipeline_turns || 0) + 1;
      session.last_activity_at = new Date().toISOString();
      if (session.pipeline_turns >= session.turn_cap) {
        session.state = "stuck";
        session.end_reason = "turn_cap_reached";
        if (!session.flags.includes("turn_cap_reached")) {
          session.flags.push("turn_cap_reached");
        }
        tutorText = getCannedResponse("turn_cap_notice");
        const nextQ = recommendNextQuestion(session.student_id || "student_default", {
          sessions: getAllSessions(),
          excludeQuestionIds: [session.question_id],
        });
        session.offered_next_question_id = nextQ ? nextQ.question_id : null;
        session.recommended_next_question = nextQ;
        session.summary = generateSessionSummary(session);
      }
    }

    const { studentState, tone } = computeAndApplyStudentState(session, null);

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: session.attempt_count,
      hint_level: session.hint_level,
      response_type: "final_answer",
      response_target: responseTarget,
      answer_text: answer_text,
      selected_reasoning_option: selected_reasoning_option || null,
      confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
      counted: false,
      status: "cannot_verify",
      state: "ok",
      parse_issue: norm.parse_issue,
      duration_ms: response_duration_ms,
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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

  // Row 5b: parsed expression matching no step in answer field
  if (
    verifierOutcome.status_post_overlay === "cannot_verify" &&
    norm.input_kind === "expression" &&
    responseTarget === "final"
  ) {
    session.turn_number += 1;
    session.pipeline_turns = (session.pipeline_turns || 0) + 1;
    session.last_activity_at = new Date().toISOString();

    const { studentState, tone } = computeAndApplyStudentState(session, null);

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
      canonical_value: verifierOutcome.canonical_value,
      canonical_expression: verifierOutcome.canonical_expression,
      error_category: verifierOutcome.error_category,
      relation_tags: verifierOutcome.relation_tags,
      duration_ms: response_duration_ms,
      student_state: studentState,
      tone: tone,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    let tutorText = getCannedResponse("enter_the_number");
    let turnKind = "canned";

    if (session.pipeline_turns >= session.turn_cap) {
      session.state = "stuck";
      session.end_reason = "turn_cap_reached";
      if (!session.flags.includes("turn_cap_reached")) {
        session.flags.push("turn_cap_reached");
      }
      tutorText = getCannedResponse("turn_cap_notice");
      const nextQ = recommendNextQuestion(session.student_id || "student_default", {
        sessions: getAllSessions(),
        excludeQuestionIds: [session.question_id],
      });
      session.offered_next_question_id = nextQ ? nextQ.question_id : null;
      session.recommended_next_question = nextQ;
      session.summary = generateSessionSummary(session);
    }

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
      student_state: studentState,
      tone: tone,
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      trace_status: "missing",
      verifier_result: verifierOutcome,
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

    return {
      session: getCleanSessionState(session),
      tutor: tutorTurn,
      attempt: attemptRecord,
      audit_event: null,
      linked_session_id: null,
    };
  }

  // Valid parsed answer resets consecutive_cannot_verify
  session.consecutive_cannot_verify = 0;

  if (session.state === "awaiting_first_attempt") {
    session.state = "active";
  }

  const existingAttempt = idempotencyKey
    ? session.attempts.find((a) => a.idempotency_key === idempotencyKey)
    : null;

  if (!existingAttempt) {
    session.attempt_count += 1;
  }
  session.turn_number += 1;
  session.pipeline_turns = (session.pipeline_turns || 0) + 1;
  session.last_activity_at = new Date().toISOString();

  const currentAttemptNumber = session.attempt_count;
  const currentHintLevel = session.hint_level;

  const canonicalValue = String(question.accepted_answer_spec?.canonical_value || "").trim();
  const cleanedInput = String(norm.canonical_value || answer_text || "")
    .trim()
    .replace(/^\$/, "")
    .trim();

  const isCorrect = verifierOutcome.status_post_overlay === "correct";
  const isPartiallyCorrect = verifierOutcome.status_post_overlay === "partially_correct";

  let tutorText = "";
  let turnKind = "authored";
  let promptType = null;
  let classificationResult = null;
  let misconceptionEvent = null;
  const isLlmMode = session.dialogue_mode === "llm" || !!simulated_classification;

  if (isCorrect) {
    session.active_probe_id = null;
    if (session.state === "transfer_active") {
      session.state = "completed";
      session.end_reason = "completed";
      session.transfer_outcome = "correct";
      session.mastery_confidence = Math.min(1.0, (session.mastery_confidence || 0) + 0.20);
      if (session.linked_session_id) {
        const orig = sessions.get(session.linked_session_id);
        if (orig) {
          orig.transfer_outcome = "correct";
          orig.mastery_confidence = Math.min(1.0, (orig.mastery_confidence || 0) + 0.20);
          if (!orig.summary) orig.summary = generateSessionSummary(orig);
          else orig.summary.transfer_result = "correct";
        }
      }
      tutorText = "Outstanding! You solved the transfer question correctly on your own.";
      turnKind = "authored";
      promptType = null;
      session.summary = generateSessionSummary(session);
    } else {
      session.state = "reflection";
      session.next_target = "reflection";
      const verifiedStudentVal = String(answer_text || canonicalValue).trim();
      const promptTemplate = question.reflection?.prompt_template || "You calculated {student_value}. How could you check your answer?";
      tutorText = promptTemplate.replace(/\{student_value\}/g, verifiedStudentVal);
      turnKind = "authored";
      promptType = "reflection";
    }
  } else if (isPartiallyCorrect) {
    if (session.state === "transfer_active" && session.hint_level === 4 && session.attempt_count >= 3) {
      session.state = "completed";
      session.end_reason = "stuck_after_transfer";
      if (!session.flags.includes("stuck_after_transfer")) {
        session.flags.push("stuck_after_transfer");
      }
      session.transfer_outcome = "incorrect";
      if (session.linked_session_id) {
        const orig = sessions.get(session.linked_session_id);
        if (orig) {
          orig.transfer_outcome = "incorrect";
          if (!orig.summary) orig.summary = generateSessionSummary(orig);
          else orig.summary.transfer_result = "incorrect";
        }
      }
      tutorText = getCannedResponse("transfer_stuck_notice");
      turnKind = "canned";
      promptType = null;
      session.summary = generateSessionSummary(session);
    } else if (session.pipeline_turns >= session.turn_cap) {
      session.state = "stuck";
      session.end_reason = "turn_cap_reached";
      if (!session.flags.includes("turn_cap_reached")) {
        session.flags.push("turn_cap_reached");
      }
      tutorText = getCannedResponse("turn_cap_notice");
      turnKind = "canned";
      promptType = null;
      const nextQ = recommendNextQuestion(session.student_id || "student_default", {
        sessions: getAllSessions(),
        excludeQuestionIds: [session.question_id],
      });
      session.offered_next_question_id = nextQ ? nextQ.question_id : null;
      session.recommended_next_question = nextQ;
      session.summary = generateSessionSummary(session);
    } else {
      const stepId = verifierOutcome.matched_solution_step_post_overlay;
      if (!session.matched_step_ids) session.matched_step_ids = [];
      const isNew = stepId && !session.matched_step_ids.includes(stepId);
      if (isNew) {
        session.matched_step_ids.push(stepId);
        verifierOutcome.progress = "advancing";
        // Advancing progress: Hint level does NOT rise
      } else {
        verifierOutcome.progress = "stalled";
        // Stalled: escalate
        session.hint_level = Math.min(session.hint_level + 1, 4);
      }

      if (responseTarget === "probe") {
        session.active_probe_id = null;
        session.next_target = "final";
        tutorText = "Good calculation! What is your next calculation to find the final answer?";
        turnKind = "authored";
      } else {
        tutorText = "That is a correct calculation step! What is the final answer it gives?";
        turnKind = "authored";
      }
    }
  } else {
    // Incorrect answer: policy escalates hint level by +1 (capped at 4)
    if (session.hint_level < 4) {
      session.hint_level = Math.min(session.hint_level + 1, 4);
    } else {
      session.hint_level = 4;
    }

    if (session.state === "transfer_active" && session.hint_level === 4 && session.attempt_count >= 3) {
      session.state = "completed";
      session.end_reason = "stuck_after_transfer";
      if (!session.flags.includes("stuck_after_transfer")) {
        session.flags.push("stuck_after_transfer");
      }
      session.transfer_outcome = "incorrect";
      if (session.linked_session_id) {
        const orig = sessions.get(session.linked_session_id);
        if (orig) {
          orig.transfer_outcome = "incorrect";
          if (!orig.summary) orig.summary = generateSessionSummary(orig);
          else orig.summary.transfer_result = "incorrect";
        }
      }
      tutorText = getCannedResponse("transfer_stuck_notice");
      turnKind = "canned";
      promptType = null;
      session.summary = generateSessionSummary(session);
    } else if (session.pipeline_turns >= session.turn_cap) {
      session.state = "stuck";
      session.end_reason = "turn_cap_reached";
      if (!session.flags.includes("turn_cap_reached")) {
        session.flags.push("turn_cap_reached");
      }
      tutorText = getCannedResponse("turn_cap_notice");
      turnKind = "canned";
      promptType = null;
      const nextQ = recommendNextQuestion(session.student_id || "student_default", {
        sessions: getAllSessions(),
        excludeQuestionIds: [session.question_id],
      });
      session.offered_next_question_id = nextQ ? nextQ.question_id : null;
      session.recommended_next_question = nextQ;
      session.summary = generateSessionSummary(session);
    } else if (isLlmMode) {
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
      // Deterministic Misconception Matcher (AG-03, SPEC WF-07)
      const prediction = question.misconception_predictions?.find(
        (p) => String(p.predicted_response).trim() === cleanedInput
      );
      if (prediction) {
        misconceptionEvent = {
          id: crypto.randomUUID(),
          session_id: session.id,
          turn_id: session.turn_number,
          student_id: session.student_id || "student_default",
          skill_id: question.skill_id,
          code: prediction.misconception_code,
          confidence: prediction.confidence || 0.9,
          source: "deterministic_match",
          evidence: prediction.rationale || "Authored predicted response match",
          alternative_labels: [],
          cited_exemplar_ids: [],
          recommended_prompt_type: "diagnostic_probe",
          reviewer_status: "unreviewed",
          created_at: new Date().toISOString(),
        };
        if (!session.misconception_events) session.misconception_events = [];
        session.misconception_events.push(misconceptionEvent);
      }

      // Template mode default: probe_template or fallback_l{level}
      const availableProbes = (question.scaffold_probes || []).filter(
        (p) => p.min_level <= session.hint_level && !session.asked_probe_ids.includes(p.probe_id)
      );

      if (availableProbes.length > 0) {
        const probe = availableProbes[0];
        session.asked_probe_ids.push(probe.probe_id);
        session.active_probe_id = probe.probe_id;
        tutorText = probe.template;
        turnKind = "probe_template";
        session.next_target = "probe";
      } else {
        session.active_probe_id = null;
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

  let attemptRecord = existingAttempt;
  const currentAttemptForEstimator = {
    status: verifierOutcome.status_post_overlay,
    status_post_overlay: verifierOutcome.status_post_overlay,
    canonical_value: verifierOutcome.canonical_value,
    answer_text: answer_text,
    progress: verifierOutcome.progress || null,
    is_correct: isCorrect,
  };
  const { studentState, tone } = computeAndApplyStudentState(session, currentAttemptForEstimator);

  if (!attemptRecord) {
    attemptRecord = {
      attempt_id: crypto.randomUUID(),
      idempotency_key: idempotencyKey || null,
      attempt_number: currentAttemptNumber,
      hint_level: currentHintLevel,
      response_type: "final_answer",
      response_target: responseTarget,
      answer_text: answer_text,
      selected_reasoning_option: selected_reasoning_option || null,
      confidence_rating: confidence_rating !== undefined ? confidence_rating : null,
      counted: true,
      status: verifierOutcome.status_post_overlay,
      state: verifierOutcome.state,
      error_category: verifierOutcome.error_category,
      relation_tags: verifierOutcome.relation_tags,
      matched_solution_step: verifierOutcome.matched_solution_step_post_overlay || null,
      matched_step_ids: verifierOutcome.matched_step_ids || [],
      accepted_answer: verifierOutcome.accepted_answer || false,
      progress: verifierOutcome.progress || null,
      duration_ms: response_duration_ms,
      misconception_code: !isCorrect && classificationResult ? classificationResult.code : null,
      prompt_type: !isCorrect ? promptType : null,
      reviewer_status: !isCorrect && classificationResult ? "unreviewed" : null,
      student_state: studentState,
      tone: tone,
      created_at: new Date().toISOString(),
    };
    session.attempts.push(attemptRecord);

    if (simulateCrash) {
      throw new Error("simulated_crash_before_turn_persist");
    }
  }

  // Update learner model (STU-16, SPEC §2.5)
  const learnerState = updateLearnerModel(session.student_id || "student_default", question.skill_id, {
    is_correct: isCorrect,
    hint_level: session.hint_level,
    is_transfer: session.state === "completed" && session.transfer_outcome !== null,
    transfer_outcome: session.transfer_outcome,
    is_counted: true,
    progress: verifierOutcome.progress || null,
  });
  session.mastery_estimate = learnerState.mastery_estimate;
  session.mastery_confidence = learnerState.mastery_confidence;

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: turnKind,
    text: tutorText,
    controls: getControlsForState(session.state),
    choices: session.state === "reflection" && question.reflection?.options
      ? [
          ...question.reflection.options.map((opt) => ({
            option_id: opt.option_id,
            label: opt.label,
            feedback: opt.feedback,
          })),
          {
            option_id: "skip",
            label: "Skip reflection",
            feedback: "You skipped reflection.",
          },
        ]
      : [],
    hint_level: session.state === "reflection" ? null : session.hint_level,
    model: !isCorrect && isLlmMode ? "classifier" : "template",
    student_state: studentState,
    tone: tone,
    prompt_type: session.state === "reflection" ? "reflection" : (!isCorrect ? promptType : null),
    safety_verdict: safetyVerdict,
    misconception_code: !isCorrect && classificationResult ? classificationResult.code : null,
    verifier_result: verifierOutcome,
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

  const { studentState, tone } = computeAndApplyStudentState(session, null);

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
  session.pipeline_turns = (session.pipeline_turns || 0) + 1;
  session.last_activity_at = new Date().toISOString();

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
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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
    let tutorText = "";
    let turnKind = "probe_template";

    if (session.pipeline_turns >= session.turn_cap) {
      session.state = "stuck";
      session.end_reason = "turn_cap_reached";
      if (!session.flags.includes("turn_cap_reached")) {
        session.flags.push("turn_cap_reached");
      }
      session.active_probe_id = null;
      tutorText = getCannedResponse("turn_cap_notice");
      turnKind = "canned";
      const nextQ = recommendNextQuestion(session.student_id || "student_default", {
        sessions: getAllSessions(),
        excludeQuestionIds: [session.question_id],
      });
      session.offered_next_question_id = nextQ ? nextQ.question_id : null;
      session.recommended_next_question = nextQ;
      session.summary = generateSessionSummary(session);
      session.next_target = "final";
    } else {
      const availableProbes = (question.scaffold_probes || []).filter(
        (p) => p.min_level <= session.hint_level && !session.asked_probe_ids.includes(p.probe_id)
      );

      if (availableProbes.length > 0) {
        const selectedProbe = availableProbes[0];
        session.asked_probe_ids.push(selectedProbe.probe_id);
        session.active_probe_id = selectedProbe.probe_id;
        tutorText = selectedProbe.template;
        turnKind = "probe_template";
        session.next_target = "probe";
      } else {
        session.active_probe_id = null;
        tutorText = getCannedResponse("encouragement");
        turnKind = "canned";
        session.next_target = "final";
      }
    }

    const attemptRecord = {
      attempt_id: crypto.randomUUID(),
      attempt_number: countedAttempts,
      hint_level: session.hint_level,
      response_type: "show_solution",
      answer_text: null,
      counted: false,
      duration_ms: durationMs,
      student_state: studentState,
      tone: tone,
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
      student_state: studentState,
      tone: tone,
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

function handleReflectionChoiceEvent(session, question, eventBody) {
  const { event, option_id, response_duration_ms = 0 } = eventBody;
  const isSkip = event === "skip" || option_id === "skip";

  const options = question.reflection?.options || [];
  let selectedOption = options.find((opt) => opt.option_id === option_id);

  if (isSkip || !selectedOption) {
    selectedOption = {
      option_id: "skip",
      label: "Skip reflection",
      sound: null,
      feedback: "You skipped reflection.",
    };
  }

  session.turn_number += 1;

  const { studentState, tone } = computeAndApplyStudentState(session, null);

  // Stored attempt with sound flag visible to teacher only
  const attemptRecord = {
    attempt_id: crypto.randomUUID(),
    attempt_number: session.attempt_count,
    hint_level: session.hint_level,
    response_type: "reflection_choice",
    selected_option_id: selectedOption.option_id,
    sound: selectedOption.sound !== undefined ? selectedOption.sound : null,
    duration_ms: response_duration_ms,
    counted: false,
    student_state: studentState,
    tone: tone,
    created_at: new Date().toISOString(),
  };
  session.attempts.push(attemptRecord);

  // Call selectTransferPartner
  const partner = selectTransferPartner({
    completedQuestion: question,
    taughtSkills: [question.skill_id],
    cohortStartingSkills: [question.skill_id],
  });

  let tutorText = "";
  let turnKind = "authored";
  let eventType = "reflection_submitted";

  if (partner) {
    session.state = "transfer_offered";
    session.offered_transfer_question_id = partner.question_id;
    const transferOffer = getCannedResponse("transfer_offer");
    tutorText = `${selectedOption.feedback} ${transferOffer}`.trim();
    turnKind = "authored";
  } else {
    session.state = "completed";
    session.end_reason = "no_legal_transfer";
    session.summary = generateSessionSummary(session);
    const noPartnerNotice = getCannedResponse("no_legal_transfer_notice");
    tutorText = `${selectedOption.feedback} ${noPartnerNotice}`.trim();
    turnKind = "canned";
    eventType = "no_legal_transfer";
  }

  const tutorTurn = {
    turn_number: session.turn_number,
    speaker: "tutor",
    kind: turnKind,
    text: tutorText,
    controls: getControlsForState(session.state),
    choices: [],
    hint_level: session.hint_level,
    model: "template",
    student_state: studentState,
    tone: tone,
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
    event: isSkip ? "skip" : "reflection_choice",
    option_id: selectedOption.option_id,
    timestamp: new Date().toISOString(),
  });
  session.history.push(tutorTurn);

  const auditEvent = {
    event_id: crypto.randomUUID(),
    session_id: session.id,
    event_type: eventType,
    selected_option_id: selectedOption.option_id,
    sound: selectedOption.sound !== undefined ? selectedOption.sound : null,
    offered_transfer_question_id: session.offered_transfer_question_id,
    end_reason: session.end_reason,
    timestamp: new Date().toISOString(),
  };
  auditEvents.push(auditEvent);

  return {
    session: getCleanSessionState(session),
    tutor: tutorTurn,
    attempt: attemptRecord,
    audit_event: auditEvent,
    linked_session_id: session.linked_session_id || null,
  };
}

function handleTransferDecisionEvent(session, question, eventBody) {
  const { event } = eventBody;
  if (event === "accept") {
    const partnerId = session.offered_transfer_question_id || "ratio_share_002";
    const partnerQuestion = getQuestion(partnerId);

    // Create linked session
    const linkedSessionId = crypto.randomUUID();
    const linkedSession = {
      id: linkedSessionId,
      student_id: session.student_id || "student_default",
      state: "transfer_active",
      question_id: partnerQuestion ? partnerQuestion.question_id : partnerId,
      question_version: partnerQuestion?.version || 1,
      hint_level: 0,
      attempt_count: 0,
      mastery_estimate: session.mastery_estimate || 0.0,
      turn_number: 1,
      turn_cap: 12,
      pipeline_turns: 0,
      last_activity_at: new Date().toISOString(),
      ended_at: null,
      summary: null,
      offered_next_question_id: null,
      recommended_next_question: null,
      input_mode: "keypad",
      dialogue_mode: session.dialogue_mode || "template",
      allow_level_5: false,
      flags: [],
      next_target: "final",
      consecutive_cannot_verify: 0,
      created_at: new Date().toISOString(),
      asked_probe_ids: [],
      attempts: [],
      misconception_events: [],
      notes: [],
      history: [],
      linked_session_id: session.id,
      mastery_confidence: session.mastery_confidence || 0.0,
      transfer_outcome: "in_progress",
    };
    linkedSession.student_state = StudentStateEstimator.estimate({ priorAttempts: [] });
    linkedSession.tone = "neutral";
    sessions.set(linkedSessionId, linkedSession);

    session.linked_session_id = linkedSessionId;
    session.transfer_outcome = "in_progress";

    // For single-session practice UI continuity, update session in-place as well
    session.state = "transfer_active";
    session.question_id = partnerQuestion ? partnerQuestion.question_id : partnerId;
    session.question_version = partnerQuestion?.version || 1;
    session.hint_level = 0;
    session.attempt_count = 0;
    session.turn_number += 1;
    session.turn_cap = 12;
    session.pipeline_turns = 0;
    session.last_activity_at = new Date().toISOString();
    session.summary = null;
    session.end_reason = null;
    session.student_state = StudentStateEstimator.estimate({ priorAttempts: [] });
    session.tone = "neutral";

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
      student_state: session.student_state,
      tone: session.tone,
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
      linked_session_id: linkedSessionId,
      transfer_question_id: partnerQuestion ? partnerQuestion.question_id : partnerId,
      timestamp: new Date().toISOString(),
    };
    auditEvents.push(auditEvent);
    return {
      session: getCleanSessionState(session),
      question: buildQuestionView(partnerQuestion || question),
      tutor: tutorTurn,
      audit_event: auditEvent,
      linked_session_id: linkedSessionId,
    };
  } else if (event === "decline") {
    session.state = "declined";
    session.end_reason = "declined";
    session.transfer_outcome = "skipped";
    if (session.linked_session_id) {
      const orig = sessions.get(session.linked_session_id);
      if (orig) {
        orig.transfer_outcome = "skipped";
        if (orig.summary) orig.summary.transfer_result = "skipped";
      }
    }
    session.summary = generateSessionSummary(session);
    // A skip does not raise learner confidence (mastery_confidence unchanged)
    session.turn_number += 1;
    const declineText = getCannedResponse("transfer_declined_ack");
    const tutorTurn = {
      turn_number: session.turn_number,
      speaker: "tutor",
      kind: "canned",
      text: declineText,
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
      transfer_outcome: "skipped",
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
    pipeline_turns: session.pipeline_turns || 0,
    summary: session.summary || null,
    offered_next_question_id: session.offered_next_question_id || null,
    recommended_next_question: session.recommended_next_question || null,
    last_activity_at: session.last_activity_at || session.created_at,
    ended_at: session.ended_at || null,
    input_mode: session.input_mode || "keypad",
    dialogue_mode: session.dialogue_mode || "template",
    allow_level_5: session.allow_level_5 || false,
    flags: session.flags || [],
    next_target: session.next_target,
    active_probe_id: session.active_probe_id || null,
    matched_step_ids: session.matched_step_ids || [],
    consecutive_cannot_verify: session.consecutive_cannot_verify || 0,
    attempts: session.attempts,
    misconception_events: session.misconception_events || [],
    notes: session.notes || [],
    student_id: session.student_id || "student_default",
    transfer_outcome: session.transfer_outcome || null,
    mastery_estimate: session.mastery_estimate !== undefined ? session.mastery_estimate : 0.0,
    mastery_confidence: session.mastery_confidence !== undefined ? session.mastery_confidence : 0.0,
    end_reason: session.end_reason || null,
    linked_session_id: session.linked_session_id || null,
    offered_transfer_question_id: session.offered_transfer_question_id || null,
    recommended: Boolean(session.recommended),
    recommendation: session.recommendation || null,
    student_state: session.student_state || null,
    tone: session.tone || null,
  };
}

function buildQuestionView(question) {
  if (!question) return null;
  return {
    question_id: question.question_id,
    version: question.version || 1,
    title: question.title,
    skill_id: question.skill_id || null,
    stem: question.stem,
    answer_type: question.accepted_answer_spec?.type || "numeric",
    unit: question.accepted_answer_spec?.unit || "",
    answer_requires_unit: question.accepted_answer_spec?.answer_requires_unit || false,
    reasoning_options: (question.reasoning_options || []).map((ro) => ({
      option_id: ro.option_id,
      label: ro.label,
    })),
    has_diagram: Boolean(question.has_diagram),
    diagram_id: question.diagram_id || null,
    is_withheld: Boolean(question.is_withheld),
    withheld_reason: question.withheld_reason || null,
  };
}

export function getDiagramView(session, question) {
  if (!question || !question.has_diagram || !question.diagram_id) return null;
  const diagAsset = getDiagramAsset(question.diagram_id) || question.diagram;
  if (!diagAsset) return null;
  const minLevel = diagAsset.min_level || 3;
  if (session.hint_level < minLevel) return null;

  const validation = validateDiagram(diagAsset, question, session.hint_level, session.allow_level_5);
  if (diagAsset.approval_status === "approved" && validation.valid) {
    return {
      diagram_id: diagAsset.diagram_id,
      version: validation.version,
      hash: validation.hash,
      alt_text: validation.alt_text,
      description: validation.description,
      title: diagAsset.title,
      min_level: minLevel,
      url: `/api/sessions/${session.id}/diagram`,
    };
  }
  return null;
}

function buildSessionView(session, question, tutorTurn) {
  const questionView = buildQuestionView(question);
  const diagramView = getDiagramView(session, question);

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
      student_state: tutorTurn.student_state || session.student_state || null,
      tone: tutorTurn.tone || session.tone || "neutral",
      prompt_type: tutorTurn.prompt_type || null,
      safety_verdict: tutorTurn.safety_verdict || "allow",
      misconception_code: tutorTurn.misconception_code || null,
      prompt_version: tutorTurn.prompt_version || "1.0.0",
      policy_version: tutorTurn.policy_version || "1.0.0",
      trace_status: tutorTurn.trace_status || "missing",
      single_prompt: tutorTurn.single_prompt !== undefined ? tutorTurn.single_prompt : checkSinglePrompt(tutorTurn.text).passed,
      diagram: diagramView,
    },
    linked_session_id: session.linked_session_id || null,
  };
}

export function getAuditEvents(sessionId) {
  if (sessionId) {
    return auditEvents.filter((e) => e.session_id === sessionId);
  }
  return auditEvents;
}

export function getStudentDashboard(studentId = "student_default", options = {}) {
  const all = Array.from(sessions.values());
  return buildStudentDashboard(studentId, all, options);
}

export function runRollup(studentId = "student_default", options = {}) {
  const all = Array.from(sessions.values());
  return runLearnerRollup(studentId, all, options);
}

export function getAllSessions() {
  return Array.from(sessions.values());
}

export function getAllSessionFlags(sessionId) {
  const all = Array.from(sessions.values());
  const matching = sessionId ? all.filter((s) => s.id === sessionId) : all;
  return matching.flatMap((s) =>
    (s.flags || []).map((flag) => ({
      session_id: s.id,
      kind: flag,
      created_at: s.created_at || new Date().toISOString(),
    }))
  );
}

export function resetSessionStore() {
  sessions.clear();
  auditEvents.length = 0;
  idempotencyStore.clear();
  resetLearnerStore();
  clearVerifierCache();
}

export {
  updateLearnerModel,
  validateDashboardLanguage,
  MathVerifierAgent,
  verifyExpression,
  applyOverlay,
  clearVerifierCache,
  getVerifierCache,
  simplifyRatio,
  areRatiosEquivalent,
  isRatioSwapped,
  validatePureResultSchema,
  StudentStateEstimator,
  deriveTone,
  validateStudentState,
};

