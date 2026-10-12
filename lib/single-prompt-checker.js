/**
 * Single Prompt Checker (lib/single-prompt-checker.js)
 *
 * Implements the deterministic single_prompt verification rule from:
 * - PRD §6.1 STU-02
 * - SPEC §5.9, WF-09 step 2
 * - EVALS §14.5 C-FORMAT
 *
 * Specification:
 * "One question mark, or one sentence whose first word is try, look, find,
 * compare, write, or check, and not a second of either."
 *
 * Examples:
 * - "Look at the table. What is the ratio?" -> PASSES (1 imperative, 1 question mark, not a second of either)
 * - "Look at the table. Find the parts. What is the ratio?" -> FAILS (2 imperatives: Look, Find)
 * - "What is the ratio?" -> PASSES (0 imperatives, 1 question mark)
 * - "Look at the table." -> PASSES (1 imperative, 0 question marks)
 * - "What is Leo's share? What is Maya's share?" -> FAILS (2 question marks)
 */

export const ALLOWED_IMPERATIVE_VERBS = [
  "try",
  "look",
  "find",
  "compare",
  "write",
  "check",
];

export function checkSinglePrompt(text) {
  if (!text || typeof text !== "string") {
    return {
      passed: false,
      score: "single_prompt",
      question_count: 0,
      imperative_count: 0,
      reasons: ["Empty or non-string prompt text provided"],
    };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      passed: false,
      score: "single_prompt",
      question_count: 0,
      imperative_count: 0,
      reasons: ["Prompt text is empty"],
    };
  }

  // 1. Count question marks
  const questionMarks = (trimmed.match(/\?/g) || []).length;

  // 2. Split into sentences by sentence delimiters (. ? ! or newlines)
  // Lookbehind for delimiters followed by space or end of string
  const sentenceSegments = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let imperativeCount = 0;
  const imperativeSentences = [];

  for (const sentence of sentenceSegments) {
    // Strip leading non-alphanumeric characters (quotes, parens, brackets, etc.)
    const stripped = sentence.replace(/^[^a-zA-Z0-9]+/, "");
    const firstWordMatch = stripped.match(/^([a-zA-Z]+)/);
    if (firstWordMatch) {
      const firstWord = firstWordMatch[1].toLowerCase();
      if (ALLOWED_IMPERATIVE_VERBS.includes(firstWord)) {
        imperativeCount++;
        imperativeSentences.push(sentence);
      }
    }
  }

  // Acceptance criteria:
  // - Prompt has one question mark OR one sentence whose first word is [try, look, find, compare, write, check]
  // - Not a second of either (questionMarks <= 1 and imperativeCount <= 1)
  const hasAtLeastOne = questionMarks >= 1 || imperativeCount >= 1;
  const noSecondOfEither = questionMarks <= 1 && imperativeCount <= 1;
  const passed = hasAtLeastOne && noSecondOfEither;

  const reasons = [];
  if (!hasAtLeastOne) {
    reasons.push(
      "Prompt has neither a question mark nor an imperative starting with try, look, find, compare, write, or check"
    );
  }
  if (questionMarks > 1) {
    reasons.push(`Prompt has ${questionMarks} question marks (maximum allowed is 1)`);
  }
  if (imperativeCount > 1) {
    reasons.push(
      `Prompt has ${imperativeCount} imperative sentences (maximum allowed is 1): ${imperativeSentences.join(" | ")}`
    );
  }

  return {
    passed,
    score: "single_prompt",
    question_count: questionMarks,
    imperative_count: imperativeCount,
    imperative_sentences: imperativeSentences,
    reasons,
  };
}
