import { test, expect } from "@playwright/test";
import {
  loadEvaluationSuite,
  validateEvaluationSuite,
  PRD_14_1_CATEGORIES,
  CRITICAL_TARGETS,
} from "../../lib/eval-suite";

test.describe("ADM-10: Labelled Evaluation Suite", () => {
  test("Tier 1 critical suite satisfies Gate A requirements (exactly 42 critical cases)", () => {
    const report = validateEvaluationSuite("tier1_critical");
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.total_cases).toBe(42);
    expect(report.unique_ids_count).toBe(42);

    // Verify exact category counts
    expect(report.category_counts["direct_answer"]).toBe(15);
    expect(report.category_counts["prompt_injection"]).toBe(15);
    expect(report.category_counts["unsafe_input"]).toBe(12);

    const cases = loadEvaluationSuite("tier1_critical");
    for (const c of cases) {
      expect(c.critical).toBe(true);
      expect(c.id).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(c.input).toBeDefined();
      expect(c.expected).toBeDefined();
    }
  });

  test("Tier 2 launch suite satisfies Section 14.1 requirements (>= 150 cases across all 17 categories)", () => {
    const report = validateEvaluationSuite("tier2_launch");
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.total_cases).toBeGreaterThanOrEqual(150);
    expect(report.unique_ids_count).toBe(report.total_cases);

    // Verify representation across all 17 categories
    for (const category of PRD_14_1_CATEGORIES) {
      expect(report.category_counts[category]).toBeGreaterThanOrEqual(1);
    }

    // Verify full critical targets
    expect(report.category_counts["direct_answer"]).toBeGreaterThanOrEqual(CRITICAL_TARGETS.direct_answer);
    expect(report.category_counts["prompt_injection"]).toBeGreaterThanOrEqual(CRITICAL_TARGETS.prompt_injection);
    expect(report.category_counts["unsafe_input"]).toBeGreaterThanOrEqual(CRITICAL_TARGETS.unsafe_input);

    const cases = loadEvaluationSuite("tier2_launch");
    const ids = new Set();
    for (const c of cases) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(PRD_14_1_CATEGORIES).toContain(c.category);
    }
  });

  test("Admin eval-suite API enforces RBAC and returns valid reports", async ({ request }) => {
    // 403 Forbidden for non-admin
    const nonAdminRes = await request.get("/api/admin/eval-suite?suite=tier1_critical", {
      headers: {
        "x-user-role": "student",
      },
    });
    expect(nonAdminRes.status()).toBe(403);

    // 200 OK for admin querying tier1_critical
    const adminTier1Res = await request.get("/api/admin/eval-suite?suite=tier1_critical", {
      headers: {
        "x-user-role": "admin",
      },
    });
    expect(adminTier1Res.status()).toBe(200);
    const tier1Data = await adminTier1Res.json();
    expect(tier1Data.valid).toBe(true);
    expect(tier1Data.total_cases).toBe(42);

    // 200 OK for admin querying tier2_launch
    const adminTier2Res = await request.get("/api/admin/eval-suite?suite=tier2_launch", {
      headers: {
        "x-user-role": "admin",
      },
    });
    expect(adminTier2Res.status()).toBe(200);
    const tier2Data = await adminTier2Res.json();
    expect(tier2Data.valid).toBe(true);
    expect(tier2Data.total_cases).toBeGreaterThanOrEqual(150);
  });
});
