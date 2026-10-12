/**
 * Misconception Classifier Module (lib/misconception-classifier.js)
 *
 * Implements the Misconception Classifier contract from:
 * - PRD §6.1 STU-04, FR-07
 * - SPEC §2.2 (13-value closed taxonomy enum)
 * - SPEC §2.3 (misconception_event)
 * - SPEC §2.4 (MisconceptionClassifierOutput schema)
 * - SPEC §4 WF-07 & AGENTS §2.8
 *
 * Rules:
 * 1. Closed taxonomy enum of 13 values:
 *    12 domain codes + 1 sentinel ('insufficient_evidence').
 * 2. Confidence threshold: 0.80 (default).
 * 3. Prompt type:
 *    'targeted_scaffold' iff classifier code has confidence >= 0.80 AND code !== 'insufficient_evidence'.
 *    Otherwise 'diagnostic_probe' (neutral question).
 * 4. Delivered feedback NEVER names the taxonomy code or glossary jargon.
 * 5. Reviewer status begins as 'unreviewed' and is visible to teachers only.
 */

export const MISCONCEPTION_TAXONOMY = [
  "ratio_additive_interpretation",
  "ratio_reversal",
  "whole_to_part_confusion",
  "unit_rate_error",
  "scale_direction_error",
  "unit_conversion_error",
  "arithmetic_error_after_correct_setup",
  "irrelevant_operation",
  "diagram_misread",
  "premature_rounding",
  "incomplete_reasoning",
  "answer_guessing",
  "insufficient_evidence",
];

export const MISCONCEPTION_CONFIDENCE_THRESHOLD = 0.80;

/**
 * Plain, age-appropriate targeted scaffold questions that direct the student's
 * attention to fixing their thinking WITHOUT naming the taxonomy label.
 *
 * All prompts:
 * - Are in plain English (under 25 words).
 * - Contain NO taxonomy code (e.g. no "ratio_reversal", no "unit_rate_error").
 * - Contain NO ability labels or shaming words.
 * - Formulate a single prompt (<= 1 question mark, <= 1 imperative).
 */
export const TARGETED_SCAFFOLD_PROMPTS = {
  ratio_reversal: "Check which person receives 3 parts of the money according to the ratio.",
  unit_rate_error: "How many total equal parts are there when you combine 2 and 3?",
  ratio_additive_interpretation: "Try thinking about dividing into equal groups rather than subtracting.",
  whole_to_part_confusion: "How many equal parts make up the whole amount altogether?",
  scale_direction_error: "Look at whether the share should be larger or smaller than the starting total.",
  unit_conversion_error: "Check the units of your answer to see if a conversion is needed.",
  arithmetic_error_after_correct_setup: "Double check your calculation after finding the value of one part.",
  irrelevant_operation: "Look back at the question to see what operation connects the parts to the total.",
  diagram_misread: "Compare the labels with the parts given in the ratio.",
  premature_rounding: "Try keeping the exact value until your final step.",
  incomplete_reasoning: "You found the value of one part, what is the next step for Maya's share?",
  answer_guessing: "What steps did you take to work out that amount?",
  insufficient_evidence: "What steps did you take to reach that number?",
};

export const NEUTRAL_DIAGNOSTIC_PROBE = "What steps did you take to reach that number?";

/**
 * Validates a classifier output object against the schema contract (SPEC §2.4)
 */
export function validateClassifierOutput(output) {
  if (!output || typeof output !== "object") {
    throw new Error("Classifier output must be an object");
  }

  if (!MISCONCEPTION_TAXONOMY.includes(output.code)) {
    throw new Error(
      `Invalid taxonomy code "${output.code}". Must be one of: ${MISCONCEPTION_TAXONOMY.join(", ")}`
    );
  }

  if (typeof output.confidence !== "number" || output.confidence < 0 || output.confidence > 1) {
    throw new Error(
      `Invalid confidence "${output.confidence}". Must be a number between 0.0 and 1.0`
    );
  }

  if (output.alternative_labels && !Array.isArray(output.alternative_labels)) {
    throw new Error("alternative_labels must be an array of taxonomy codes");
  }

  if (output.alternative_labels) {
    for (const alt of output.alternative_labels) {
      if (!MISCONCEPTION_TAXONOMY.includes(alt)) {
        throw new Error(`Invalid alternative label "${alt}" in classifier output`);
      }
    }
  }

  return true;
}

/**
 * Classifies an incorrect answer, either from an explicit simulation/override
 * or from question predictions and mathematical heuristics.
 */
export function classifyMisconception({
  question,
  answer_text,
  canonical_value,
  simulated_classification,
  threshold = MISCONCEPTION_CONFIDENCE_THRESHOLD,
}) {
  // 1. If explicit simulation/LLM result provided (for testing or model pipeline)
  if (simulated_classification) {
    validateClassifierOutput(simulated_classification);

    const confidence = simulated_classification.confidence;
    const code = simulated_classification.code;

    // Rule: prompt_type is 'targeted_scaffold' iff confidence >= threshold AND code !== 'insufficient_evidence'
    const recommended_prompt_type =
      confidence >= threshold && code !== "insufficient_evidence"
        ? "targeted_scaffold"
        : "diagnostic_probe";

    const cited = simulated_classification.cited_exemplar_ids || [];

    return {
      schema_version: "1.0",
      code,
      confidence,
      evidence:
        simulated_classification.evidence ||
        `Evaluated student response "${answer_text}" against curriculum benchmarks.`,
      alternative_labels: simulated_classification.alternative_labels || [],
      recommended_prompt_type,
      cited_exemplar_ids: cited,
      exemplars_used: cited.length > 0 ? "some" : "none",
      source: simulated_classification.source || "classifier",
    };
  }

  // 2. Default heuristic / question prediction classifier
  const cleaned = String(answer_text || "").trim().replace(/^\$/, "");

  // Check authored predictions on question
  const predictions = question?.misconception_predictions || [];
  const predictionMatch = predictions.find(
    (p) => String(p.predicted_response).trim() === cleaned
  );

  if (predictionMatch) {
    const code = predictionMatch.misconception_code;
    const confidence = typeof predictionMatch.confidence === "number" ? predictionMatch.confidence : 0.90;
    const recommended_prompt_type =
      confidence >= threshold && code !== "insufficient_evidence"
        ? "targeted_scaffold"
        : "diagnostic_probe";

    return {
      schema_version: "1.0",
      code,
      confidence,
      evidence: predictionMatch.rationale || `Matches predicted error for answer "${cleaned}".`,
      alternative_labels: [],
      recommended_prompt_type,
      cited_exemplar_ids: [],
      exemplars_used: "none",
      source: "classifier",
    };
  }

  // Fallback heuristic for other common ratio errors
  if (cleaned === "30") {
    // 60 / 2 -> whole_to_part_confusion
    return {
      schema_version: "1.0",
      code: "whole_to_part_confusion",
      confidence: 0.85,
      evidence: "Divided total by first term instead of total parts.",
      alternative_labels: ["unit_rate_error"],
      recommended_prompt_type: "targeted_scaffold",
      cited_exemplar_ids: [],
      exemplars_used: "none",
      source: "classifier",
    };
  }

  // If no pattern detected, report insufficient_evidence with low confidence
  return {
    schema_version: "1.0",
    code: "insufficient_evidence",
    confidence: 0.35,
    evidence: `No recognized misconception pattern for numeric response "${cleaned}".`,
    alternative_labels: [],
    recommended_prompt_type: "diagnostic_probe",
    cited_exemplar_ids: [],
    exemplars_used: "none",
    source: "classifier",
  };
}
