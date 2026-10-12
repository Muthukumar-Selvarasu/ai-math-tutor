/**
 * Input Screen Engine (lib/input-screen.js)
 *
 * Implements deterministic input screening from:
 * - PRD §8.3.1 (Input Screen, 6 categories: answer_request, abuse, assessment_help,
 *   impersonation, worrying_disclosure, injection_phrase)
 * - SPEC §3.9, AG-01 (ProblemContextAgent)
 *
 * On a hit:
 * - Turn short-circuits
 * - Verifier, model, and hint level are untouched
 * - No attempt is counted
 * - Returns authored canned reply from content/safety/canned_responses.json
 * - Logs safety event to audit trail
 */

import { getCannedResponse } from "./canned-responses.js";
import inputLexicon from "../content/safety/input_lexicon.json";

// Order of evaluation specified in architecture
const CATEGORY_ORDER = [
  "injection_phrase",
  "worrying_disclosure",
  "abuse",
  "assessment_help",
  "impersonation",
  "answer_request",
];

// Compile patterns from input_lexicon.json
const COMPILED_PATTERNS = {};
for (const cat of CATEGORY_ORDER) {
  const patternList = (inputLexicon.categories && inputLexicon.categories[cat]) || [];
  COMPILED_PATTERNS[cat] = patternList.map((p) => new RegExp(p, "i"));
}

export const SYNTHETIC_UNSAFE_FIXTURES = inputLexicon.synthetic_unsafe_fixtures || [];

export function inputScreen(text) {
  if (!text || typeof text !== "string") {
    return { hit: false, category: null, canned_key: null, text: null };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { hit: false, category: null, canned_key: null, text: null };
  }

  for (const category of CATEGORY_ORDER) {
    const patterns = COMPILED_PATTERNS[category] || [];
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        const cannedKey = `${category}_reply`;
        return {
          hit: true,
          category,
          canned_key: cannedKey,
          text: getCannedResponse(cannedKey),
        };
      }
    }
  }

  return { hit: false, category: null, canned_key: null, text: null };
}

/**
 * Evaluates recall of the Input Screen on the 12 synthetic unsafe fixtures
 * Target: at least 0.90 recall (PRD §8.3.1, EVALS DS-11, SPEC WF-05).
 * A report, not a safeguarding claim.
 */
export function evaluateUnsafeFixturesRecall(fixtures = SYNTHETIC_UNSAFE_FIXTURES) {
  if (!fixtures || fixtures.length === 0) {
    return { total: 0, matched: 0, recall: 0, target: 0.9, passed: false, details: [] };
  }

  let matched = 0;
  const details = fixtures.map((fixture) => {
    const result = inputScreen(fixture.text);
    const isCorrect = result.hit && result.category === fixture.expected_category;
    if (isCorrect) {
      matched += 1;
    }
    return {
      id: fixture.id,
      text: fixture.text,
      expected: fixture.expected_category,
      actual: result.category,
      hit: result.hit,
      passed: isCorrect,
    };
  });

  const recall = matched / fixtures.length;
  return {
    total: fixtures.length,
    matched,
    recall,
    target: 0.9,
    passed: recall >= 0.9,
    details,
  };
}
