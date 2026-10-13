/**
 * Student State Estimator (StudentStateEstimator, AG-05)
 *
 * Implements the deterministic student state estimation contract from:
 * - PRD §6.1 STU-19, TECH-38, PRD §9.3 & §9.4
 * - SPEC §2.4 (StudentState, HintDecision.tone), §4 WF-08
 * - AGENTS.md §2.7 (AG-05 StudentStateEstimator)
 *
 * Rules:
 * 1. Deterministic BaseAgent (per-turn step 5).
 * 2. NO model call.
 * 3. NO free text reading.
 * 4. NO accepted answer reading.
 * 5. Reads ONLY this session's prior persisted verifier results and hint levels.
 * 6. Computes schema-valid features:
 *    - repeated_wrong_value (boolean): true if the current wrong attempt repeats an earlier wrong answer in this session, or if prior attempts contain a repeated wrong value.
 *    - consecutive_unsuccessful (int >= 0): streak of consecutive unsuccessful attempts from prior attempts.
 *    - previous_progress ('advancing' | 'stalled' | 'none'): progress status of the most recent prior step/attempt.
 * 7. Hint Policy Engine derives `tone` from student_state using the closed set:
 *    ['neutral', 'encouraging', 'patient', 'supportive'].
 */

export const PREVIOUS_PROGRESS_VALUES = ["advancing", "stalled", "none"];

export const TONE_VALUES = [
  "neutral",      // Baseline / initial / default tone
  "encouraging",  // Progress advancing or positive forward momentum
  "patient",      // Repeated wrong values or stalled progress
  "supportive",   // Multiple consecutive unsuccessful attempts (>= 2)
];

/**
 * Normalises an attempt value for equality comparison.
 * Strips currency symbols, whitespace, and aligns numeric values (e.g. "15" and "15.0").
 */
function normalizeAttemptValue(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/^\$/, "").trim();
  if (!str) return null;
  const num = Number(str);
  if (!isNaN(num) && isFinite(num)) {
    return String(num);
  }
  return str.toLowerCase();
}

/**
 * Extracts the submitted student value from an attempt record.
 */
function extractAttemptValue(attempt) {
  if (!attempt) return null;
  if (attempt.canonical_value !== null && attempt.canonical_value !== undefined && attempt.canonical_value !== "") {
    return normalizeAttemptValue(attempt.canonical_value);
  }
  if (attempt.answer_text !== null && attempt.answer_text !== undefined && attempt.answer_text !== "") {
    return normalizeAttemptValue(attempt.answer_text);
  }
  if (Array.isArray(attempt.step_expressions) && attempt.step_expressions.length > 0) {
    return normalizeAttemptValue(attempt.step_expressions[0]);
  }
  return null;
}

/**
 * Checks whether an attempt is considered unsuccessful.
 * Per PRD §18 / SPEC: Unsuccessful means `incorrect`, stalled partial work, or `"I am not sure"`.
 */
function isAttemptUnsuccessful(attempt) {
  if (!attempt) return false;
  if (attempt.status === "incorrect") return true;
  if (attempt.response_type === "not_sure") return true;
  if (attempt.status === "partially_correct" && attempt.progress === "stalled") return true;
  return false;
}

/**
 * Checks whether an attempt is successful (resets consecutive_unsuccessful streak).
 */
function isAttemptSuccessful(attempt) {
  if (!attempt) return false;
  if (attempt.status === "correct") return true;
  if (attempt.status === "partially_correct" && attempt.progress === "advancing") return true;
  return false;
}

/**
 * Validates that a StudentState object conforms to the closed schema.
 */
export function validateStudentState(studentState) {
  if (!studentState || typeof studentState !== "object") {
    return { valid: false, errors: ["student_state must be an object"] };
  }
  const errors = [];
  if (typeof studentState.repeated_wrong_value !== "boolean") {
    errors.push("repeated_wrong_value must be a boolean");
  }
  if (
    typeof studentState.consecutive_unsuccessful !== "number" ||
    !Number.isInteger(studentState.consecutive_unsuccessful) ||
    studentState.consecutive_unsuccessful < 0
  ) {
    errors.push("consecutive_unsuccessful must be an integer >= 0");
  }
  if (!PREVIOUS_PROGRESS_VALUES.includes(studentState.previous_progress)) {
    errors.push(`previous_progress must be one of: ${PREVIOUS_PROGRESS_VALUES.join(", ")}`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Computes StudentState from prior persisted attempts and optional current attempt.
 *
 * @param {Object} params
 * @param {Array} params.priorAttempts - Persisted attempts in this session prior to this turn.
 * @param {Object} [params.currentAttempt] - Current attempt being evaluated (if available).
 * @returns {Object} StudentState: { repeated_wrong_value, consecutive_unsuccessful, previous_progress }
 */
export function estimateStudentState({ priorAttempts = [], currentAttempt = null } = {}) {
  const attempts = Array.isArray(priorAttempts) ? priorAttempts : [];

  // 1. Calculate previous_progress
  let previous_progress = "none";
  if (attempts.length > 0) {
    const lastAttempt = attempts[attempts.length - 1];
    if (lastAttempt && (lastAttempt.progress === "advancing" || lastAttempt.progress === "stalled")) {
      previous_progress = lastAttempt.progress;
    } else if (lastAttempt && lastAttempt.status === "partially_correct") {
      previous_progress = lastAttempt.progress || "advancing";
    }
  }

  // 2. Calculate consecutive_unsuccessful from prior attempts
  let consecutive_unsuccessful = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const att = attempts[i];
    if (isAttemptSuccessful(att)) {
      break;
    }
    if (isAttemptUnsuccessful(att)) {
      consecutive_unsuccessful += 1;
    }
  }

  // 3. Calculate repeated_wrong_value
  // Check if prior attempts had repeated wrong values
  const seenWrongValues = new Set();
  let priorHadRepeat = false;
  for (const att of attempts) {
    if (att.status === "incorrect") {
      const val = extractAttemptValue(att);
      if (val !== null) {
        if (seenWrongValues.has(val)) {
          priorHadRepeat = true;
          break;
        }
        seenWrongValues.add(val);
      }
    }
  }

  // Check if current attempt is wrong and repeats any prior wrong value
  let currentRepeatsPrior = false;
  if (currentAttempt) {
    const isCurrentWrong =
      currentAttempt.status === "incorrect" ||
      currentAttempt.status_post_overlay === "incorrect" ||
      (!currentAttempt.is_correct && currentAttempt.status !== "correct" && currentAttempt.status !== "partially_correct");

    if (isCurrentWrong) {
      const currentVal = extractAttemptValue(currentAttempt);
      if (currentVal !== null) {
        for (const att of attempts) {
          if (att.status === "incorrect") {
            const priorVal = extractAttemptValue(att);
            if (priorVal !== null && priorVal === currentVal) {
              currentRepeatsPrior = true;
              break;
            }
          }
        }
      }
    }
  }

  const repeated_wrong_value = priorHadRepeat || currentRepeatsPrior;

  const result = {
    repeated_wrong_value,
    consecutive_unsuccessful,
    previous_progress,
  };

  const validation = validateStudentState(result);
  if (!validation.valid) {
    throw new Error(`StudentState schema invalid: ${validation.errors.join("; ")}`);
  }

  return result;
}

/**
 * Derives the tutor tone from StudentState for HintPolicyEngine (WF-08).
 *
 * Rules:
 * - "patient": if student repeated a wrong value or progress is stalled.
 * - "supportive": if consecutive unsuccessful attempts >= 2.
 * - "encouraging": if previous_progress is advancing.
 * - "neutral": baseline / starting tone.
 *
 * @param {Object} studentState
 * @returns {string} One of TONE_VALUES
 */
export function deriveTone(studentState) {
  if (!studentState) return "neutral";

  if (studentState.repeated_wrong_value || studentState.previous_progress === "stalled") {
    return "patient";
  }

  if (studentState.consecutive_unsuccessful >= 2) {
    return "supportive";
  }

  if (studentState.previous_progress === "advancing") {
    return "encouraging";
  }

  return "neutral";
}

export const StudentStateEstimator = {
  estimate: estimateStudentState,
  deriveTone,
  validate: validateStudentState,
};
