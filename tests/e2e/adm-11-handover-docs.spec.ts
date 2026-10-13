import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("ADM-11: Handover documents (PRD §15.8, §21, §22, TECH-30)", () => {
  const adminToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  const studentToken = JSON.stringify({
    sub: "user_2test_stu_001",
    role: "student",
  });

  test("AC1: All 5 handover documents exist in repository with required sections", async () => {
    const projectRoot = process.cwd();
    const docsDir = path.join(projectRoot, "docs");

    const requiredDocs = [
      {
        filename: "architecture-note.md",
        keywords: ["hub-and-spoke", "Tutor Orchestrator", "SymPy", "hint ladder"],
      },
      {
        filename: "threat-model.md",
        keywords: ["STRIDE", "Prompt Injection", "Answer / Value Leakage", "Australian Privacy"],
      },
      {
        filename: "evaluation-report.md",
        keywords: ["Gate A", "42", "Critical", "Leakage", "Golden Demo Trajectory"],
      },
      {
        filename: "runbook.md",
        keywords: ["Incident Response", "Kill-Switch", "DIALOGUE_MODE", "Disaster Recovery", "RPO", "RTO"],
      },
      {
        filename: "customer-brief.md",
        keywords: ["Target Audience", "AC9M7N08", "VC2M7N09", "Decision Boundaries", "Pilot Readiness"],
      },
    ];

    for (const doc of requiredDocs) {
      const fullPath = path.join(docsDir, doc.filename);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content.length).toBeGreaterThan(500);

      for (const kw of doc.keywords) {
        expect(content.toLowerCase()).toContain(kw.toLowerCase());
      }
    }
  });

  test("AC2: API endpoint GET /api/admin/handover-documents verifies documents and enforces RBAC", async ({ request }) => {
    // 1. Unauthorized without token (401)
    const noAuthRes = await request.get("/api/admin/handover-documents");
    expect(noAuthRes.status()).toBe(401);

    // 2. Forbidden for non-admin role (403)
    const forbiddenRes = await request.get("/api/admin/handover-documents", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(forbiddenRes.status()).toBe(403);

    // 3. Admin successfully retrieves handover readiness
    const adminRes = await request.get("/api/admin/handover-documents", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminRes.ok()).toBeTruthy();

    const json = await adminRes.json();
    expect(json.handover_ready).toBe(true);
    expect(json.total_required).toBe(5);
    expect(json.total_present).toBe(5);
    expect(json.documents.length).toBe(5);

    // Verify runbook specifically flags incident response
    const runbookDoc = json.documents.find((d: any) => d.id === "operating_runbook");
    expect(runbookDoc).toBeDefined();
    expect(runbookDoc.exists).toBe(true);
    expect(runbookDoc.has_incident_response).toBe(true);
  });

  test("AC3: Admin handover dashboard displays document availability and incident response confirmation", async ({ page }) => {
    await page.goto("/admin/handover");

    // Verify readiness badge
    const statusBadge = page.locator('[data-testid="handover-status-badge"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText("Ready for Demo Handover");

    // Verify incident response indicator
    const incidentBadge = page.locator('[data-testid="incident-response-badge"]');
    await expect(incidentBadge).toBeVisible();
    await expect(incidentBadge).toContainText("Included in Runbook");

    // Verify each document card is displayed
    await expect(page.locator('[data-testid="handover-doc-architecture_note"]')).toBeVisible();
    await expect(page.locator('[data-testid="handover-doc-threat_model"]')).toBeVisible();
    await expect(page.locator('[data-testid="handover-doc-evaluation_report"]')).toBeVisible();
    await expect(page.locator('[data-testid="handover-doc-operating_runbook"]')).toBeVisible();
    await expect(page.locator('[data-testid="handover-doc-customer_brief"]')).toBeVisible();
  });
});
