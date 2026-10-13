import { test, expect } from "@playwright/test";
import { validateContentBank, validateQuestionItem, validateCannedResponses } from "../../lib/content-validator.js";
import { listQuestions, getQuestion } from "../../lib/question-loader.js";
import { selectTransferPartner } from "../../lib/transfer-selector.js";
import { MISCONCEPTION_TAXONOMY } from "../../lib/misconception-classifier.js";
import fs from "fs";
import path from "path";

test.describe("ADM-12: Seed the approved bank", () => {
  test("Content bank validation pipeline passes V1–V9 and C1–C3 with zero violations", () => {
    const report = validateContentBank();
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    // Release 1.0 has at least 10 approved ratio items
    expect(report.approved_questions).toBeGreaterThanOrEqual(10);
    // Total bank has at least 40 approved items for Release 1.1
    expect(report.approved_questions).toBeGreaterThanOrEqual(40);
  });

  test("Every approved question has a legal transfer partner inside the starting set (V8)", () => {
    const questions = listQuestions()
      .map((item) => getQuestion(item.question_id))
      .filter((q) => q && q.validation_status === "approved" && q.publication_status === "published");

    expect(questions.length).toBeGreaterThanOrEqual(40);

    for (const q of questions) {
      const partner = selectTransferPartner({
        completedQuestion: q,
        questionBank: questions,
      });
      expect(partner, `Question ${q.question_id} must have a legal transfer partner`).not.toBeNull();
      expect(partner.question_id).not.toBe(q.question_id);
      expect(partner.validation_status).toBe("approved");
      expect(partner.publication_status).toBe("published");
      expect(partner.flagged).toBe(false);
    }
  });

  test("STU-15 taxonomy contains all 13 closed taxonomy codes and exemplars cover all labels", () => {
    const taxPath = path.resolve(process.cwd(), "content", "taxonomy", "taxonomy.json");
    expect(fs.existsSync(taxPath)).toBe(true);
    const taxData = JSON.parse(fs.readFileSync(taxPath, "utf-8"));
    expect(taxData.codes).toHaveLength(13);

    const taxCodes = taxData.codes.map((c) => c.code);
    for (const expectedCode of MISCONCEPTION_TAXONOMY) {
      expect(taxCodes).toContain(expectedCode);
    }

    const exPath = path.resolve(process.cwd(), "content", "taxonomy", "exemplars.json");
    expect(fs.existsSync(exPath)).toBe(true);
    const exData = JSON.parse(fs.readFileSync(exPath, "utf-8"));
    const exCodes = new Set(exData.exemplars.map((e) => e.misconception_code));
    for (const expectedCode of MISCONCEPTION_TAXONOMY) {
      expect(exCodes.has(expectedCode)).toBe(true);
    }
  });

  test("content/safety/canned_responses.json contains all 28 required keys and satisfies C1–C3", () => {
    const cannedPath = path.resolve(process.cwd(), "content", "safety", "canned_responses.json");
    expect(fs.existsSync(cannedPath)).toBe(true);
    const cannedData = JSON.parse(fs.readFileSync(cannedPath, "utf-8"));
    const report = validateCannedResponses(cannedData);
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.total_keys).toBe(28);
  });

  test("Question blueprint content/questions/blueprint.md exists and documents the seed bank matrix", () => {
    const blueprintPath = path.resolve(process.cwd(), "content", "questions", "blueprint.md");
    expect(fs.existsSync(blueprintPath)).toBe(true);
    const blueprint = fs.readFileSync(blueprintPath, "utf-8");
    expect(blueprint).toContain("scale_0001");
    expect(blueprint).toContain("ratio_share_001");
    expect(blueprint).toContain("ratio_simp_001");
    expect(blueprint).toContain("ratio_unit_001");
    expect(blueprint).toContain("ratio_table_001");
    expect(blueprint).toContain("ratio_mult_001");
  });
});
