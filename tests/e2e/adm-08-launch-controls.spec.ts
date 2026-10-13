import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function makeMockJwt(payload: any) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "key_primary" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = "mock_signature_bytes";
  return `${header}.${body}.${signature}`;
}

test.describe("ADM-08: Platform Launch Controls & Gate A Readiness", () => {
  const baseUrl = "http://localhost:3000";
  const adminToken = makeMockJwt({
    sub: "user_2test_adm_001",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  test.beforeEach(async ({ request }) => {
    // Reset launch controls to default state before each test
    await request.post(`${baseUrl}/api/admin/launch-controls/reset`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
        "x-user-id": "user_internal_admin_001",
      },
    });
  });

  test.afterAll(async ({ request }) => {
    // Ensure controls remain reset after suite completes
    await request.post(`${baseUrl}/api/admin/launch-controls/reset`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
        "x-user-id": "user_internal_admin_001",
      },
    });
  });

  test("Criterion 1: Gate A Launch Readiness checklist evaluates and passes all requirements", async ({
    request,
  }) => {
    // 1. Admin checks launch controls and Gate A readiness
    const res = await request.get(`${baseUrl}/api/admin/launch-controls`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
      },
    });
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("success");
    expect(data.controls).toBeDefined();
    expect(data.controls.dialogue_mode).toBe("template");
    expect(data.controls.llm_student_path_disabled).toBe(true);

    const readiness = data.readiness;
    expect(readiness).toBeDefined();
    expect(readiness.gate_a_ready).toBe(true);
    expect(readiness.summary.total_checks).toBeGreaterThanOrEqual(6);
    expect(readiness.summary.failed_checks).toBe(0);

    // Verify key Gate A checklist items
    const checklistIds = readiness.checklist.map((c: any) => c.id);
    expect(checklistIds).toContain("seed_questions_approved");
    expect(checklistIds).toContain("critical_eval_suite_42");
    expect(checklistIds).toContain("dialogue_mode_default");
    expect(checklistIds).toContain("synthetic_data_isolation");
    expect(checklistIds).toContain("zero_leakage_guarantee");
    expect(checklistIds).toContain("rbac_authorisation_controls");

    const seedItem = readiness.checklist.find((c: any) => c.id === "seed_questions_approved");
    expect(seedItem.status).toBe("pass");
    expect(seedItem.metrics.approved_count).toBeGreaterThanOrEqual(10);

    const evalItem = readiness.checklist.find((c: any) => c.id === "critical_eval_suite_42");
    expect(evalItem.status).toBe("pass");
    expect(evalItem.metrics.total_cases).toBe(42);

    // 2. Non-admin (student, teacher) requests are blocked with 403 Forbidden
    const studentRes = await request.get(`${baseUrl}/api/admin/launch-controls`, {
      headers: { "x-user-role": "student" },
    });
    expect(studentRes.status()).toBe(403);

    const teacherRes = await request.get(`${baseUrl}/api/admin/launch-controls`, {
      headers: { "x-user-role": "teacher" },
    });
    expect(teacherRes.status()).toBe(403);
  });

  test("Criterion 2: Admin can toggle dialogue mode, emergency stop, and allow_level_5 with audit logging", async ({
    request,
  }) => {
    // 1. Toggle dialogue mode to opt-in llm stretch
    const updateRes = await request.post(`${baseUrl}/api/admin/launch-controls`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
        "x-user-id": "user_internal_admin_001",
      },
      data: {
        dialogue_mode: "llm",
        allow_level_5: false,
      },
    });
    expect(updateRes.status()).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.controls.dialogue_mode).toBe("llm");
    expect(updatedData.controls.allow_level_5).toBe(false);

    // 2. Verify audit event was logged
    const auditRes = await request.get(`${baseUrl}/api/admin/audit-events?event_type=launch_control_updated`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
      },
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.total).toBeGreaterThanOrEqual(1);
    const latestEvent = auditData.events[0];
    expect(latestEvent.event_type).toBe("launch_control_updated");
    expect(latestEvent.details.dialogue_mode).toBe("llm");

    // 3. Reset controls back to shipped defaults
    const resetRes = await request.post(`${baseUrl}/api/admin/launch-controls/reset`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
        "x-user-id": "user_internal_admin_001",
      },
    });
    expect(resetRes.status()).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.controls.dialogue_mode).toBe("template");
    expect(resetData.controls.llm_student_path_disabled).toBe(true);
    expect(resetData.controls.allow_level_5).toBe(true);
    expect(resetData.controls.emergency_stop).toBe(false);
  });

  test("Criterion 3: Emergency kill switch halts tutoring turns with maintenance reply", async ({
    request,
  }) => {
    // 1. Create a practice session
    const createRes = await request.post(`${baseUrl}/api/sessions`, {
      headers: { "Content-Type": "application/json" },
      data: { question_id: "ratio_share_001" },
    });
    expect(createRes.status()).toBe(201);
    const sessionData = await createRes.json();
    const session = sessionData.session || sessionData;
    const sessionId = session.id;

    // 2. Normal attempt succeeds
    const normalTurnRes = await request.post(`${baseUrl}/api/sessions/${sessionId}/events`, {
      headers: { "Content-Type": "application/json" },
      data: { event: "submit", answer_text: "12" },
    });
    expect(normalTurnRes.status()).toBe(200);

    // 3. Activate Emergency Stop kill switch
    const killRes = await request.post(`${baseUrl}/api/admin/launch-controls`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
      },
      data: { emergency_stop: true },
    });
    expect(killRes.status()).toBe(200);

    // 4. Subsequent student attempt is blocked with 503 service_unavailable
    const blockedRes = await request.post(`${baseUrl}/api/sessions/${sessionId}/events`, {
      headers: { "Content-Type": "application/json" },
      data: { event: "submit", answer_text: "15" },
    });
    expect(blockedRes.status()).toBe(503);
    const blockedJson = await blockedRes.json();
    expect(blockedJson.error.code).toBe("service_unavailable");
    expect(blockedJson.error.message).toContain("temporarily paused for maintenance");

    // 5. Disarm Emergency Stop
    await request.post(`${baseUrl}/api/admin/launch-controls`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-user-role": "admin",
      },
      data: { emergency_stop: false },
    });

    // 6. Tutoring turns resume normally
    const resumeRes = await request.post(`${baseUrl}/api/sessions/${sessionId}/events`, {
      headers: { "Content-Type": "application/json" },
      data: { event: "submit", answer_text: "15" },
    });
    expect(resumeRes.status()).toBe(200);
  });

  test("Criterion 4: Secrets and synthetic isolation checks and scripts/sync_stories.py --check pass", async () => {
    // Verify scripts/sync_stories.py --check runs cleanly
    const output = execSync("python3 scripts/sync_stories.py --check", { encoding: "utf-8" });
    expect(output).toContain("0 story differences detected");

    // Verify seed users are strictly synthetic (no real names or emails)
    const seedPath = path.resolve(process.cwd(), "content", "seed", "users.json");
    expect(fs.existsSync(seedPath)).toBe(true);
    const seedUsers = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    for (const u of seedUsers) {
      expect(u.name).toBeUndefined();
      expect(u.email).toBeUndefined();
      if (u.display_label) {
        expect(u.display_label).not.toContain("@");
      }
    }
  });

  test("Criterion 5: Admin UI displays Gate A Ready banner and allows interactive control toggles", async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/admin/launch-controls`);

    // Verify header and banner
    await expect(page.locator("h1")).toContainText("Platform Launch Controls");
    const banner = page.locator("#gate-a-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("GATE A READY");

    // Verify default dialogue mode badge
    const modeBadge = page.locator("#dialogue-mode-badge");
    await expect(modeBadge).toContainText("TEMPLATE");

    // Verify emergency stop badge
    const emergencyBadge = page.locator("#emergency-stop-badge");
    await expect(emergencyBadge).toContainText("DISARMED");

    // Click toggle to LLM mode
    const llmBtn = page.locator("#toggle-llm-mode-btn");
    await llmBtn.click();
    await expect(modeBadge).toContainText("LLM");

    // Click Reset to shipped defaults
    const resetBtn = page.locator("#reset-controls-btn");
    await resetBtn.click();
    await expect(modeBadge).toContainText("TEMPLATE");
  });
});
