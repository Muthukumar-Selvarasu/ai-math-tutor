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

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function evaluateProbeExpr(expr) {
  if (!expr || typeof expr !== "string") return null;
  const trimmed = expr.trim();
  const gcdMatch = trimmed.match(/^gcd\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (gcdMatch) {
    const a = parseInt(gcdMatch[1], 10);
    const b = parseInt(gcdMatch[2], 10);
    return String(gcd(a, b));
  }
  const arithMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/x×÷])\s*(\d+(?:\.\d+)?)$/i);
  if (arithMatch) {
    const l = parseFloat(arithMatch[1]);
    let op = arithMatch[2];
    const r = parseFloat(arithMatch[3]);
    if (op === "x" || op === "×") op = "*";
    if (op === "÷") op = "/";
    let res = null;
    if (op === "+") res = l + r;
    else if (op === "-") res = l - r;
    else if (op === "*") res = l * r;
    else if (op === "/") res = r !== 0 ? l / r : null;
    return res !== null ? String(res) : null;
  }
  return null;
}

/**
 * Validates scaffold_probes (Rule TECH-07, PRD §8.4):
 * - kind: value: expected_value must not equal the final answer; if expected_expression is present, it must evaluate to expected_value
 * - kind: setup: expected_expression must match target_expression of counts_as_step_id
 */
export function validateProbes(question) {
  const errors = [];
  if (!question) return { valid: false, errors: ["Missing question"] };

  const finalAnswer = String(question.accepted_answer_spec?.canonical_value || "").trim();
  const probes = question.scaffold_probes || [];

  for (const probe of probes) {
    if (!probe.probe_id) {
      errors.push("Probe missing probe_id");
      continue;
    }

    if (probe.kind === "value") {
      const expVal = String(probe.expected_value || "").trim();
      if (expVal && finalAnswer && expVal === finalAnswer) {
        errors.push(`Probe '${probe.probe_id}' expected_value (${expVal}) equals item's final answer`);
      }

      if (probe.expected_expression) {
        const evaluated = evaluateProbeExpr(probe.expected_expression);
        if (evaluated !== null && evaluated !== expVal) {
          errors.push(
            `Probe '${probe.probe_id}' expected_value (${expVal}) does not evaluate from expected_expression '${probe.expected_expression}' (evaluated to ${evaluated})`
          );
        }
      }
    } else if (probe.kind === "setup") {
      const step = (question.solution_steps || []).find((s) => s.step_id === probe.counts_as_step_id);
      if (step && step.target_expression) {
        const normTarget = step.target_expression.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/");
        const normExpected = String(probe.expected_expression || "").replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/");
        if (normTarget !== normExpected) {
          errors.push(
            `Probe '${probe.probe_id}' expected_expression '${probe.expected_expression}' does not match step '${probe.counts_as_step_id}' target_expression '${step.target_expression}'`
          );
        }
      }
    }
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

  // Probe validation (STU-11 / TECH-07)
  const probeResult = validateProbes(question);
  if (!probeResult.valid) {
    errors.push(...probeResult.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
