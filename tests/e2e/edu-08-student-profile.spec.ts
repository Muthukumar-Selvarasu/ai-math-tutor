import { test, expect } from "@playwright/test";

test.describe("EDU-08: Student learning profile and misconception trends (FR-08, FR-12)", () => {
  const adminToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const unassignedTeacherToken = JSON.stringify({
    sub: "user_2test_tch_unassigned_999",
    role: "teacher",
  });

  const studentToken = JSON.stringify({
    sub: "user_2test_stu_001",
    role: "student",
  });

  const adminHeader = { Authorization: `Bearer ${adminToken}` };
  const teacherHeader = { Authorization: `Bearer ${teacherToken}` };
  const unassignedHeader = { Authorization: `Bearer ${unassignedTeacherToken}` };

  test.beforeEach(async ({ request }) => {
    // Ensure teacher is assigned to cohort_ratio_foundation
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: "user_internal_tch_001",
        member_role: "teacher",
      },
    });
  });

  test("AC 1: Given assigned student, profile shows skill mastery, hint dependency, transfer results, recent sessions, and >= 95% source event linkage", async ({
    request,
  }) => {
    const studentId = `stu_profile_${Date.now()}`;

    // Enroll student into teacher's cohort
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: studentId,
        member_role: "student",
      },
    });

    // Seed session 1: with attempts (hints and misconceptions)
    const sessionRes1 = await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "completed",
        transfer_offered: true,
        transfer_outcome: "correct",
        hint_level: 1,
        attempts: [
          { attempt_number: 1, verdict: "incorrect", hint_level: 0, misconception_code: "m_ratio_part_whole" },
          { attempt_number: 2, verdict: "correct", hint_level: 1, misconception_code: null },
        ],
      },
    });
    expect(sessionRes1.ok()).toBeTruthy();

    // Fetch profile
    const profileRes = await request.get(`/api/teacher/students/${studentId}/profile`, {
      headers: teacherHeader,
    });
    expect(profileRes.status()).toBe(200);

    const profile = await profileRes.json();

    // 1. Skill Mastery
    expect(profile.skills).toBeInstanceOf(Array);
    expect(profile.skills.length).toBeGreaterThan(0);
    const sharingSkill = profile.skills.find((s: any) => s.skill_id === "ratio.sharing");
    expect(sharingSkill).toBeDefined();
    expect(sharingSkill.skill_name).toBeTruthy();
    expect(["Proficient", "Developing", "Practising", "Exploring"]).toContain(sharingSkill.status);

    // 2. Hint Dependency Profile
    expect(profile.hint_dependency).toBeDefined();
    expect(profile.hint_dependency.total_attempts).toBe(2);
    expect(profile.hint_dependency.level0_count).toBe(1);
    expect(profile.hint_dependency.level1_3_count).toBe(1);
    expect(profile.hint_dependency.summary).toBeTruthy();

    // 3. Transfer Results
    expect(profile.transfer_results).toBeInstanceOf(Array);
    expect(profile.transfer_results.length).toBeGreaterThan(0);
    expect(profile.transfer_results[0].transfer_outcome).toBe("correct");
    expect(profile.transfer_results[0].source_event_id).toBeTruthy();

    // 4. Recent Sessions
    expect(profile.recent_sessions).toBeInstanceOf(Array);
    expect(profile.recent_sessions.length).toBeGreaterThan(0);
    expect(profile.recent_sessions[0].session_id).toBeTruthy();

    // 5. Source Event Linkage (Success metric: >= 95%)
    expect(profile.evidence_traceability.claims_linked_to_source_events_pct).toBeGreaterThanOrEqual(95);
  });

  test("AC 2: Cohort trends shows misconception counts with confidence and evidence limit warning when sample is small", async ({
    request,
  }) => {
    // 1. Check trends on a fresh cohort with sparse attempts
    const sparseCohortId = `cohort_sparse_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: sparseCohortId,
        name: "Sparse Test Cohort",
      },
    });

    // Assign teacher to sparse cohort
    await request.post(`/api/admin/cohorts/${sparseCohortId}/assignments`, {
      headers: adminHeader,
      data: {
        user_id: "user_internal_tch_001",
        member_role: "teacher",
      },
    });

    const trendsRes = await request.get(`/api/teacher/cohorts/${sparseCohortId}/trends`, {
      headers: teacherHeader,
    });
    expect(trendsRes.status()).toBe(200);

    const trendsData = await trendsRes.json();
    // Since sample is small (0 attempts), evidence warning must be present
    expect(trendsData.has_evidence_warning).toBe(true);
    expect(trendsData.evidence_status).toBe("small_sample_warning");
    expect(trendsData.evidence_limit_warning).toContain("Evidence limit");

    // 2. Add enough sessions & attempts across >= 3 students to build strong cohort evidence
    const student1 = `stu_c1_${Date.now()}`;
    const student2 = `stu_c2_${Date.now()}`;
    const student3 = `stu_c3_${Date.now()}`;

    for (const sid of [student1, student2, student3]) {
      await request.post(`/api/admin/cohorts/${sparseCohortId}/assignments`, {
        headers: adminHeader,
        data: { user_id: sid, member_role: "student" },
      });
      await request.post("/api/sessions", {
        data: {
          question_id: "ratio_share_001",
          student_id: sid,
          cohort_id: sparseCohortId,
          attempts: [
            { attempt_number: 1, verdict: "incorrect", misconception_code: "m_additive_scaling" },
            { attempt_number: 2, verdict: "incorrect", misconception_code: "m_additive_scaling" },
          ],
        },
      });
    }

    const richTrendsRes = await request.get(`/api/teacher/cohorts/${sparseCohortId}/trends`, {
      headers: teacherHeader,
    });
    expect(richTrendsRes.status()).toBe(200);
    const richTrends = await richTrendsRes.json();

    // Now has 6 attempts across 3 students -> sufficient evidence
    expect(richTrends.has_evidence_warning).toBe(false);
    expect(richTrends.evidence_status).toBe("sufficient_evidence");
    expect(richTrends.trends.length).toBeGreaterThan(0);
    const additiveTrend = richTrends.trends.find((t: any) => t.code === "m_additive_scaling");
    expect(additiveTrend).toBeDefined();
    expect(additiveTrend.occurrences).toBe(6);
    expect(additiveTrend.student_count).toBe(3);
    expect(additiveTrend.confidence).toBe("High");
  });

  test("AC 3: Access denied and logged when teacher is not assigned to the student", async ({
    request,
  }) => {
    // Create an unassigned student in another cohort
    const otherCohortId = `cohort_unassigned_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: otherCohortId,
        name: "Other Cohort",
      },
    });

    const otherStudent = `stu_other_${Date.now()}`;
    await request.post(`/api/admin/cohorts/${otherCohortId}/assignments`, {
      headers: adminHeader,
      data: {
        user_id: otherStudent,
        member_role: "student",
      },
    });

    // Teacher (assigned only to ratio foundation) attempts access to otherStudent
    const res = await request.get(`/api/teacher/students/${otherStudent}/profile`, {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");

    // Verify audit log has recorded the denied access
    const auditRes = await request.get("/api/admin/audit-events?event_type=student_profile_access_denied", {
      headers: adminHeader,
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    const deniedEvent = auditData.events.find(
      (e: any) => e.details?.target_student_id === otherStudent
    );
    expect(deniedEvent).toBeDefined();
    expect(deniedEvent.reason).toBe("unassigned_student_or_unauthorized_role");
  });

  test("Non-functional: Profile and trends calculation handles 150 synthetic students in < 3 seconds", async ({
    request,
  }) => {
    const perfCohortId = `cohort_perf_${Date.now()}`;
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: perfCohortId,
        name: "Performance Benchmark Cohort",
      },
    });

    await request.post(`/api/admin/cohorts/${perfCohortId}/assignments`, {
      headers: adminHeader,
      data: {
        user_id: "user_internal_tch_001",
        member_role: "teacher",
      },
    });

    // Seed 150 synthetic students with session attempts
    const startSeed = Date.now();
    for (let i = 0; i < 150; i++) {
      const sId = `perf_stu_${i}_${startSeed}`;
      await request.post("/api/sessions", {
        data: {
          question_id: "ratio_share_001",
          student_id: sId,
          cohort_id: perfCohortId,
          attempts: [
            { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
            { attempt_number: 2, verdict: "correct" },
          ],
        },
      });
    }

    // Benchmark cohort trends retrieval for 150 students
    const startTrends = Date.now();
    const trendsRes = await request.get(`/api/teacher/cohorts/${perfCohortId}/trends`, {
      headers: teacherHeader,
    });
    const trendsElapsed = Date.now() - startTrends;

    expect(trendsRes.status()).toBe(200);
    expect(trendsElapsed).toBeLessThan(3000); // Must be under 3 seconds per Non-functional note
  });

  test("UI: Student Profile page renders skill cards, hint profile, transfer outcomes, and tab switching", async ({
    page,
    request,
  }) => {
    const studentId = `ui_stu_${Date.now()}`;
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
        transfer_offered: true,
        transfer_outcome: "correct",
        attempts: [
          { attempt_number: 1, verdict: "correct", hint_level: 0 },
        ],
      },
    });

    await page.goto(`/teacher/students/${studentId}`);

    // Check heading
    await expect(page.locator("h1")).toContainText(`Student Learning Profile: ${studentId}`);

    // Check skill cards
    await expect(page.locator('[data-testid="skill-card-ratio.sharing"]')).toBeVisible();

    // Check Hint Dependency Profile
    await expect(page.getByText("Hint Dependency Profile")).toBeVisible();
    await expect(page.getByText("Independent (Level 0)")).toBeVisible();

    // Switch to Cohort Misconception Trends tab
    await page.getByRole("button", { name: "Cohort Misconception Trends" }).click();
    await expect(page.getByText("Cohort Recurring Misconception Gaps")).toBeVisible();
  });
});
