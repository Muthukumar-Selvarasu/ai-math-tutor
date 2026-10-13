import { getQuestion, listQuestions } from "./question-loader.js";

/**
 * Computes greatest common divisor of two integers.
 */
function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Extracts and simplifies a two-term ratio from a question stem or canonical value.
 * Returns a string like "2:3" or null if no ratio found.
 */
export function extractSimplifiedRatio(question) {
  if (!question) return null;

  // Check accepted answer spec if ratio type
  if (question.accepted_answer_spec?.type === "ratio") {
    const val = String(question.accepted_answer_spec.canonical_value || "").trim();
    const parts = val.split(/[:]/).map((s) => parseInt(s.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
      const g = gcd(parts[0], parts[1]);
      return `${parts[0] / g}:${parts[1] / g}`;
    }
  }

  // Check stem for patterns like "ratio 2 : 3" or "ratio 2:3"
  const stem = question.stem || "";
  const match = stem.match(/ratio\s+(\d+)\s*:\s*(\d+)/i) || stem.match(/(\d+)\s*:\s*(\d+)/);
  if (match) {
    const a = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
      const g = gcd(a, b);
      return `${a / g}:${b / g}`;
    }
  }

  return null;
}

/**
 * Normalises a canonical answer value for equality comparison.
 */
function normaliseAnswerValue(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim().replace(/^\$/, "").toLowerCase();
}

/**
 * Deterministically selects a near-transfer question partner for a completed question (WF-10).
 *
 * Rules:
 * 1. Shortlist: published, approved, unflagged items with the same learning objective.
 * 2. Legality filter (Skill Graph):
 *    - Rejects items needing a skill the student has not been taught (must be in taughtSkills or cohortStartingSkills).
 *    - Rejects items whose accepted value matches the completed item.
 *    - Rejects items whose simplified ratio matches the completed item.
 * 3. Tie-break: lowest question_id (alphabetically).
 *
 * @param {Object} options
 * @param {Object} options.completedQuestion
 * @param {Array<Object>} [options.questionBank]
 * @param {Array<string>} [options.taughtSkills]
 * @param {Array<string>} [options.cohortStartingSkills]
 * @returns {Object|null} Selected transfer question partner, or null if none legal.
 */
export function selectTransferPartner({
  completedQuestion,
  questionBank,
  taughtSkills = [],
  cohortStartingSkills = [],
}) {
  if (!completedQuestion) return null;

  // Load bank if not provided
  let bank = questionBank;
  if (!bank) {
    const questionList = listQuestions();
    bank = questionList
      .map((item) => getQuestion(item.question_id))
      .filter(Boolean);
  }

  const completedAns = normaliseAnswerValue(completedQuestion.accepted_answer_spec?.canonical_value);
  const completedRatio = extractSimplifiedRatio(completedQuestion);

  // Default taught skills include the completed item's skill
  const legalSkills = new Set([
    completedQuestion.skill_id,
    ...taughtSkills,
    ...cohortStartingSkills,
  ]);

  // Candidates filter
  const eligibleCandidates = bank.filter((candidate) => {
    // Cannot be the same question
    if (candidate.question_id === completedQuestion.question_id) {
      return false;
    }

    // Must be published and unflagged
    const isPublished = candidate.publication_status === "published" || candidate.publication_status === undefined;
    const isApproved = candidate.validation_status === "approved" || candidate.validation_status === undefined;
    const isUnflagged = !candidate.flagged;

    if (!isPublished || !isApproved || !isUnflagged) {
      return false;
    }

    // Must have the same learning objective (or same skill_id)
    if (candidate.learning_objective && completedQuestion.learning_objective) {
      if (candidate.learning_objective !== completedQuestion.learning_objective) {
        return false;
      }
    } else if (candidate.skill_id !== completedQuestion.skill_id) {
      return false;
    }

    // Skill graph check: Reject if candidate requires an untaught skill
    if (candidate.skill_id && !legalSkills.has(candidate.skill_id)) {
      return false;
    }

    // Rejects an item whose accepted canonical value matches completed item
    const candAns = normaliseAnswerValue(candidate.accepted_answer_spec?.canonical_value);
    if (candAns && completedAns && candAns === completedAns) {
      return false;
    }

    // Rejects an item whose simplified ratio matches completed item
    const candRatio = extractSimplifiedRatio(candidate);
    if (candRatio && completedRatio && candRatio === completedRatio) {
      return false;
    }

    return true;
  });

  if (eligibleCandidates.length === 0) {
    return null;
  }

  // Deterministic tie-break at Tier 1a: lowest question_id
  eligibleCandidates.sort((a, b) => a.question_id.localeCompare(b.question_id));

  return eligibleCandidates[0];
}
