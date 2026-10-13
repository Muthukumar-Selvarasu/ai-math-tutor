import fs from "fs";
import path from "path";

/**
 * Labelled Evaluation Suite Engine (ADM-10, PRD §14.1, §14.5, §21.2)
 *
 * Enforces:
 * 1. Tier 1 suite (Gate A): exactly 42 critical cases:
 *    - 15 direct_answer
 *    - 15 prompt_injection
 *    - 12 unsafe_input
 * 2. Tier 2 launch suite: at least 150 unique labelled cases:
 *    - One primary category each
 *    - At least one case in every PRD Section 14.1 category (all 17 categories)
 *    - Full critical targets: 15 direct-answer, 15 prompt-injection, 12 unsafe-input cases
 */

export const PRD_14_1_CATEGORIES = [
  "correct_varied_formats",
  "incorrect_arithmetic",
  "ratio_reversal",
  "ratio_additive_interpretation",
  "unit_conversion_mistakes",
  "partially_correct_working",
  "ambiguous_messages",
  "multiple_valid_methods",
  "direct_answer",
  "prompt_injection",
  "unsafe_input",
  "safety_guard_unreachable",
  "session_resume_idempotent",
  "insight_draft_wording",
  "diagram_dependent",
  "unsupported_malformed",
  "teacher_summary_accuracy",
];

export const CRITICAL_TARGETS = {
  direct_answer: 15,
  prompt_injection: 15,
  unsafe_input: 12,
};

/**
 * Resolves absolute path to evaluation dataset
 */
export function getSuitePath(suiteName = "tier1_critical") {
  const fileName = suiteName.endsWith(".jsonl") ? suiteName : `${suiteName}.jsonl`;
  return path.resolve(process.cwd(), "content", "eval", fileName);
}

/**
 * Loads evaluation suite from JSONL file
 */
export function loadEvaluationSuite(suiteName = "tier1_critical") {
  const filePath = getSuitePath(suiteName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Evaluation suite not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`Malformed JSON on line ${idx + 1} of ${filePath}: ${err.message}`);
    }
  });
}

/**
 * Validates suite against PRD ADM-10 acceptance criteria
 */
export function validateEvaluationSuite(suiteName = "tier1_critical") {
  const cases = loadEvaluationSuite(suiteName);
  const seenIds = new Set();
  const categoryCounts = {};
  const violations = [];

  // Initialize category counts
  for (const cat of PRD_14_1_CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  let criticalCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    // ID uniqueness
    if (!c.id) {
      violations.push(`Case index ${i} is missing id`);
    } else if (seenIds.has(c.id)) {
      violations.push(`Duplicate case id: ${c.id}`);
    } else {
      seenIds.add(c.id);
    }

    // Category validity: exactly one primary category
    if (!c.category || !PRD_14_1_CATEGORIES.includes(c.category)) {
      violations.push(`Case ${c.id || i} has invalid category '${c.category}'`);
    } else {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    }

    if (c.critical === true) {
      criticalCount += 1;
    }

    if (!c.input) {
      violations.push(`Case ${c.id || i} is missing input object`);
    }
    if (!c.expected) {
      violations.push(`Case ${c.id || i} is missing expected object`);
    }
  }

  // Tier 1 Critical Suite requirements
  if (suiteName.includes("tier1") || suiteName.includes("critical")) {
    if (cases.length !== 42) {
      violations.push(`Tier 1 suite must have exactly 42 cases, got ${cases.length}`);
    }
    if (categoryCounts["direct_answer"] !== 15) {
      violations.push(`Tier 1 suite must have 15 direct_answer cases, got ${categoryCounts["direct_answer"]}`);
    }
    if (categoryCounts["prompt_injection"] !== 15) {
      violations.push(`Tier 1 suite must have 15 prompt_injection cases, got ${categoryCounts["prompt_injection"]}`);
    }
    if (categoryCounts["unsafe_input"] !== 12) {
      violations.push(`Tier 1 suite must have 12 unsafe_input cases, got ${categoryCounts["unsafe_input"]}`);
    }
  }

  // Tier 2 Launch Suite requirements
  if (suiteName.includes("tier2") || suiteName.includes("launch")) {
    if (cases.length < 150) {
      violations.push(`Tier 2 launch suite must have at least 150 unique cases, got ${cases.length}`);
    }
    // Verify at least one case in every PRD Section 14.1 category
    for (const cat of PRD_14_1_CATEGORIES) {
      if (!categoryCounts[cat] || categoryCounts[cat] === 0) {
        violations.push(`Tier 2 launch suite missing representation for category '${cat}'`);
      }
    }
    // Verify full critical targets
    if (categoryCounts["direct_answer"] < 15) {
      violations.push(`Tier 2 launch suite must have >= 15 direct_answer cases, got ${categoryCounts["direct_answer"]}`);
    }
    if (categoryCounts["prompt_injection"] < 15) {
      violations.push(`Tier 2 launch suite must have >= 15 prompt_injection cases, got ${categoryCounts["prompt_injection"]}`);
    }
    if (categoryCounts["unsafe_input"] < 12) {
      violations.push(`Tier 2 launch suite must have >= 12 unsafe_input cases, got ${categoryCounts["unsafe_input"]}`);
    }
  }

  return {
    valid: violations.length === 0,
    suite_name: suiteName,
    total_cases: cases.length,
    critical_cases: criticalCount,
    category_counts: categoryCounts,
    unique_ids_count: seenIds.size,
    violations,
  };
}
