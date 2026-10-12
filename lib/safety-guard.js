/**
 * Safety Guard Module (lib/safety-guard.js)
 *
 * Implements candidate verification rules from:
 * - PRD §9.4, SPEC §3.7, AG-10 (solvepath-safety)
 * - SPEC §5.7 (Student-facing language is respectful and non-shaming)
 * - SPEC §5.9 (age_appropriate, plain English, no sentence > 25 words)
 *
 * Rules:
 * 1. Verdict-only: Returns allow, block, revise, or escalate.
 * 2. Shaming: Strictly forbidden (e.g. "stupid", "idiot", "dumb", "you failed", "obviously").
 * 3. Peer Comparison: Strictly forbidden (e.g. "other students", "peers", "slower than").
 * 4. Ability Labels: Strictly forbidden (e.g. "smart", "bad at math", "slow learner", "genius").
 * 5. Taxonomy Code Leakage: Raw taxonomy codes are never shown to students.
 * 6. Sentence Length: No sentence over 25 words.
 * 7. Value Leakage: Forbidden strings (e.g. final answer) cannot appear below Level 5.
 */

import { MISCONCEPTION_TAXONOMY } from "./misconception-classifier";

const SHAMING_PATTERNS = [
  /\b(stupid|dumb|idiot|fool|foolish|careless|pathetic|terrible)\b/i,
  /\b(you failed|you are wrong|you're wrong|obviously wrong|that is silly|unacceptable)\b/i,
  /\b(how could you|why can't you|don't you know)\b/i,
];

const COMPARISON_PATTERNS = [
  /\b(other students|most students|peers|classmates)\b/i,
  /\b(slower than|faster than|behind others|ahead of others)\b/i,
  /\b(better than other|compared to)\b/i,
];

const ABILITY_LABEL_PATTERNS = [
  /\b(smart|gifted|genius|talented|bright)\b/i,
  /\b(bad at math|slow learner|unintelligent|incapable|low ability)\b/i,
];

export function checkSafetyGuard(text, { hint_level = 1, forbidden_strings = [] } = {}) {
  if (!text || typeof text !== "string") {
    return {
      schema_version: "1.0",
      verdict: "block",
      reason_code: "empty_text",
      violations: ["Candidate text is empty or not a string"],
      details: "Empty or invalid prompt text.",
    };
  }

  const violations = [];
  let reason_code = null;

  // 1. Shaming language check
  for (const pattern of SHAMING_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Contains shaming or disrespectful language: "${text.match(pattern)[0]}"`);
      reason_code = "shaming_language";
      break;
    }
  }

  // 2. Peer comparison check
  for (const pattern of COMPARISON_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Contains peer comparison: "${text.match(pattern)[0]}"`);
      if (!reason_code) reason_code = "peer_comparison";
      break;
    }
  }

  // 3. Ability label check
  for (const pattern of ABILITY_LABEL_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Contains ability or intelligence labelling: "${text.match(pattern)[0]}"`);
      if (!reason_code) reason_code = "ability_label";
      break;
    }
  }

  // 4. Taxonomy code leakage check
  const lowerText = text.toLowerCase();
  for (const code of MISCONCEPTION_TAXONOMY) {
    if (lowerText.includes(code.toLowerCase())) {
      violations.push(`Leaks raw taxonomy code to student: "${code}"`);
      if (!reason_code) reason_code = "taxonomy_leakage";
      break;
    }
  }

  // 5. Value leakage check (forbidden strings e.g. final answer below level 5)
  if (hint_level < 5 && forbidden_strings.length > 0) {
    for (const forbidden of forbidden_strings) {
      if (forbidden && text.includes(forbidden)) {
        violations.push(`Leaks forbidden answer string: "${forbidden}"`);
        if (!reason_code) reason_code = "forbidden_value_leakage";
        break;
      }
    }
  }

  // 6. Sentence length check (plain English, no sentence > 25 words)
  const sentences = text
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

  if (violations.length > 0) {
    const isBlock =
      reason_code === "shaming_language" ||
      reason_code === "peer_comparison" ||
      reason_code === "ability_label" ||
      reason_code === "taxonomy_leakage" ||
      reason_code === "forbidden_value_leakage";
    return {
      schema_version: "1.0",
      verdict: isBlock ? "block" : "revise",
      reason_code,
      violations,
      details: violations.join("; "),
    };
  }

  return {
    schema_version: "1.0",
    verdict: "allow",
    reason_code: null,
    violations: [],
    details: "Candidate passed all safety and plain English checks.",
  };
}
