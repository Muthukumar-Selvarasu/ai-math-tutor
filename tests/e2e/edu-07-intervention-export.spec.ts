import { test, expect } from "@playwright/test";

test.describe("EDU-07: Export an intervention summary (OP-23, FR-12, Section 12.2)", () => {
  const assignedTeacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const unassignedTeacherToken = JSON.stringify({
    sub: "user_2test_tch_002",
    role: "teacher",
  });

  const studentToken = JSON.stringify({
    sub: "user_2test_stu_001",
    role: "student",
  });

  let createdRecId: string;

  test.beforeAll(async ({ request }) => {
    // Ingest a standard draft recommendation to export
    const draftRes = await request.post("/api/teacher/recommendations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${assignedTeacherToken}`,
      },
      data: {
        cohort_id: "cohort_ratio_foundation",
        student_id: "stu_101",
        recommendation: "Conduct structured peer ratio matching activity",
        reason: "Student repeatedly misidentified parts-to-part as parts-to-whole.",
        confidence: "Moderate",
        limitations: "Evidence gathered from 4 practice items only. Clinical observation recommended.",
        suggested_action: "Provide visual bar models and tactile counters before next session.",
        evidence: {
          attempts: [{ input_value: "3:5", verdict: "incorrect", hint_level: 2 }],
          skills: ["ratio.part_to_whole"],
          timing: { average_duration_ms: 14000 },
          hint_levels: [1, 2],
          sessions: ["sess_edu07_test"],
        },
      },
    });

    expect(draftRes.ok()).toBeTruthy();
    const draftJson = await draftRes.json();
    createdRecId = draftJson.draft.id;
  });

  test("AC1 & AC2: Assigned teacher exports intervention summary with AI draft label, evidence, limitations, and audit trail", async ({ request }) => {
    // 1. Export recommendation via OP-23 POST /api/teacher/exports
    const exportRes = await request.post("/api/teacher/exports", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${assignedTeacherToken}`,
      },
      data: {
        recommendation_ids: [createdRecId],
      },
    });

    expect(exportRes.status()).toBe(201);
    const exportJson = await exportRes.json();

    expect(exportJson.export_id).toMatch(/^exp_/);
    expect(exportJson.is_ai_draft).toBe(true);
    expect(exportJson.draft_label).toContain("AI-GENERATED DRAFT — FOR HUMAN EDUCATOR REVIEW ONLY");
    expect(exportJson.parent_contacted).toBe(false);
    expect(exportJson.student_contacted).toBe(false);

    // 2. Download/Retrieve export via OP-23 GET /api/teacher/exports/[id]
    const downloadRes = await request.get(exportJson.download_url, {
      headers: {
        Authorization: `Bearer ${assignedTeacherToken}`,
      },
    });

    expect(downloadRes.status()).toBe(200);
    const doc = await downloadRes.json();

    // Verify AI Draft labels
    expect(doc.is_ai_draft).toBe(true);
    expect(doc.draft_label).toContain("AI-GENERATED DRAFT");
    expect(doc.disclaimer).toContain("AI-generated draft requiring professional educator review");

    // Verify evidence and limitations included
    expect(doc.item_count).toBe(1);
    expect(doc.recommendations.length).toBe(1);
    const recItem = doc.recommendations[0];
    expect(recItem.id).toBe(createdRecId);
    expect(recItem.limitations).toContain("Evidence gathered from 4 practice items only");
    expect(recItem.evidence.skills).toContain("ratio.part_to_whole");
    expect(recItem.evidence.attempts.length).toBeGreaterThan(0);

    // Verify AC2: Audit trail records who exported it
    const auditRes = await request.get("/api/admin/audit-events?event_type=intervention_summary_exported", {
      headers: {
        Authorization: `Bearer ${JSON.stringify({ sub: "user_2test_adm_001", role: "administrator" })}`,
      },
    });
    expect(auditRes.ok()).toBeTruthy();
    const auditJson = await auditRes.json();
    const events = auditJson.events || auditJson;
    const exportEvent = events.find(
      (ev: any) => ev.event_type === "intervention_summary_exported" && ev.details?.export_id === exportJson.export_id
    );
    expect(exportEvent).toBeDefined();
    expect(exportEvent.actor_user_id).toBe("user_internal_tch_001");
  });

  test("AC3: Privacy safeguard ensures no message is sent to parent or student", async ({ request }) => {
    const exportRes = await request.post("/api/teacher/exports", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${assignedTeacherToken}`,
      },
      data: {
        recommendation_ids: [createdRecId],
      },
    });
    expect(exportRes.status()).toBe(201);
    const exportJson = await exportRes.json();

    // Invariant: no automated message sent to parent or student
    expect(exportJson.parent_contacted).toBe(false);
    expect(exportJson.student_contacted).toBe(false);

    const docRes = await request.get(exportJson.download_url, {
      headers: {
        Authorization: `Bearer ${assignedTeacherToken}`,
      },
    });
    const doc = await docRes.json();
    expect(doc.parent_contacted).toBe(false);
    expect(doc.student_contacted).toBe(false);
    expect(doc.automated_messages_sent).toBe(false);
    expect(doc.safeguards_notice).toContain("No messages or notifications have been transmitted to parents or students");
  });

  test("Authorisation Scoping: Unassigned teacher and student role are denied with HTTP 403", async ({ request }) => {
    // 1. Unassigned teacher cannot export recommendations for another cohort
    const unassignedRes = await request.post("/api/teacher/exports", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${unassignedTeacherToken}`,
      },
      data: {
        recommendation_ids: [createdRecId],
      },
    });
    expect(unassignedRes.status()).toBe(403);
    const unassignedJson = await unassignedRes.json();
    expect(unassignedJson.error).toBe("forbidden");

    // 2. Student role cannot export
    const studentRes = await request.post("/api/teacher/exports", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      data: {
        recommendation_ids: [createdRecId],
      },
    });
    expect(studentRes.status()).toBe(403);

    // 3. Unauthenticated request returns 401
    const anonRes = await request.post("/api/teacher/exports", {
      data: { recommendation_ids: [createdRecId] },
    });
    expect(anonRes.status()).toBe(401);
  });

  test("UI Flow: Teacher triggers export on flags page, sees draft label, safeguard notice, and download link", async ({ page }) => {
    await page.goto("/teacher/flags");

    // Ensure recommendations section loaded
    const exportBtn = page.locator('[data-testid="export-summary-btn"]');
    await expect(exportBtn).toBeVisible();

    // Trigger export
    await exportBtn.click();

    // Verify export panel appears
    const resultPanel = page.locator('[data-testid="export-result-panel"]');
    await expect(resultPanel).toBeVisible();

    // Verify AI Draft label and safeguard notice
    const draftLabel = page.locator('[data-testid="export-ai-draft-label"]');
    await expect(draftLabel).toHaveText(/AI-GENERATED DRAFT/);

    const safeguardNotice = page.locator('[data-testid="export-safeguard-notice"]');
    await expect(safeguardNotice).toContainText("Safeguard verified: No automated message sent to parent or student");

    // Verify download link exists
    const downloadLink = page.locator('[data-testid="export-download-link"]');
    await expect(downloadLink).toBeVisible();
    const href = await downloadLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/teacher\/exports\/exp_/);
  });
});
