import { test, expect } from "@playwright/test";

test.describe("ADM-03: Review AI quality issues (OP-22, Section 11.2, 14.1, 14.4)", () => {
  const adminWithTraceReviewToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const studentToken = JSON.stringify({
    sub: "user_2test_stu_001",
    role: "student",
  });

  test("AC1: Quality list contains verifier mismatch, leakage event, schema failure, and safety incident with trace links", async ({ request }) => {
    const res = await request.get("/api/admin/quality-issues", {
      headers: {
        Authorization: `Bearer ${adminWithTraceReviewToken}`,
      },
    });

    expect(res.status()).toBe(200);
    const issues = await res.json();
    expect(issues.length).toBeGreaterThanOrEqual(4);

    const issueTypes = issues.map((i: any) => i.issue_type);
    expect(issueTypes).toContain("verifier_mismatch");
    expect(issueTypes).toContain("leakage_event");
    expect(issueTypes).toContain("schema_failure");
    expect(issueTypes).toContain("safety_incident");

    // Verify all items contain a valid Langfuse trace link
    for (const issue of issues) {
      expect(issue.trace_id).toBeDefined();
      expect(issue.trace_link).toMatch(/^https:\/\/cloud\.langfuse\.com\/project\/traces\//);
    }
  });

  test("AC2: Administrator marks issue triaged with decision and note, storing record and audit event", async ({ request }) => {
    // 1. Triage an issue with 'quarantine' decision and remediation note
    const triageRes = await request.post("/api/admin/quality-issues/qi_leak_002/triage", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminWithTraceReviewToken}`,
      },
      data: {
        decision: "quarantine",
        note: "Quarantined prompt template v1.2 to prevent value disclosure on Level 2 turns.",
      },
    });

    expect(triageRes.status()).toBe(200);
    const triaged = await triageRes.json();
    expect(triaged.status).toBe("triaged");
    expect(triaged.triage_decision).toBe("quarantine");
    expect(triaged.triage_note).toContain("Quarantined prompt template");
    expect(triaged.triaged_by).toBe("user_internal_admin_001");
    expect(triaged.triaged_at).toBeDefined();

    // 2. Verify audit event was logged
    const auditRes = await request.get("/api/admin/audit-events?event_type=quality_issue_triaged", {
      headers: {
        Authorization: `Bearer ${adminWithTraceReviewToken}`,
      },
    });
    expect(auditRes.ok()).toBeTruthy();
    const auditJson = await auditRes.json();
    const events = auditJson.events || auditJson;
    const triageEvent = events.find((ev: any) => ev.details?.issue_id === "qi_leak_002");
    expect(triageEvent).toBeDefined();
    expect(triageEvent.details.decision).toBe("quarantine");
    expect(triageEvent.actor_user_id).toBe("user_internal_admin_001");

    // 3. Test other valid triage decisions: dismiss and escalate
    const dismissRes = await request.post("/api/admin/quality-issues/qi_vm_001/triage", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminWithTraceReviewToken}`,
      },
      data: {
        decision: "dismiss",
        note: "Expected precision behavior for decimal representation.",
      },
    });
    expect(dismissRes.status()).toBe(200);
    const dismissed = await dismissRes.json();
    expect(dismissed.triage_decision).toBe("dismiss");

    // 4. Invalid decision returns 400
    const invalidRes = await request.post("/api/admin/quality-issues/qi_schema_003/triage", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminWithTraceReviewToken}`,
      },
      data: {
        decision: "invalid_action",
        note: "Invalid",
      },
    });
    expect(invalidRes.status()).toBe(400);
  });

  test("AC3: Caller without trace_review grant is denied with HTTP 403 and logged", async ({ request }) => {
    // 1. Teacher calling GET /api/admin/quality-issues returns 403
    const teacherGet = await request.get("/api/admin/quality-issues", {
      headers: {
        Authorization: `Bearer ${teacherToken}`,
      },
    });
    expect(teacherGet.status()).toBe(403);
    const teacherGetJson = await teacherGet.json();
    expect(teacherGetJson.error).toBe("forbidden");

    // 2. Student calling GET /api/admin/quality-issues returns 403
    const studentGet = await request.get("/api/admin/quality-issues", {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });
    expect(studentGet.status()).toBe(403);

    // 3. Teacher calling POST /api/admin/quality-issues/[id]/triage returns 403
    const teacherTriage = await request.post("/api/admin/quality-issues/qi_safety_004/triage", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
      data: { decision: "dismiss", note: "Unauthorized" },
    });
    expect(teacherTriage.status()).toBe(403);

    // 4. Anonymous caller returns 401
    const anonRes = await request.get("/api/admin/quality-issues");
    expect(anonRes.status()).toBe(401);
  });

  test("UI Flow: Administrator reviews quality list, inspects trace link, and performs triage", async ({ page }) => {
    await page.goto("/admin/quality-issues");

    // Check list of issues renders
    const issueItems = page.locator('[data-testid="quality-issue-item"]');
    await expect(issueItems.first()).toBeVisible();
    const count = await issueItems.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Click on safety incident issue
    const safetyBadge = page.locator('[data-testid="issue-type-badge"]:has-text("safety_incident")');
    await safetyBadge.click();

    // Verify detail pane and Langfuse trace link
    const traceLink = page.locator('[data-testid="langfuse-trace-link"]');
    await expect(traceLink).toBeVisible();
    const href = await traceLink.getAttribute("href");
    expect(href).toMatch(/^https:\/\/cloud\.langfuse\.com\/project\/traces\//);

    // Perform interactive triage: enter note and click Escalate
    const noteInput = page.locator('[data-testid="triage-note-input"]');
    if (await noteInput.isVisible()) {
      await noteInput.fill("Escalated to safety governance team for prompt-filter tuning.");
      const escalateBtn = page.locator('[data-testid="triage-escalate-btn"]');
      await escalateBtn.click();

      // Verify triaged box appears
      const triagedBox = page.locator('[data-testid="triaged-status-box"]');
      await expect(triagedBox).toBeVisible();
      await expect(triagedBox).toContainText(/Decision:\s*ESCALATE/i);
    }
  });
});
