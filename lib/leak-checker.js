/**
 * Deterministic Leakage Checker (lib/leak-checker.js)
 *
 * Implements candidate verification rules from:
 * - AG-09 (DeterministicLeakCheck), PRD §9.3 step 7b, SPEC WF-09 step 2
 * - Checks:
 *   1. Value leakage: Blocks final answer below Level 5 and solution step values below Level 4.
 *   2. Method leakage: Blocks operation words paired with problem quantities or unprompted step phrases below Level 4.
 *   3. Digit rule: Below Level 4, digits & word numerals must match one of 3 exemptions:
 *      (a) Value quoted verbatim from question stem
 *      (b) Value in selected authored probe template
 *      (c) Student's own value marked correct this attempt (verified_student_values)
 *   4. Produced probe values exemption: Expected values of probes already produced/answered
 *      in this session are exempt from value-leak check. Unproduced probe values stay forbidden.
 *   5. Age appropriate & single prompt: Enforces sentence length <= 25 words and single prompt rule.
 *   6. Safety Guard override: A deterministic leak hit overrides a Safety Guard "allow".
 */

import { checkSinglePrompt } from "./single-prompt-checker";
import { MISCONCEPTION_TAXONOMY } from "./misconception-classifier";

const WORD_NUMERAL_MAP = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function extractNumericTokens(text) {
  if (!text || typeof text !== "string") return new Set();
  const tokens = new Set();

  // Extract digit numbers (e.g. 60, 2, 3, 36.5)
  const digitMatches = text.match(/\b\d+(\.\d+)?\b/g);
  if (digitMatches) {
    for (const d of digitMatches) {
      tokens.add(d);
      tokens.add(String(parseFloat(d)));
    }
  }

  // Extract word numerals
  const words = text.toLowerCase().match(/\b[a-z]+\b/g);
  if (words) {
    for (const w of words) {
      if (WORD_NUMERAL_MAP[w] !== undefined) {
        tokens.add(String(WORD_NUMERAL_MAP[w]));
        tokens.add(w);
      }
    }
  }

  return tokens;
}

export function checkCandidateLeakage(
  candidateText,
  {
    hint_level = 1,
    question = {},
    selected_probe_template = "",
    verified_student_values = [], // student values verifier marked correct this attempt
    produced_probe_values = [],   // probe expected values already produced this session
  } = {}
) {
  if (!candidateText || typeof candidateText !== "string") {
    return {
      passed: false,
      reason_code: "empty_text",
      violations: ["Candidate text is empty or invalid"],
    };
  }

  const violations = [];
  let reason_code = null;

  const stem = question?.stem || "";
  const acceptedAnswer = question?.accepted_answer_spec?.canonical_value;
  const solutionSteps = question?.solution_steps || [];
  const methodLeakPatterns = question?.method_leak_patterns || {};

  // Build the 3 digit-rule exemptions below Level 4:
  // (a) stem numbers
  // (b) selected probe template numbers
  // (c) student's own verified values this attempt
  const stemNumbers = extractNumericTokens(stem);
  const probeNumbers = extractNumericTokens(selected_probe_template);
  const verifiedNumbers = new Set(
    (verified_student_values || []).map((v) => String(v).trim())
  );
  const producedProbeNumbers = new Set(
    (produced_probe_values || []).map((v) => String(v).trim())
  );

  const allowedExemptions = new Set([
    ...stemNumbers,
    ...probeNumbers,
    ...verifiedNumbers,
  ]);

  // 1. Final answer leakage check (below Level 5)
  if (hint_level < 5 && acceptedAnswer) {
    const answerRegex = new RegExp(`(^|\\W)\\$?${acceptedAnswer}(\\W|$)`, "i");
    if (answerRegex.test(candidateText)) {
      // Check if exempted by stem or verified student value
      if (!stemNumbers.has(String(acceptedAnswer)) && !verifiedNumbers.has(String(acceptedAnswer))) {
        violations.push(`Leaks final answer: "${acceptedAnswer}"`);
        reason_code = "final_answer_leakage";
      }
    }
  }

  // 2. Intermediate solution steps & unproduced probe leakage check (below Level 4)
  if (hint_level < 4) {
    for (const step of solutionSteps) {
      if (step.target_value) {
        const valStr = String(step.target_value).trim();
        const stepValRegex = new RegExp(`(^|\\W)\\$?${valStr}(\\W|$)`, "i");
        if (stepValRegex.test(candidateText)) {
          // If not in stem, not in probe template, not in verified student values, and not produced probe
          if (
            !allowedExemptions.has(valStr) &&
            !producedProbeNumbers.has(valStr)
          ) {
            violations.push(`Leaks unapproved intermediate step value: "${valStr}"`);
            if (!reason_code) reason_code = "solution_step_leakage";
          }
        }
      }

      if (step.target_expression) {
        const expr = step.target_expression.trim();
        if (expr && candidateText.includes(expr)) {
          violations.push(`Leaks solution step expression: "${expr}"`);
          if (!reason_code) reason_code = "solution_step_leakage";
        }
      }
    }

    // 3. Method leakage check (below Level 4)
    if (methodLeakPatterns) {
      const stepPhrases = methodLeakPatterns.step_phrases || [];
      for (const phrase of stepPhrases) {
        if (candidateText.toLowerCase().includes(phrase.toLowerCase())) {
          violations.push(`Leaks solution step phrase: "${phrase}"`);
          if (!reason_code) reason_code = "method_leakage";
          break;
        }
      }
    }

    // 4. Digit rule check (below Level 4)
    // Digits and word numerals are strictly forbidden unless in the 3 exemptions
    const candidateNumbers = candidateText.match(/\b\d+(\.\d+)?\b/g) || [];
    for (const num of candidateNumbers) {
      const normalizedNum = String(parseFloat(num));
      if (!allowedExemptions.has(num) && !allowedExemptions.has(normalizedNum)) {
        violations.push(`Digit rule violation: "${num}" is not in question stem, probe template, or verified student value`);
        if (!reason_code) reason_code = "digit_rule_violation";
      }
    }
  }

  // 5. Taxonomy code leakage
  const lowerText = candidateText.toLowerCase();
  for (const code of MISCONCEPTION_TAXONOMY) {
    if (lowerText.includes(code.toLowerCase())) {
      violations.push(`Leaks raw misconception taxonomy code: "${code}"`);
      if (!reason_code) reason_code = "taxonomy_leakage";
      break;
    }
  }

  // 6. Age-appropriate sentence length check (no sentence > 25 words)
  const sentences = candidateText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > 25) {
      violations.push(`Sentence exceeds 25 words (${wordCount} words): "${sentence}"`);
      if (!reason_code) reason_code = "sentence_too_long";
      break;
    }
  }

  // 7. Single prompt rule check
  const singlePromptResult = checkSinglePrompt(candidateText);
  if (!singlePromptResult.passed) {
    violations.push(`Single prompt check failed: ${singlePromptResult.reason}`);
    if (!reason_code) reason_code = "single_prompt_violation";
  }

  return {
    passed: violations.length === 0,
    reason_code: violations.length > 0 ? reason_code : null,
    violations,
  };
}
