/**
 * RetrievalGate Module (lib/retrieval-gate.js)
 *
 * Implements RetrievalGate (AG-04) from:
 * - PRD §6 STU-15, §9.3, §9.8, §10.5, §11.3, §21
 * - SPEC §2.4, §3.6, §4 (WF-07), D-26, D-36
 * - AGENTS.md §2.6 (AG-04 RetrievalGate), §4.2
 *
 * Gate Rules:
 * 1. Open ONLY for:
 *    - post-overlay status is 'incorrect' without deterministic match
 *    - post-overlay status is 'cannot_verify' with state='ok' (and parsed/non-null canonical_value)
 * 2. Closed for:
 *    - status is 'correct' or 'partially_correct' (records retrieval: 'skipped', misconception: 'none')
 *    - state is 'tool_failure' (records retrieval: 'skipped', misconception: 'none'; status is 'cannot_verify')
 *    - deterministic match hit (records retrieval: 'skipped', classifier skipped)
 *    - unparsed input (canonical_value null; skips retrieval and classifier)
 * 3. Tier 1a (Gate A):
 *    - Gate runs but exemplar source is an empty stub that returns an empty list.
 *    - Turn records retrieval: 'empty', exemplars: [].
 *    - Real exact-SQL exemplar query, authoring, and MCP search_exemplars arrive in Tier 1b.
 * 4. When cannot_verify with state='ok' and no matched step:
 *    - Classifier label is forced to 'insufficient_evidence', exemplars_used: 'none'.
 * 5. Numbers-only retrieval query:
 *    - Query contains only skill_id, error_category, canonical numeric student value, relation tags, taxonomy_version.
 *    - Prompt-capture guard: zero student free text in query.
 * 6. Cache contract:
 *    - Tier 1a has NO cache (isCacheEnabled() === false).
 *    - Gate B exact-key cache format documented and verified.
 * 7. Taxonomy:
 *    - Closed 13-value taxonomy enum verified.
 */

import crypto from "crypto";
import { MISCONCEPTION_TAXONOMY } from "./misconception-classifier";

export { MISCONCEPTION_TAXONOMY };

/**
 * Validates that a retrieval query adheres strictly to the numbers-only schema
 * and contains ZERO student free text (Prompt-capture guard, SPEC §3.6, PRD §21).
 */
export function validateRetrievalQuery(query) {
  if (!query || typeof query !== "object") {
    throw new Error("Retrieval query must be an object");
  }

  // Reject free text fields if passed
  if (query.free_text || query.student_text || query.raw_input || query.student_name) {
    throw new Error("Prompt-capture guard violation: student free text detected in retrieval query");
  }

  // Canonical value must be numeric/ratio/empty, never natural language free text
  if (query.canonical_value !== undefined && query.canonical_value !== null) {
    const valStr = String(query.canonical_value).trim();
    // Allow numbers, decimals, negative numbers, fractions, ratios (e.g. "30", "11.5", "-4", "2/3", "2:3")
    const isNumericOrRatio = /^[-+]?(\d+(\.\d+)?|\d+\/\d+|\d+:\d+)?$/.test(valStr);
    if (valStr.length > 0 && !isNumericOrRatio) {
      throw new Error(
        `Prompt-capture guard violation: canonical_value "${valStr}" contains non-numeric free text`
      );
    }
  }

  // Validate relation tags
  if (query.relation_tags && !Array.isArray(query.relation_tags)) {
    throw new Error("relation_tags must be an array of strings");
  }

  return true;
}

/**
 * Tier 1a empty exemplar stub (AG-04, PRD §9.8, ADR-014).
 * Validates the numbers-only query and returns an empty exemplar set.
 */
export function searchExemplarsStub(query) {
  validateRetrievalQuery(query);

  return {
    exemplars: [],
    retrieval: "empty",
    tier: "1a",
    source: "empty_stub",
  };
}

/**
 * Evaluates the RetrievalGate decision for a turn.
 *
 * @param {Object} params
 * @param {string} params.status - post-overlay verifier status ('correct', 'partially_correct', 'incorrect', 'cannot_verify')
 * @param {string} params.state - verifier state ('ok', 'tool_failure', 'unverified')
 * @param {Object|null} params.deterministic_match - authored predicted response match if any
 * @param {boolean} [params.has_canonical_value=true] - whether student response parsed to a canonical value
 * @param {string} [params.input_kind] - 'value', 'ratio', 'expression', 'unparsed'
 * @param {string} [params.skill_id]
 * @param {string} [params.error_category]
 * @param {string|number} [params.canonical_value]
 * @param {string[]} [params.relation_tags]
 * @param {string} [params.taxonomy_version="1.0.0"]
 * @returns {Object} { gate_open, reason, retrieval, misconception, exemplars, query }
 */
export function evaluateRetrievalGate({
  status,
  state = "ok",
  deterministic_match = null,
  has_canonical_value = true,
  input_kind = "value",
  skill_id = "ratio_division",
  error_category = null,
  canonical_value = null,
  relation_tags = [],
  taxonomy_version = "1.0.0",
} = {}) {
  // Case 1: State is tool_failure -> Gate CLOSED
  if (state === "tool_failure") {
    return {
      gate_open: false,
      reason: "tool_failure",
      retrieval: "skipped",
      misconception: "none",
      exemplars: [],
      query: null,
    };
  }

  // Case 2: Status is correct or partially_correct -> Gate CLOSED
  if (status === "correct" || status === "partially_correct") {
    return {
      gate_open: false,
      reason: status === "correct" ? "correct_answer" : "partially_correct_answer",
      retrieval: "skipped",
      misconception: "none",
      exemplars: [],
      query: null,
    };
  }

  // Case 3: Deterministic misconception match hit -> Gate CLOSED
  if (deterministic_match) {
    const code = deterministic_match.misconception_code || deterministic_match.code || "none";
    return {
      gate_open: false,
      reason: "deterministic_match",
      retrieval: "skipped",
      misconception: code,
      exemplars: [],
      query: null,
    };
  }

  // Case 4: Unparsed input or cannot_verify without canonical value -> Gate CLOSED
  if (input_kind === "unparsed" || (!has_canonical_value && status === "cannot_verify")) {
    return {
      gate_open: false,
      reason: "unparsed_input",
      retrieval: "skipped",
      misconception: "none",
      exemplars: [],
      query: null,
    };
  }

  // Build the numbers-only query for open gate
  const query = {
    skill_id: String(skill_id || ""),
    error_category: error_category || null,
    canonical_value: canonical_value !== null && canonical_value !== undefined ? String(canonical_value) : null,
    relation_tags: Array.isArray(relation_tags) ? relation_tags : [],
    taxonomy_version: taxonomy_version || "1.0.0",
  };

  // Case 5: Status is cannot_verify with state=ok (parsed expression) -> Gate OPENS
  if (status === "cannot_verify" && state === "ok") {
    const stubResult = searchExemplarsStub(query);
    return {
      gate_open: true,
      reason: "cannot_verify_parsed",
      retrieval: stubResult.retrieval, // "empty" at Tier 1a
      misconception: "insufficient_evidence", // Orchestrator forces insufficient_evidence
      exemplars: stubResult.exemplars,
      query,
    };
  }

  // Case 6: Status is incorrect without match -> Gate OPENS
  if (status === "incorrect") {
    const stubResult = searchExemplarsStub(query);
    return {
      gate_open: true,
      reason: "incorrect_unmatched",
      retrieval: stubResult.retrieval, // "empty" at Tier 1a
      misconception: null,
      exemplars: stubResult.exemplars,
      query,
    };
  }

  // Fallback safe closure
  return {
    gate_open: false,
    reason: "default_closed",
    retrieval: "skipped",
    misconception: "none",
    exemplars: [],
    query: null,
  };
}

/**
 * Cache contracts:
 * At Tier 1a (Gate A), exact-key cache is NOT built / disabled.
 * At Tier 1b (Gate B), cache_entry uses an exact sha256 hash.
 */
export function isRetrievalCacheEnabled() {
  return false; // Tier 1a has no cache (SPEC D-32, D-36, TECHNICAL §3)
}

export function buildExemplarCacheKey({
  error_category = "",
  skill_id = "",
  taxonomy_version = "1.0.0",
  canonical_value = "",
  relation_tags = [],
} = {}) {
  const sortedTags = Array.isArray(relation_tags) ? [...relation_tags].sort().join(",") : "";
  const keyRaw = `exemplar_query:${skill_id}:${error_category}:${taxonomy_version}:${canonical_value}:${sortedTags}`;
  return crypto.createHash("sha256").update(keyRaw).digest("hex");
}
