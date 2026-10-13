import fs from "fs";
import path from "path";
import { getQuestion, listQuestions } from "./question-loader.js";
import { selectTransferPartner } from "./transfer-selector.js";
import { getDiagramAsset } from "./diagram-service.js";
import { MISCONCEPTION_TAXONOMY } from "./misconception-classifier.js";

/**
 * Content Validation Pipeline (TECH-07, PRD §10.3.1, §18.3, §21)
 * Enforces rules V1–V9 and C1–C3.
 */

const CANNED_REQUIRED_KEYS = [
  "level0_prompt",
  "fallback_l0",
  "fallback_l1",
  "fallback_l2",
  "fallback_l3",
  "fallback_l4",
  "rephrase_request",
  "use_dot_for_decimals",
  "enter_the_number",
  "structured_mode_notice",
  "tool_failure_notice",
  "save_failed_notice",
  "rate_limited_notice",
  "note_ack",
  "answer_request_reply",
  "abuse_reply",
  "assessment_help_reply",
  "impersonation_reply",
  "worrying_disclosure_reply",
  "injection_phrase_reply",
  "encouragement",
  "support_withheld_notice",
  "turn_cap_notice",
  "transfer_offer",
  "transfer_declined_ack",
  "transfer_stuck_notice",
  "no_legal_transfer_notice",
  "session_closed_notice",
];

export function validateV8(q, bank = []) {
  const errors = [];
  if (!q) {
    return { valid: false, errors: ["Missing question"] };
  }
  const partner = selectTransferPartner({
    completedQuestion: q,
    questionBank: bank,
  });
  if (!partner) {
    errors.push(`Question ${q.question_id || "unknown"} breaks Rule V8: no legal transfer partner found in bank`);
  }
  return {
    valid: errors.length === 0,
    errors,
    violations: errors,
  };
}

export function validateV9(refl) {
  const errors = [];
  if (!refl || typeof refl !== "object") {
    return { valid: false, errors: ["Missing reflection block"] };
  }

  const tmpl = refl.prompt_template;
  if (!tmpl || typeof tmpl !== "string") {
    return { valid: false, errors: ["Missing prompt_template in reflection"] };
  }

  const qCount = (tmpl.match(/\?/g) || []).length;
  if (qCount > 1) {
    errors.push("Prompt template contains more than 1 question mark");
  }

  const placeholderCount = (tmpl.match(/\{student_value\}/g) || []).length;
  if (placeholderCount !== 1) {
    errors.push("Prompt template must contain exactly one {student_value} placeholder");
  }

  const options = refl.options || [];
  if (!Array.isArray(options) || options.length < 3 || options.length > 4) {
    errors.push(`Reflection options must contain between 3 and 4 options, got ${options.length}`);
  }

  const hasSound = options.some((opt) => opt && opt.sound === true);
  if (!hasSound) {
    errors.push("Reflection must contain at least one option with sound: true");
  }

  // Check for taxonomy code in label or feedback
  for (const opt of options) {
    if (!opt) continue;
    const label = (opt.label || "").toLowerCase();
    const feedback = (opt.feedback || "").toLowerCase();
    for (const code of MISCONCEPTION_TAXONOMY) {
      const codeWord = code.replace(/_/g, " ").toLowerCase();
      if (label.includes(code) || label.includes(codeWord) || feedback.includes(code) || feedback.includes(codeWord)) {
        errors.push(`Option contains taxonomy code '${code}' in label or feedback`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    violations: errors,
  };
}

export function validateQuestion(q, bank = []) {
  const errors = [];
  if (!q) {
    return { valid: false, errors: ["Question is null or undefined"], violations: ["Question is null or undefined"] };
  }
  const qid = q.question_id || "unknown";

  // V1: 2 to 4 solution steps, final step has NO permitted_scaffold_step
  const steps = q.solution_steps || [];
  if (steps.length < 2 || steps.length > 4) {
    errors.push(`${qid} V1: solution_steps must have between 2 and 4 steps, got ${steps.length}`);
  }
  const lastStep = steps[steps.length - 1];
  if (lastStep && lastStep.permitted_scaffold_step) {
    errors.push(`${qid} V1: final solution step must NOT contain permitted_scaffold_step`);
  }

  // V2: Zero leakage of accepted value in scaffold probes, intermediate steps, or isomorphic example
  const acceptedVal = String(q.accepted_answer_spec?.canonical_value || "").trim();
  const acceptedForms = (q.accepted_answer_spec?.accepted_forms || []).map((f) => String(f).trim());
  const leakTargets = new Set([acceptedVal, ...acceptedForms].filter(Boolean));

  for (const step of steps) {
    if (step.permitted_scaffold_step) {
      for (const target of leakTargets) {
        if (target.length >= 2 && step.permitted_scaffold_step.includes(target)) {
          errors.push(`${qid} V2: permitted_scaffold_step contains accepted value '${target}'`);
        }
      }
    }
  }

  const probes = q.scaffold_probes || [];
  for (const p of probes) {
    for (const target of leakTargets) {
      if (target.length >= 2 && p.template && p.template.includes(target)) {
        errors.push(`${qid} V2: scaffold probe template contains accepted value '${target}'`);
      }
    }
  }

  // V3: Collision-free misconception predictions
  const predictions = q.misconception_predictions || [];
  const seenPreds = new Set();
  const stepTargetValues = new Set(steps.map((s) => String(s.target_value)));
  const probeExpectedValues = new Set(probes.map((p) => String(p.expected_value)));

  for (const p of predictions) {
    const resp = String(p.predicted_response);
    if (seenPreds.has(resp)) {
      errors.push(`${qid} V3: duplicate misconception prediction '${resp}'`);
    }
    seenPreds.add(resp);
    if (leakTargets.has(resp)) {
      errors.push(`${qid} V3: prediction '${resp}' equals accepted answer`);
    }
    if (stepTargetValues.has(resp)) {
      errors.push(`${qid} V3: prediction '${resp}' equals step target_value`);
    }
    if (probeExpectedValues.has(resp)) {
      errors.push(`${qid} V3: prediction '${resp}' equals probe expected_value`);
    }
  }

  // V4: Canonical value has at least 2 digits, or answer_requires_unit: true
  const digitCount = (acceptedVal.match(/\d/g) || []).length;
  const requiresUnit = q.accepted_answer_spec?.answer_requires_unit === true;
  if (digitCount < 2 && !requiresUnit) {
    errors.push(`${qid} V4: canonical value '${acceptedVal}' has < 2 digits and answer_requires_unit is false`);
  }

  // V5: At most 4 scaffold probes; each kind: value probe evaluates to expected_value and != final answer
  if (probes.length > 4) {
    errors.push(`${qid} V5: at most 4 scaffold probes allowed, got ${probes.length}`);
  }
  for (const p of probes) {
    if (p.kind === "value") {
      if (String(p.expected_value) === acceptedVal) {
        errors.push(`${qid} V5: probe expected_value '${p.expected_value}' equals item's final answer`);
      }
    } else if (p.kind === "setup") {
      const step = steps.find((s) => s.step_id === p.counts_as_step_id);
      if (step && p.expected_expression && step.target_expression) {
        if (p.expected_expression.trim() !== step.target_expression.trim()) {
          errors.push(`${qid} V5: probe expected_expression '${p.expected_expression}' does not match step '${step.step_id}' target_expression '${step.target_expression}'`);
        }
      }
    }
  }

  // V6: method_leak_patterns names operations and step phrases
  const mlp = q.method_leak_patterns;
  if (!mlp || !Array.isArray(mlp.operations) || mlp.operations.length === 0 || !Array.isArray(mlp.step_phrases) || mlp.step_phrases.length === 0) {
    errors.push(`${qid} V6: method_leak_patterns must specify operations and step_phrases`);
  }

  // V7: Alternate solution paths
  const paths = q.alternate_solution_paths || [];
  if (paths.length === 0) {
    errors.push(`${qid} V7: alternate_solution_paths must not be empty`);
  }

  // V8: Legal transfer partner inside starting set
  if (bank.length > 1) {
    const v8Res = validateV8(q, bank);
    if (!v8Res.valid) {
      errors.push(...v8Res.errors);
    }
  }

  // V9: Reflection block
  if (q.reflection) {
    const v9Res = validateV9(q.reflection);
    if (!v9Res.valid) {
      errors.push(...v9Res.errors);
    }
  }

  return {
    valid: errors.length === 0,
    question_id: qid,
    errors,
    violations: errors,
  };
}

export const validateQuestionItem = validateQuestion;

export function validateCannedResponses(canned) {
  const violations = [];
  const keys = Object.keys(canned);

  // C1: all 28 keys, each has text and status ('draft' or 'reviewed')
  for (const reqKey of CANNED_REQUIRED_KEYS) {
    if (!canned[reqKey]) {
      violations.push(`C1: Missing required canned response key '${reqKey}'`);
      continue;
    }
    const item = canned[reqKey];
    if (!item.text || typeof item.text !== "string") {
      violations.push(`C1: Key '${reqKey}' missing text string`);
    }
    if (!["draft", "reviewed"].includes(item.status)) {
      violations.push(`C1: Key '${reqKey}' has invalid status '${item.status}'`);
    }
    if (item.status === "reviewed") {
      if (!item.reviewed_by || !item.reviewed_on) {
        violations.push(`C1: Reviewed key '${reqKey}' missing reviewed_by or reviewed_on`);
      }
    }
  }

  // C2: sentences <= 25 words, <= 1 question mark, no digits, no jargon
  const jargonList = ["ratio_reversal", "ratio_additive_interpretation", "misconception", "taxonomy", "isomorphic"];
  for (const [k, v] of Object.entries(canned)) {
    const text = v.text || "";
    const questionMarks = (text.match(/\?/g) || []).length;
    if (questionMarks > 1) {
      violations.push(`C2: Key '${k}' has > 1 question mark`);
    }
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    for (const s of sentences) {
      const wordCount = s.split(/\s+/).length;
      if (wordCount > 25) {
        violations.push(`C2: Key '${k}' sentence exceeds 25 words (${wordCount} words): '${s}'`);
      }
    }
    for (const j of jargonList) {
      if (text.toLowerCase().includes(j)) {
        violations.push(`C2: Key '${k}' contains jargon '${j}'`);
      }
    }
  }

  // C3: each fallback_l{n} is exactly one question or one imperative, no mathematics
  for (let l = 0; l <= 4; l++) {
    const key = `fallback_l${l}`;
    if (canned[key]) {
      const text = canned[key].text;
      const qCount = (text.match(/\?/g) || []).length;
      if (qCount > 1) {
        violations.push(`C3: ${key} contains > 1 question`);
      }
      if (/\b\d+\b/.test(text)) {
        violations.push(`C3: ${key} contains digits`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    total_keys: keys.length,
    violations,
    errors: violations,
  };
}

export function validateContentBank() {
  const allQuestions = listQuestions().map((item) => getQuestion(item.question_id)).filter(Boolean);
  const violations = [];

  // 1. Release 1.0 approved items count
  const approvedItems = allQuestions.filter((q) => q.validation_status === "approved" && q.publication_status === "published");
  if (approvedItems.length < 10) {
    violations.push(`Release 1.0 requires >= 10 approved ratio questions, got ${approvedItems.length}`);
  }

  // 2. Validate all approved questions against V1–V9
  for (const q of approvedItems) {
    const qReport = validateQuestion(q, approvedItems);
    if (!qReport.valid) {
      violations.push(...qReport.errors);
    }

    // Diagram validation
    if (q.has_diagram) {
      if (!q.diagram_id) {
        violations.push(`${q.question_id}: has_diagram is true but missing diagram_id`);
      } else {
        const diagramAsset = getDiagramAsset(q.diagram_id);
        if (!diagramAsset) {
          violations.push(`${q.question_id}: diagram_id '${q.diagram_id}' not found in DIAGRAM_ASSETS`);
        } else if (diagramAsset.approval_status !== "approved") {
          violations.push(`${q.question_id}: diagram_id '${q.diagram_id}' has unapproved status '${diagramAsset.approval_status}'`);
        }
      }
    }
  }

  // 3. Taxonomy validation
  const taxPath = path.resolve(process.cwd(), "content", "taxonomy", "taxonomy.json");
  if (!fs.existsSync(taxPath)) {
    violations.push("Missing content/taxonomy/taxonomy.json");
  } else {
    const taxData = JSON.parse(fs.readFileSync(taxPath, "utf-8"));
    if (!Array.isArray(taxData.codes) || taxData.codes.length !== 13) {
      violations.push(`STU-15 taxonomy must have 13 codes, got ${taxData.codes?.length}`);
    }
  }

  // 4. Exemplar validation
  const exPath = path.resolve(process.cwd(), "content", "taxonomy", "exemplars.json");
  if (!fs.existsSync(exPath)) {
    violations.push("Missing content/taxonomy/exemplars.json");
  } else {
    const exData = JSON.parse(fs.readFileSync(exPath, "utf-8"));
    const seenCodes = new Set((exData.exemplars || []).map((e) => e.misconception_code));
    for (const code of MISCONCEPTION_TAXONOMY) {
      if (!seenCodes.has(code)) {
        violations.push(`Exemplar missing for taxonomy code '${code}'`);
      }
    }
  }

  // 5. Canned responses validation
  const cannedPath = path.resolve(process.cwd(), "content", "safety", "canned_responses.json");
  if (!fs.existsSync(cannedPath)) {
    violations.push("Missing content/safety/canned_responses.json");
  } else {
    const cannedData = JSON.parse(fs.readFileSync(cannedPath, "utf-8"));
    const cannedReport = validateCannedResponses(cannedData);
    if (!cannedReport.valid) {
      violations.push(...cannedReport.violations);
    }
  }

  return {
    valid: violations.length === 0,
    total_questions: allQuestions.length,
    approved_questions: approvedItems.length,
    violations,
    errors: violations,
  };
}
