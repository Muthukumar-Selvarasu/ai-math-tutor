import { test, expect } from "@playwright/test";

test.describe("ADM-09: Retain metadata after purge (FR-15, FR-16, PRD §11.1, §22.1 #20)", () => {
  const cronSecret = process.env.CRON_SECRET || "development-cron-secret-change-me";

  const assignedTeacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const adminWithTraceReviewToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  test("AC1 & AC2: 30-day chat bodies and attempt responses purged while keeping 365-day metadata, verifier outcomes, hint counts, and timestamps", async ({ request }) => {
    // 1. Create an active session with attempts and student input
    const createRes = await request.post("/api/sessions", {
      data: { question_id: "ratio_share_001", student_id: "stu_retention_ac1" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { session } = await createRes.json();

    // Student submits attempt with response value and reasoning
    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: "submit",
        answer_text: "15",
        free_text: "Multiplied parts by 5",
      },
    });
    expect(submitRes.ok()).toBeTruthy();

    // 2. Before purge, verify record is intact inside window (AC2)
    const beforeReplayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${assignedTeacherToken}` },
    });
    expect(beforeReplayRes.ok()).toBeTruthy();
    const beforeReplay = await beforeReplayRes.json();
    const unpurgedTurn = beforeReplay.turns[0];
    expect(unpurgedTurn.body_purged).toBe(false);
    expect(unpurgedTurn.student_response).toBe("15");
    expect(unpurgedTurn.tutor_output).toBeTruthy();

    // 3. Execute retention purge with simulated window older than now
    const purgeCutoff = new Date(Date.now() + 5000).toISOString();
    const purgeRes = await request.get(`/api/jobs/retention-purge?older_than=${purgeCutoff}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    expect(purgeRes.ok()).toBeTruthy();
    const purgeResult = await purgeRes.json();
    expect(purgeResult.status).toBe("succeeded");
    expect(purgeResult.details.records_purged).toBeGreaterThanOrEqual(1);

    // 4. Replay after purge: message body removed, but metadata preserved (AC1)
    const afterReplayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${assignedTeacherToken}` },
    });
    expect(afterReplayRes.ok()).toBeTruthy();
    const afterReplay = await afterReplayRes.json();
    const purgedTurn = afterReplay.turns[0];

    // Purged body fields
    expect(purgedTurn.body_purged).toBe(true);
    expect(purgedTurn.student_response).toBeNull();
    expect(purgedTurn.tutor_output).toBeNull();
    expect(purgedTurn.retention_notice).toContain("Message body purged in compliance with data retention policy");

    // Retained metadata fields
    expect(purgedTurn.verifier_status).toBeTruthy();
    expect(purgedTurn.hint_level).toBeDefined();
    expect(purgedTurn.prompt_version).toBeTruthy();
    expect(purgedTurn.policy_version).toBeTruthy();
    expect(purgedTurn.audit_timestamps?.created_at).toBeTruthy();
    expect(afterReplay.session_id).toBe(session.id);
    expect(afterReplay.turns.length).toBeGreaterThanOrEqual(1);
  });

  test("AC3: Audit rows and approved question diagrams are never deleted by retention-purge", async ({ request }) => {
    // 1. Fetch current audit rows count
    const auditRes = await request.get("/api/admin/audit-events", {
      headers: { Authorization: `Bearer ${adminWithTraceReviewToken}` },
    });
    expect(auditRes.ok()).toBeTruthy();
    const auditJson = await auditRes.json();
    const initialAuditCount = auditJson.total || (auditJson.events || []).length;
    expect(initialAuditCount).toBeGreaterThan(0);

    // 2. Run retention purge with aggressively past cutoff
    const purgeCutoff = new Date(Date.now() + 60000).toISOString();
    const purgeRes = await request.get(`/api/jobs/retention-purge?older_than=${purgeCutoff}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    expect(purgeRes.ok()).toBeTruthy();
    const purgeJson = await purgeRes.json();

    // Verify audit rows were retained and not decreased
    expect(purgeJson.details.audit_rows_retained).toBeGreaterThanOrEqual(initialAuditCount);
    expect(purgeJson.details.approved_diagrams_retained).toBeGreaterThanOrEqual(1);

    // Verify audit log endpoint still returns all events
    const auditCheckRes = await request.get("/api/admin/audit-events", {
      headers: { Authorization: `Bearer ${adminWithTraceReviewToken}` },
    });
    const auditCheckJson = await auditCheckRes.json();
    const postPurgeAuditCount = auditCheckJson.total || (auditCheckJson.events || []).length;
    expect(postPurgeAuditCount).toBeGreaterThanOrEqual(initialAuditCount);
  });

  test("AC4 & AC5: Purged turn in replay renders retention notice and trace_review administrator sees expired trace notice", async ({ request, page }) => {
    // 1. Create session and attempt
    const createRes = await request.post("/api/sessions", {
      data: { question_id: "ratio_share_001", student_id: "stu_retention_replay" },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: "submit", answer_text: "20" },
    });

    // 2. Purge session
    await request.get(`/api/jobs/retention-purge?older_than=${new Date(Date.now() + 5000).toISOString()}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    // 3. Admin opens replay API: trace is replaced with 'expired' notice (AC5)
    const adminReplayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${adminWithTraceReviewToken}` },
    });
    expect(adminReplayRes.ok()).toBeTruthy();
    const adminReplay = await adminReplayRes.json();
    const adminTurn = adminReplay.turns[0];
    expect(adminTurn.trace_link).toBeNull();
    expect(adminTurn.trace_notice).toBe("expired");

    // 4. UI check: Teacher opens session replay page, sees purged body notice and retained hint metadata
    await page.goto(`/teacher/sessions/${session.id}/replay`);

    // Verify purged notice is displayed in UI (AC4)
    const purgedNotice = page.locator('[data-testid="purged-body-notice"]');
    await expect(purgedNotice).toBeVisible();
    await expect(purgedNotice).toContainText("Message body purged in compliance with data retention policy");

    // Verify retained metadata is rendered
    const verifierBadge = page.locator('[data-testid="turn-verifier-status"]');
    await expect(verifierBadge).toBeVisible();

    const hintBadge = page.locator('[data-testid="turn-hint-level"]');
    await expect(hintBadge).toBeVisible();
  });
});
