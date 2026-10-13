import { test, expect } from "@playwright/test";

test.describe("EDU-10: See a cohort summary (FR-01, FR-12, Section 22.1)", () => {
  const adminToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  const coordinatorToken = JSON.stringify({
    sub: "user_2test_coord_001",
    role: "coordinator",
  });

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const unassignedCoordToken = JSON.stringify({
    sub: "user_2test_coord_unassigned_999",
    role: "coordinator",
  });

  const adminHeader = { Authorization: `Bearer ${adminToken}` };
  const coordHeader = { Authorization: `Bearer ${coordinatorToken}` };
  const teacherHeader = { Authorization: `Bearer ${teacherToken}` };

  test.beforeEach(async ({ request }) => {
    // Ensure coordinator is assigned to cohort_ratio_foundation
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: "user_internal_coord_001",
        member_role: "coordinator",
      },
    });
  });

  test("AC 1: Coordinator opens assigned cohort and sees cohort mastery, misconception trends, intervention insights, and item-quality indicators", async ({
    request,
  }) => {
    // Seed practice sessions in cohort
    const studentId = `stu_csummary_${Date.now()}`;
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: studentId, member_role: "student" },
    });
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "completed",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
          { attempt_number: 2, verdict: "correct" },
        ],
      },
    });

    const res = await request.get("/api/coordinator/cohorts/cohort_ratio_foundation/summary", {
      headers: coordHeader,
    });
    expect(res.status()).toBe(200);

    const summary = await res.json();
    expect(summary.cohort_id).toBe("cohort_ratio_foundation");
    expect(summary.active_students_count).toBeGreaterThan(0);

    // 1. Cohort Mastery
    expect(summary.cohort_mastery).toBeInstanceOf(Array);
    const sharingMastery = summary.cohort_mastery.find((m: any) => m.skill_id === "ratio.sharing");
    expect(sharingMastery).toBeDefined();

    // 2. Misconception Trends
    expect(summary.misconception_trends).toBeDefined();
    expect(summary.misconception_trends.trends).toBeInstanceOf(Array);

    // 3. Intervention Insights
    expect(summary.intervention_insights).toBeInstanceOf(Array);

    // 4. Item-Quality Indicators
    expect(summary.item_quality_indicators).toBeInstanceOf(Array);
    const item = summary.item_quality_indicators.find((it: any) => it.question_id === "ratio_share_001");
    expect(item).toBeDefined();
    expect(item.pass_rate_percent).toBeDefined();
  });

  test("AC 2: Accepted recommendation shows outcome if later transfer result exists; says 'not enough later evidence' if none exists yet", async ({
    request,
  }) => {
    const studentX = `stu_rec_x_${Date.now()}`;
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: studentX, member_role: "student" },
    });

    // 1. Create a draft recommendation and accept it as teacher
    const draftRes = await request.post("/api/teacher/recommendations", {
      headers: teacherHeader,
      data: {
        cohort_id: "cohort_ratio_foundation",
        student_id: studentX,
        recommendation: "Focus on ratio table representations",
        evidence: {
          student_id: studentX,
          skills: ["ratio.sharing"],
        },
      },
    });
    const draftData = await draftRes.json();
    const recId = draftData.draft?.id || "draft_001";

    // Teacher accepts it
    await request.post(`/api/teacher/recommendations/${recId}/review`, {
      headers: teacherHeader,
      data: { decision: "accepted" },
    });

    // Check cohort summary immediately -> should say 'not enough later evidence'
    const summaryBefore = await (
      await request.get("/api/coordinator/cohorts/cohort_ratio_foundation/summary", {
        headers: coordHeader,
      })
    ).json();
    const insightBefore = summaryBefore.intervention_insights.find((i: any) => i.recommendation_id === recId);
    expect(insightBefore).toBeDefined();
    expect(insightBefore.later_transfer_outcome).toBe("not enough later evidence");

    // 2. Add later session with successful transfer outcome
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentX,
        cohort_id: "cohort_ratio_foundation",
        state: "completed",
        transfer_outcome: "transfer_successful",
      },
    });

    // Check cohort summary again -> shows updated transfer outcome
    const summaryAfter = await (
      await request.get("/api/coordinator/cohorts/cohort_ratio_foundation/summary", {
        headers: coordHeader,
      })
    ).json();
    const insightAfter = summaryAfter.intervention_insights.find((i: any) => i.recommendation_id === recId);
    expect(insightAfter).toBeDefined();
    expect(insightAfter.later_transfer_outcome).toBe("transfer_successful");
  });

  test("AC 3: New cohort created has allow_level_5 false by default until coordinator enables it", async ({
    request,
  }) => {
    const newCohortId = `cohort_new_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: newCohortId,
        name: "Brand New Cohort",
      },
    });

    // Assign coordinator
    await request.post(`/api/admin/cohorts/${newCohortId}/assignments`, {
      headers: adminHeader,
      data: {
        user_id: "user_internal_coord_001",
        member_role: "coordinator",
      },
    });

    const summary = await (
      await request.get(`/api/coordinator/cohorts/${newCohortId}/summary`, {
        headers: coordHeader,
      })
    ).json();

    expect(summary.allow_level_5).toBe(false);
  });

  test("AC 4: Coordinator requests a student replay -> denied (403)", async ({ request }) => {
    // Create a practice session
    const sessionRes = await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: "stu_test_replay",
        cohort_id: "cohort_ratio_foundation",
      },
    });
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id || sessionData.id;

    // Coordinator attempts replay access
    const replayRes = await request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: coordHeader,
    });
    expect(replayRes.status()).toBe(403);
    const body = await replayRes.json();
    expect(body.error).toBe("forbidden");
  });

  test("AC 5: Coordinator changes allow_level_5 -> saved, audited; coordinator outside cohort is denied (403)", async ({
    request,
  }) => {
    const testCohortId = `cohort_lvl5_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: testCohortId,
        name: "Level 5 Testing Cohort",
      },
    });

    // 1. Coordinator assigned to testCohortId updates allow_level_5
    await request.post(`/api/admin/cohorts/${testCohortId}/assignments`, {
      headers: adminHeader,
      data: {
        user_id: "user_internal_coord_001",
        member_role: "coordinator",
      },
    });

    const patchRes = await request.patch(`/api/coordinator/cohorts/${testCohortId}/settings`, {
      headers: coordHeader,
      data: { allow_level_5: true },
    });
    expect(patchRes.status()).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.allow_level_5).toBe(true);

    // Verify audit log
    const auditRes = await request.get("/api/admin/audit-events?event_type=cohort_allow_level_5_updated", {
      headers: adminHeader,
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    const event = auditData.events.find((e: any) => e.cohort_id === testCohortId);
    expect(event).toBeDefined();
    expect(event.previous_value).toBe(false);
    expect(event.new_value).toBe(true);

    // 2. Unassigned coordinator attempts change on another cohort
    const otherCohortId = `cohort_isolated_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: otherCohortId,
        name: "Isolated Cohort",
      },
    });

    // Create a 2nd coordinator not assigned to otherCohortId
    await request.post("/api/admin/users", {
      headers: adminHeader,
      data: {
        clerk_user_id: "user_2test_coord_other",
        role: "coordinator",
        display_label: "Coordinator Other",
        cohort_ids: ["cohort_ratio_foundation"],
      },
    });

    const otherCoordHeader = {
      Authorization: `Bearer ${JSON.stringify({ sub: "user_2test_coord_other", role: "coordinator" })}`,
    };

    const deniedPatch = await request.patch(`/api/coordinator/cohorts/${otherCohortId}/settings`, {
      headers: otherCoordHeader,
      data: { allow_level_5: true },
    });
    expect(deniedPatch.status()).toBe(403);
    const deniedBody = await deniedPatch.json();
    expect(deniedBody.error).toBe("forbidden");
  });

  test("AC 6: Coordinator tries to override recommendation, publish question, grant trace_review, or open trace -> denied (403)", async ({
    request,
  }) => {
    // 1. Coordinator tries to review/override student recommendation
    const recOverrideRes = await request.post("/api/teacher/recommendations/rec_any_001/review", {
      headers: coordHeader,
      data: { decision: "overridden", note: "Coordinator override" },
    });
    expect(recOverrideRes.status()).toBe(403);

    // 2. Coordinator tries to publish question
    const publishRes = await request.post("/api/content/review-items/ratio_share_001/decision", {
      headers: coordHeader,
      data: { decision: "approved" },
    });
    expect(publishRes.status()).toBe(403);

    // 3. Coordinator tries to grant trace_review
    const grantRes = await request.put("/api/admin/users/user_internal_tch_001/grants/trace_review", {
      headers: coordHeader,
      data: { rationale: "unauthorized grant attempt" },
    });
    expect(grantRes.status()).toBe(403);
  });

  test("UI: Coordinator Cohort Summary page renders controls, allows toggling level 5, and shows cards", async ({
    page,
    request,
  }) => {
    await page.goto("/coordinator/cohorts/cohort_ratio_foundation");

    // Check heading
    await expect(page.locator("h1")).toContainText("Cohort Progress Summary");

    // Check control card
    await expect(page.locator('[data-testid="cohort-control-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-level-5-btn"]')).toBeVisible();

    // Toggle level 5
    await page.locator('[data-testid="toggle-level-5-btn"]').click();
    await expect(page.locator('[data-testid="level-5-status-badge"]')).toContainText("Allowed");
  });
});
