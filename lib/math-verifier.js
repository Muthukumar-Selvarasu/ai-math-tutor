// Deterministic Mathematics Verifier (MathVerifierAgent, AG-02)
// Implements PRD §8.4 FR-04, SPEC §2.4, §3.6, §3.9, and WF-06

import { normalise } from "./normaliser";

export const ERROR_CATEGORIES = [
  "none",
  "arithmetic",
  "unit_error",
  "missing_unit",
  "incomplete",
  "additive_difference_match",
  "reversed_ratio_match",
  "inverse_operation_match",
  "unknown_numeric_discrepancy",
];

export const RELATION_TAGS = [
  "none",
  "sum_of_givens",
  "difference_of_givens",
  "swapped_ratio",
  "inverse_of_answer",
  "wrong_unit_scale",
];

// In-process exact-key cache for PureVerifierResult (Phase A / Tier 1a in-process; Tier 1b cache store)
const verifierCache = new Map();

export function clearVerifierCache() {
  verifierCache.clear();
}

export function getVerifierCache(key) {
  if (key === undefined) return verifierCache;
  return verifierCache.get(key) || null;
}

export function getVerifierCacheSize() {
  return verifierCache.size;
}

export function deriveRelationTags(errorCategory, context = {}) {
  switch (errorCategory) {
    case "additive_difference_match":
      if (context.tag && RELATION_TAGS.includes(context.tag)) {
        return [context.tag];
      }
      return ["difference_of_givens"];
    case "reversed_ratio_match":
      return ["swapped_ratio"];
    case "inverse_operation_match":
      return ["inverse_of_answer"];
    case "unit_error":
      return ["wrong_unit_scale"];
    default:
      return ["none"];
  }
}

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Simplifies a two-term ratio into simplest integer form (a:b).
 * Supports formats: "6:4", "6 : 4", "6 to 4", "1.5:2", etc.
 */
export function simplifyRatio(rawRatio) {
  if (!rawRatio || typeof rawRatio !== "string") return null;
  const match = rawRatio.trim().match(/^(\d+(?:\.\d+)?)\s*(?::|to)\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;

  let a = parseFloat(match[1]);
  let b = parseFloat(match[2]);
  if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return null;

  // Multiply by 10 until both are integers
  while (!Number.isInteger(a) || !Number.isInteger(b)) {
    a = Math.round(a * 10);
    b = Math.round(b * 10);
  }

  const g = gcd(a, b);
  const simpA = a / g;
  const simpB = b / g;

  return {
    antecedent: simpA,
    consequent: simpB,
    simplified: `${simpA}:${simpB}`,
  };
}

/**
 * Checks whether two ratios are mathematically equivalent.
 */
export function areRatiosEquivalent(r1, r2) {
  const s1 = simplifyRatio(r1);
  const s2 = simplifyRatio(r2);
  if (!s1 || !s2) return false;
  return s1.simplified === s2.simplified;
}

/**
 * Checks whether r1 is the swapped/reversed form of r2.
 */
export function isRatioSwapped(r1, r2) {
  const s1 = simplifyRatio(r1);
  const s2 = simplifyRatio(r2);
  if (!s1 || !s2) return false;
  return s1.antecedent === s2.consequent && s1.consequent === s2.antecedent && s1.simplified !== s2.simplified;
}

/**
 * Parses numeric value supporting integers, decimals, fractions (3/4 = 0.75), and percentages (20% = 0.20 or 20).
 */
export function parseNumericValue(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/^\$/, "");

  // Fraction pattern
  const fracMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const denom = parseFloat(fracMatch[2]);
    return denom !== 0 ? parseFloat(fracMatch[1]) / denom : null;
  }

  // Percentage pattern
  if (str.endsWith("%")) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? null : num / 100;
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Unit conversion factors to standard base units (distance: m, volume: L, mass: g).
 */
const UNIT_FACTORS = {
  // distance (base: m)
  km: 1000,
  m: 1,
  cm: 0.01,
  mm: 0.001,
  // volume (base: l)
  l: 1,
  litres: 1,
  litre: 1,
  ml: 0.001,
  // mass (base: g)
  kg: 1000,
  g: 1,
};

/**
 * Checks unit consistency and supported unit conversion.
 */
export function checkUnitConsistency({ studentUnit, targetUnit, studentVal, targetVal, requiresUnit }) {
  const sUnit = (studentUnit || "").toLowerCase().trim();
  const tUnit = (targetUnit || "").toLowerCase().trim();

  if (requiresUnit) {
    if (!sUnit) {
      return { valid: false, errorCategory: "missing_unit" };
    }

    if (sUnit === tUnit) {
      return { valid: true };
    }

    // Check if compatible unit with conversion factor
    if (UNIT_FACTORS[sUnit] !== undefined && UNIT_FACTORS[tUnit] !== undefined) {
      // Base value conversion
      const sNum = parseNumericValue(studentVal);
      const tNum = parseNumericValue(targetVal);
      if (sNum !== null && tNum !== null) {
        const sBase = sNum * UNIT_FACTORS[sUnit];
        const tBase = tNum * UNIT_FACTORS[tUnit];
        if (Math.abs(sBase - tBase) < 1e-6) {
          return { valid: true, converted: true };
        }
      }
      return { valid: false, errorCategory: "unit_error" };
    }

    return { valid: false, errorCategory: "unit_error" };
  }

  // Unit not strictly required
  if (sUnit && tUnit && sUnit !== tUnit) {
    if (UNIT_FACTORS[sUnit] !== undefined && UNIT_FACTORS[tUnit] !== undefined) {
      const sNum = parseNumericValue(studentVal);
      const tNum = parseNumericValue(targetVal);
      if (sNum !== null && tNum !== null) {
        const sBase = sNum * UNIT_FACTORS[sUnit];
        const tBase = tNum * UNIT_FACTORS[tUnit];
        if (Math.abs(sBase - tBase) < 1e-6) {
          return { valid: true, converted: true };
        }
      }
      return { valid: false, errorCategory: "unit_error" };
    }
    // Incompatible unit
    return { valid: false, errorCategory: "unit_error" };
  }

  return { valid: true };
}

/**
 * Checks whether an expression matches a step's target_expression by form (SPEC §2.4).
 * Commutative for + and *, non-commutative for - and /.
 */
export function matchExpressionByForm(studentCanonicalExpr, targetExpr) {
  if (!studentCanonicalExpr || !targetExpr) return false;

  const parseExpr = (str) => {
    const cleaned = String(str)
      .trim()
      .replace(/×/g, "*")
      .replace(/x/gi, "*")
      .replace(/÷/g, "/");
    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    return {
      left: match[1],
      op: match[2],
      right: match[3],
    };
  };

  const s = parseExpr(studentCanonicalExpr);
  const t = parseExpr(targetExpr);
  if (!s || !t) return false;

  if (s.op !== t.op) return false;

  if (s.op === "+" || s.op === "*") {
    return (
      (s.left === t.left && s.right === t.right) ||
      (s.left === t.right && s.right === t.left)
    );
  }

  // Non-commutative: - and /
  return s.left === t.left && s.right === t.right;
}

/**
 * Validates that an object conforms to the PureVerifierResult schema (SPEC §2.4).
 */
export function validatePureResultSchema(res) {
  if (!res || typeof res !== "object") return { valid: false, errors: ["not an object"] };
  const errors = [];
  if (res.schema_version !== "1.0") errors.push("schema_version must be 1.0");
  if (!["correct", "incorrect", "partially_correct", "cannot_verify"].includes(res.status)) errors.push(`invalid status: ${res.status}`);
  if (!["ok", "tool_failure", "unverified"].includes(res.state)) errors.push(`invalid state: ${res.state}`);
  if (res.input_kind !== null && !["value", "ratio", "expression", "unparsed"].includes(res.input_kind)) errors.push(`invalid input_kind: ${res.input_kind}`);
  if (res.error_category !== null && !ERROR_CATEGORIES.includes(res.error_category)) errors.push(`invalid error_category: ${res.error_category}`);
  if (res.relation_tags !== null && !Array.isArray(res.relation_tags)) errors.push("relation_tags must be array or null");
  if (res.relation_tags && !res.relation_tags.every((t) => RELATION_TAGS.includes(t))) errors.push("invalid relation_tag in array");
  return { valid: errors.length === 0, errors };
}

/**
 * Computes pure mathematical evaluation of student input against a question (AG-02).
 * Context-free and cacheable. Returns PureVerifierResult.
 */
export function verifyExpression({
  question,
  input,
  studentInput,
  fieldKind = "answer",
  simulate_tool_failure = false,
}) {
  const actualInput = input !== undefined ? input : studentInput;
  if (simulate_tool_failure) {
    return {
      schema_version: "1.0",
      status: "cannot_verify",
      state: "tool_failure",
      confidence: null,
      input_kind: null,
      canonical_value: null,
      unit: null,
      canonical_expression: null,
      matched_solution_step: null,
      path_id: null,
      matched_step_ids: [],
      error_category: null,
      relation_tags: null,
      accepted_answer: null,
      explanation_constraints: null,
    };
  }

  // Criterion 7: Internal consistency check between question data, answer key, and solution plan
  if (question) {
    const isFlagged = question.flagged === true || question.answer_key_inconsistency === true;
    const steps = question.solution_steps || [];
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
    const acceptedVal = question.accepted_answer_spec?.canonical_value;

    let planDisagrees = false;
    if (lastStep && lastStep.target_value && acceptedVal) {
      if (
        lastStep.target_value !== acceptedVal &&
        !areRatiosEquivalent(lastStep.target_value, acceptedVal) &&
        parseNumericValue(lastStep.target_value) !== parseNumericValue(acceptedVal)
      ) {
        planDisagrees = true;
      }
    }

    if (isFlagged || planDisagrees) {
      question.flagged = true;
      question.answer_key_inconsistency = true;
      return {
        schema_version: "1.0",
        status: "cannot_verify",
        state: "ok",
        confidence: 0.98,
        input_kind: "value",
        canonical_value: null,
        unit: null,
        canonical_expression: null,
        matched_solution_step: null,
        path_id: null,
        matched_step_ids: [],
        error_category: "unknown_numeric_discrepancy",
        relation_tags: ["none"],
        accepted_answer: false,
        explanation_constraints: ["Answer key inconsistency detected; item flagged"],
      };
    }
  }

  // Step 1: Normalise input
  const norm = normalise(actualInput, fieldKind);

  // Unparsed or comma ambiguous inputs
  if (norm.input_kind === "unparsed" || norm.parse_issue === "comma_ambiguous" || norm.parse_issue === "unparsed") {
    return {
      schema_version: "1.0",
      status: "cannot_verify",
      state: "ok",
      confidence: 0.98,
      input_kind: "unparsed",
      canonical_value: null,
      unit: norm.unit || null,
      canonical_expression: null,
      matched_solution_step: null,
      path_id: null,
      matched_step_ids: [],
      error_category: "incomplete",
      relation_tags: ["none"],
      accepted_answer: false,
      explanation_constraints: ["Do not reveal final answer at current hint level"],
    };
  }

  const acceptedSpec = question?.accepted_answer_spec || {};
  const acceptedCanonical = String(acceptedSpec.canonical_value || "").trim();
  const tolerance = typeof acceptedSpec.tolerance === "number" ? acceptedSpec.tolerance : 0;
  const requiresUnit = acceptedSpec.answer_requires_unit === true;
  const targetUnit = acceptedSpec.unit || "";
  const roundingRule = acceptedSpec.rounding_rule || "none";

  // Check matching against steps (for intermediate step detection)
  const steps = question?.solution_steps || [];
  const matchedStepIds = [];
  let formMatchedStep = null;
  let formMatchedPathId = null;

  // Expression form check
  if (norm.input_kind === "expression") {
    for (const step of steps) {
      if (step.target_expression && matchExpressionByForm(norm.canonical_expression, step.target_expression)) {
        matchedStepIds.push(step.step_id);
        if (!formMatchedStep) {
          formMatchedStep = step;
          formMatchedPathId = "primary";
        }
      }
    }

    // Check alternate solution paths
    for (const altPath of question?.alternate_solution_paths || []) {
      for (const step of altPath.steps || []) {
        const stepObj = typeof step === "string" ? steps.find((s) => s.step_id === step) : step;
        if (stepObj?.target_expression && matchExpressionByForm(norm.canonical_expression, stepObj.target_expression)) {
          if (!matchedStepIds.includes(stepObj.step_id)) matchedStepIds.push(stepObj.step_id);
          if (!formMatchedStep) {
            formMatchedStep = stepObj;
            formMatchedPathId = altPath.path_id;
          }
        }
      }
    }

    if (formMatchedStep) {
      return {
        schema_version: "1.0",
        status: "partially_correct",
        state: "ok",
        confidence: 0.98,
        input_kind: "expression",
        canonical_value: norm.canonical_value,
        unit: norm.unit || null,
        canonical_expression: norm.canonical_expression,
        matched_solution_step: formMatchedStep.step_id,
        path_id: formMatchedPathId || "primary",
        matched_step_ids: matchedStepIds,
        error_category: "none",
        relation_tags: ["none"],
        accepted_answer: false,
        explanation_constraints: ["Do not reveal final answer at current hint level"],
      };
    }

    // Expression matching no step (Row 5b in SPEC)
    // Check if it represents an inverse operation (e.g. 7.5 / 4 instead of 7.5 * 4)
    let errorCategory = "unknown_numeric_discrepancy";
    let relationTags = ["none"];

    if (norm.canonical_expression) {
      const parsed = norm.canonical_expression.split(" ");
      const op = parsed[1];
      const hasMultiplyStep = steps.some((s) => s.target_expression && (s.target_expression.includes("*") || s.target_expression.includes("×")));
      const hasDivideStep = steps.some((s) => s.target_expression && (s.target_expression.includes("/") || s.target_expression.includes("÷")));
      if ((op === "/" && hasMultiplyStep) || (op === "*" && hasDivideStep)) {
        errorCategory = "inverse_operation_match";
        relationTags = ["inverse_of_answer"];
      }
    }

    return {
      schema_version: "1.0",
      status: "cannot_verify",
      state: "ok",
      confidence: 0.98,
      input_kind: "expression",
      canonical_value: norm.canonical_value,
      unit: norm.unit || null,
      canonical_expression: norm.canonical_expression,
      matched_solution_step: null,
      path_id: null,
      matched_step_ids: [],
      error_category: errorCategory,
      relation_tags: relationTags,
      accepted_answer: false,
      explanation_constraints: ["Do not reveal final answer at current hint level"],
    };
  }

  // Value / Ratio / Fraction inputs
  for (const step of steps) {
    if (step.target_value) {
      const stepVal = String(step.target_value).trim();
      if (
        norm.canonical_value === stepVal ||
        (norm.input_kind === "ratio" && areRatiosEquivalent(norm.canonical_value, stepVal)) ||
        (parseNumericValue(norm.canonical_value) !== null &&
          parseNumericValue(norm.canonical_value) === parseNumericValue(stepVal))
      ) {
        matchedStepIds.push(step.step_id);
      }
    }
  }

  // 1. Unit consistency check
  const unitResult = checkUnitConsistency({
    studentUnit: norm.unit,
    targetUnit,
    studentVal: norm.canonical_value,
    targetVal: acceptedCanonical,
    requiresUnit,
  });

  if (!unitResult.valid) {
    return {
      schema_version: "1.0",
      status: "incorrect",
      state: "ok",
      confidence: 0.98,
      input_kind: norm.input_kind,
      canonical_value: norm.canonical_value,
      unit: norm.unit || null,
      canonical_expression: null,
      matched_solution_step: null,
      path_id: null,
      matched_step_ids: matchedStepIds,
      error_category: unitResult.errorCategory,
      relation_tags: deriveRelationTags(unitResult.errorCategory),
      accepted_answer: false,
      explanation_constraints: ["Do not reveal final answer at current hint level"],
    };
  }

  // 2. Check Equivalence to Accepted Answer
  let isCorrect = false;

  // Check valid alternatives and accepted forms first
  const validForms = [
    acceptedCanonical,
    ...(acceptedSpec.accepted_forms || []),
    ...(acceptedSpec.valid_alternatives || []),
  ].map((f) => String(f).trim().toLowerCase());

  const rawClean = String(actualInput || "").trim().toLowerCase();
  const canonicalClean = String(norm.canonical_value || "").trim().toLowerCase();

  if (validForms.includes(rawClean) || validForms.includes(canonicalClean)) {
    isCorrect = true;
  }

  // If converted via unit (e.g. 8000 m for 8 km)
  if (unitResult.converted) {
    isCorrect = true;
  }

  // Ratio equivalence
  if (!isCorrect && (acceptedSpec.type === "ratio" || norm.input_kind === "ratio")) {
    if (areRatiosEquivalent(norm.canonical_value, acceptedCanonical)) {
      isCorrect = true;
    }
  }

  // Numeric / Fraction / Percentage / Tolerance / Rounding equivalence
  if (!isCorrect) {
    const sNum = parseNumericValue(norm.canonical_value);
    const aNum = parseNumericValue(acceptedCanonical);
    if (sNum !== null && aNum !== null) {
      if (tolerance > 0) {
        if (Math.abs(sNum - aNum) <= tolerance) {
          isCorrect = true;
        }
      } else if (roundingRule === "2_decimal_places" || roundingRule === "2dp") {
        if (Number(sNum.toFixed(2)) === Number(aNum.toFixed(2))) {
          isCorrect = true;
        }
      } else if (roundingRule === "1_decimal_place" || roundingRule === "1dp") {
        if (Number(sNum.toFixed(1)) === Number(aNum.toFixed(1))) {
          isCorrect = true;
        }
      } else if (roundingRule === "round_nearest" || roundingRule === "integer") {
        if (Math.round(sNum) === Math.round(aNum) || Math.abs(sNum - aNum) < 0.5) {
          isCorrect = true;
        }
      } else if (Math.abs(sNum - aNum) < 1e-6) {
        isCorrect = true;
      }
    }
  }

  if (isCorrect) {
    return {
      schema_version: "1.0",
      status: "correct",
      state: "ok",
      confidence: 0.98,
      input_kind: norm.input_kind,
      canonical_value: norm.canonical_value,
      unit: norm.unit || targetUnit || null,
      canonical_expression: null,
      matched_solution_step: null,
      path_id: "primary",
      matched_step_ids: matchedStepIds,
      error_category: "none",
      relation_tags: ["none"],
      accepted_answer: true,
      explanation_constraints: ["Do not reveal final answer at current hint level"],
    };
  }

  // 3. Incorrect answer: Determine error_category and relation_tags
  let errorCategory = "unknown_numeric_discrepancy";
  let relationContext = {};

  // Ratio reversal check
  if (
    (acceptedSpec.type === "ratio" || norm.input_kind === "ratio") &&
    isRatioSwapped(norm.canonical_value, acceptedCanonical)
  ) {
    errorCategory = "reversed_ratio_match";
  } else if (matchedStepIds.length > 0) {
    // Intermediate step value
    errorCategory = "incomplete";
  } else {
    // Check proportional scaling vs additive difference (Criterion 3)
    // E.g. in paint mixing (red:blue 3:4, 15L red -> blue is 20, additive is 16)
    const stem = question?.stem || "";
    const ratioInStem = stem.match(/(\d+)\s*:\s*(\d+)/);
    const numberInStem = stem.match(/(\d+)\s*(?:litres|l|km|m|\$)/i);
    if (ratioInStem && numberInStem) {
      const r1 = parseFloat(ratioInStem[1]);
      const r2 = parseFloat(ratioInStem[2]);
      const givenNum = parseFloat(numberInStem[1]);
      const diff = Math.abs(r2 - r1);
      const additiveVal1 = givenNum + diff;
      const additiveVal2 = givenNum - diff;
      const sNum = parseNumericValue(norm.canonical_value);
      if (sNum === additiveVal1 || sNum === additiveVal2) {
        errorCategory = "additive_difference_match";
        relationContext = { tag: "difference_of_givens" };
      }
    }

    // Check misconception predictions authored for the question
    if (errorCategory === "unknown_numeric_discrepancy") {
      const pred = (question?.misconception_predictions || []).find(
        (p) => String(p.predicted_response).trim() === String(norm.canonical_value).trim()
      );
      if (pred) {
        if (pred.misconception_code === "ratio_additive_interpretation") {
          errorCategory = "additive_difference_match";
          relationContext = { tag: "difference_of_givens" };
        } else if (pred.misconception_code === "ratio_reversal") {
          errorCategory = "reversed_ratio_match";
        } else if (pred.misconception_code === "scale_direction_error") {
          errorCategory = "inverse_operation_match";
        } else if (pred.misconception_code === "incomplete_reasoning") {
          errorCategory = "incomplete";
        }
      }
    }
  }

  const relationTags = deriveRelationTags(errorCategory, relationContext);

  return {
    schema_version: "1.0",
    status: "incorrect",
    state: "ok",
    confidence: 0.98,
    input_kind: norm.input_kind,
    canonical_value: norm.canonical_value,
    unit: norm.unit || null,
    canonical_expression: null,
    matched_solution_step: null,
    path_id: null,
    matched_step_ids: matchedStepIds,
    error_category: errorCategory,
    relation_tags: relationTags,
    accepted_answer: false,
    explanation_constraints: ["Do not reveal final answer at current hint level"],
  };
}

/**
 * Applies the uncached response-target overlay (WF-06).
 * Never cached, never sent to MCP. Returns VerifierOutcome.
 */
export function applyOverlay(arg1, arg2, arg3, arg4) {
  let pureResult, responseTarget, session, question;
  if (arg1 && arg1.pureResult) {
    pureResult = arg1.pureResult;
    responseTarget = arg1.responseTarget;
    session = arg1.session;
    question = arg1.question;
  } else {
    pureResult = arg1;
    responseTarget = arg2;
    session = arg3;
    question = arg4;
  }

  const outcome = {
    ...pureResult,
    response_target: responseTarget,
    overlay_applied: true,
    status_post_overlay: pureResult.status,
    matched_solution_step_post_overlay: pureResult.matched_solution_step,
    progress: null,
  };

  // Unparsed input stays cannot_verify in every case
  if (pureResult.input_kind === "unparsed" || pureResult.state === "tool_failure") {
    return outcome;
  }

  // Pure correct is unchanged whatever the response_target (SM-1 row 3 or 17)
  if (pureResult.status === "correct") {
    return outcome;
  }

  // 1. response_target: final
  if (responseTarget === "final" || !responseTarget) {
    if (pureResult.matched_step_ids.length > 0 && pureResult.status !== "correct") {
      outcome.status_post_overlay = "incorrect";
      outcome.error_category = "incomplete";
    }
    // Expression matching no step stays cannot_verify
    return outcome;
  }

  // 2. response_target: step
  if (responseTarget === "step") {
    if (pureResult.matched_step_ids.length > 0) {
      outcome.status_post_overlay = "partially_correct";
      outcome.matched_solution_step_post_overlay = pureResult.matched_step_ids[0];
    } else if (pureResult.input_kind === "expression" || pureResult.status === "cannot_verify") {
      outcome.status_post_overlay = "cannot_verify";
    } else {
      outcome.status_post_overlay = "incorrect";
    }
    return outcome;
  }

  // 3. response_target: probe
  if (responseTarget === "probe") {
    let activeProbeId = null;
    if (session && "active_probe_id" in session) {
      activeProbeId = session.active_probe_id;
    } else {
      const probes = question?.scaffold_probes || [];
      const matchP = probes.find((p) => {
        const expVal = String(p.expected_value || "").trim();
        const sVal = String(pureResult.canonical_value || "").trim();
        return expVal && sVal && (expVal === sVal || areRatiosEquivalent(sVal, expVal) || parseNumericValue(sVal) === parseNumericValue(expVal));
      });
      activeProbeId = matchP ? matchP.probe_id : (probes[0]?.probe_id || null);
    }

    if (!activeProbeId) {
      // With no active probe, judged without the overlay
      return outcome;
    }

    const probes = question?.scaffold_probes || [];
    const activeProbe = probes.find((p) => p.probe_id === activeProbeId);
    if (!activeProbe) {
      return outcome;
    }

    if (activeProbe.kind === "value") {
      const expVal = String(activeProbe.expected_value || "").trim();
      const sVal = String(pureResult.canonical_value || "").trim();

      const valMatches =
        (sVal && expVal && sVal === expVal) ||
        (pureResult.input_kind === "ratio" && areRatiosEquivalent(sVal, expVal)) ||
        (parseNumericValue(sVal) !== null && parseNumericValue(sVal) === parseNumericValue(expVal));

      if (valMatches) {
        outcome.status_post_overlay = "partially_correct";
        outcome.matched_solution_step_post_overlay = activeProbe.counts_as_step_id;
      } else {
        // Any other parsed input becomes incorrect for the probe and never cannot_verify
        outcome.status_post_overlay = "incorrect";
      }
    } else if (activeProbe.kind === "setup") {
      const stepMatch =
        pureResult.matched_solution_step === activeProbe.counts_as_step_id ||
        (pureResult.matched_step_ids && pureResult.matched_step_ids.includes(activeProbe.counts_as_step_id));
      if (stepMatch) {
        outcome.status_post_overlay = "partially_correct";
        outcome.matched_solution_step_post_overlay = activeProbe.counts_as_step_id;
      } else {
        outcome.status_post_overlay = "incorrect";
      }
    }

    return outcome;
  }

  return outcome;
}

/**
 * MathVerifierAgent (AG-02):
 * Coordinates exact-key cache lookup, pure verifier execution, cache storage, and response-target overlay.
 */
export class MathVerifierAgent {
  static runTurn({
    question,
    input,
    fieldKind = "answer",
    responseTarget = "final",
    session = null,
    simulate_tool_failure = false,
  }) {
    if (simulate_tool_failure) {
      const pure = verifyExpression({ question, input, fieldKind, simulate_tool_failure: true });
      const outcome = applyOverlay(pure, responseTarget, session, question);
      return { pureResult: pure, outcome, cacheHit: false };
    }

    // Build exact cache key: (canonical_expression, question_id, question_version, tolerance)
    const norm = normalise(input, fieldKind);
    const exprKey = norm.canonical_expression || norm.canonical_value || input;
    const qId = question?.question_id || "q_default";
    const qVer = question?.version || 1;
    const tol = question?.accepted_answer_spec?.tolerance || 0;
    const cacheKey = `${qId}:${qVer}:${fieldKind}:${exprKey}:${tol}`;

    let pureResult = null;
    let cacheHit = false;

    if (verifierCache.has(cacheKey)) {
      pureResult = JSON.parse(JSON.stringify(verifierCache.get(cacheKey)));
      cacheHit = true;
    } else {
      pureResult = verifyExpression({ question, input, fieldKind, simulate_tool_failure: false });
      // Store in cache (cache value holds pure result ONLY, no session fields)
      verifierCache.set(cacheKey, JSON.parse(JSON.stringify(pureResult)));
      cacheHit = false;
    }

    // Apply uncached response-target overlay
    const outcome = applyOverlay(pureResult, responseTarget, session, question);

    return {
      pureResult,
      outcome,
      cacheHit,
    };
  }
}
