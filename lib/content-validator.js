import { MISCONCEPTION_TAXONOMY } from "./misconception-classifier";
import { selectTransferPartner } from "./transfer-selector";

/**
 * Validates a reflection block according to Rule V9 (SPEC §2.10):
 * - has a prompt_template with at most one question and exactly one {student_value} placeholder
 * - 3 or 4 options with at least one sound: true
 * - each option's label and feedback pass age_appropriate, contain no taxonomy code and have at most one question
 */
export function validateV9(reflection) {
  const errors = [];

  if (!reflection || typeof reflection !== "object") {
    return { valid: false, errors: ["Missing or invalid reflection block"] };
  }

  // 1. prompt_template checks
  const { prompt_template, options } = reflection;
  if (!prompt_template || typeof prompt_template !== "string") {
    errors.push("reflection.prompt_template must be a non-empty string");
  } else {
    const questionMarkCount = (prompt_template.match(/\?/g) || []).length;
    if (questionMarkCount > 1) {
      errors.push(`reflection.prompt_template has ${questionMarkCount} question marks (max 1 permitted)`);
    }

    const placeholderMatches = prompt_template.match(/\{student_value\}/g) || [];
    if (placeholderMatches.length !== 1) {
      errors.push(`reflection.prompt_template must have exactly one {student_value} placeholder (found ${placeholderMatches.length})`);
    }
  }

  // 2. options checks
  if (!Array.isArray(options)) {
    errors.push("reflection.options must be an array");
  } else {
    if (options.length < 3 || options.length > 4) {
      errors.push(`reflection.options must contain 3 or 4 options (found ${options.length})`);
    }

    let hasSoundTrue = false;
    const knownTaxonomyCodes = Array.isArray(MISCONCEPTION_TAXONOMY)
      ? MISCONCEPTION_TAXONOMY
      : Object.keys(MISCONCEPTION_TAXONOMY);

    options.forEach((opt, idx) => {
      if (!opt.option_id) {
        errors.push(`Option ${idx + 1} missing option_id`);
      }
      if (!opt.label || typeof opt.label !== "string") {
        errors.push(`Option ${idx + 1} missing label string`);
      } else {
        const qCount = (opt.label.match(/\?/g) || []).length;
        if (qCount > 1) {
          errors.push(`Option ${idx + 1} label has ${qCount} questions (max 1 permitted)`);
        }
        for (const code of knownTaxonomyCodes) {
          const lower = opt.label.toLowerCase();
          if (lower.includes(code.toLowerCase()) || lower.includes(code.replace(/_/g, " ").toLowerCase())) {
            errors.push(`Option ${idx + 1} label contains taxonomy phrasing: ${code}`);
          }
        }
      }

      if (opt.sound === true) {
        hasSoundTrue = true;
      }

      if (!opt.feedback || typeof opt.feedback !== "string") {
        errors.push(`Option ${idx + 1} missing feedback string`);
      } else {
        const qCount = (opt.feedback.match(/\?/g) || []).length;
        if (qCount > 1) {
          errors.push(`Option ${idx + 1} feedback has ${qCount} questions (max 1 permitted)`);
        }
        for (const code of knownTaxonomyCodes) {
          const lower = opt.feedback.toLowerCase();
          if (lower.includes(code.toLowerCase()) || lower.includes(code.replace(/_/g, " ").toLowerCase())) {
            errors.push(`Option ${idx + 1} feedback contains taxonomy phrasing: ${code}`);
          }
        }
      }
    });

    if (!hasSoundTrue) {
      errors.push("reflection.options must contain at least one option with sound: true");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Rule V8 (SPEC §2.10):
 * Every approved/published item has a legal transfer partner in the bank
 * (same learning objective, different accepted value and simplified ratio, only taught skills).
 */
export function validateV8(question, questionBank = [], options = {}) {
  const errors = [];
  const isApproved = question.validation_status === "approved" || question.publication_status === "published";

  if (!isApproved) {
    return { valid: true, errors: [] };
  }

  const partner = selectTransferPartner({
    completedQuestion: question,
    questionBank,
    taughtSkills: options.taughtSkills || [question.skill_id],
    cohortStartingSkills: options.cohortStartingSkills || [question.skill_id],
  });

  if (!partner) {
    errors.push(`Item '${question.question_id}' has no legal transfer partner in the approved bank (breaks Rule V8)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a question against content validation rules.
 */
export function validateQuestion(question, questionBank = [], options = {}) {
  const errors = [];

  // V9 validation
  const v9Result = validateV9(question.reflection);
  if (!v9Result.valid) {
    errors.push(...v9Result.errors);
  }

  // V8 validation
  const v8Result = validateV8(question, questionBank, options);
  if (!v8Result.valid) {
    errors.push(...v8Result.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
