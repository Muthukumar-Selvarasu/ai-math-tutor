import { test, expect } from "@playwright/test";

test.describe("EDU-05: Group students with similar needs (FR-12, Section 13)", () => {
  const adminToken = JSON.stringify({
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

  const adminHeader = { Authorization: `Bearer ${adminToken}` };
  const teacherHeader = { Authorization: `Bearer ${teacherToken}` };
  const studentHeader = { Authorization: `Bearer ${studentToken}` };

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

  test("AC 1: Group displays skill, misconception pattern, student count, attempt count, confidence, and students", async ({ request }) => {
    const studentA = `stu_grp_a_${Date.now()}`;
    const studentB = `stu_grp_b_${Date.now()}`;

    // Assign both students to teacher's cohort
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: studentA, member_role: "student" },
    });
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: studentB, member_role: "student" },
    });

    // Create sessions with misconception m_ratio_part_whole on ratio.sharing
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentA,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
          { attempt_number: 2, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
        ],
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentB,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
          { attempt_number: 2, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
        ],
      },
    });

    // Fetch groups as assigned teacher with refresh
    const res = await request.get("/api/teacher/student-groups?refresh=true", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const groups = await res.json();
    expect(groups.length).toBeGreaterThanOrEqual(1);

    const group = groups.find(
      (g: any) => g.skill.includes("ratio") && g.misconception_pattern === "m_ratio_part_whole"
    );
    expect(group).toBeDefined();
    expect(group.skill).toContain("ratio");
    expect(group.misconception_pattern).toBe("m_ratio_part_whole");
    expect(group.misconception_description).toContain("part-whole");
    expect(group.student_count).toBeGreaterThanOrEqual(2);
    expect(group.attempt_count).toBeGreaterThanOrEqual(4);
    expect(["Medium", "High"]).toContain(group.confidence);
    expect(group.suggested_activity).toBeTruthy();

    const studentIds = group.students.map((s: any) => s.student_id);
    expect(studentIds).toContain(studentA);
    expect(studentIds).toContain(studentB);
  });

  test("AC 2: Very little evidence shows an evidence-limit warning", async ({ request }) => {
    const studentSingle = `stu_sparse_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: studentSingle, member_role: "student" },
    });

    // Only 1 attempt with misconception m_order_reversal
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentSingle,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_order_reversal" },
        ],
      },
    });

    const res = await request.get("/api/teacher/student-groups?refresh=true", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const groups = await res.json();
    const sparseGroup = groups.find(
      (g: any) => g.misconception_pattern === "m_order_reversal"
    );
    expect(sparseGroup).toBeDefined();
    expect(sparseGroup.has_evidence_warning).toBe(true);
    expect(sparseGroup.evidence_warning).toContain("Preliminary cluster");
    expect(sparseGroup.confidence).toBe("Low");
  });

  test("AC 3: Only assigned students are included; unassigned students from other cohorts are excluded", async ({ request }) => {
    const assignedStu = `stu_cohort_assigned_${Date.now()}`;
    const unassignedStu = `stu_cohort_unassigned_${Date.now()}`;

    // Create separate cohort
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: "cohort_algebra_advanced",
        name: "Year 8 Algebra Advanced",
      },
    });

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: assignedStu, member_role: "student" },
    });

    await request.post("/api/admin/cohorts/cohort_algebra_advanced/assignments", {
      headers: adminHeader,
      data: { user_id: unassignedStu, member_role: "student" },
    });

    // Both students encounter m_additive_scaling, but in different cohorts
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: assignedStu,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_additive_scaling" },
        ],
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: unassignedStu,
        cohort_id: "cohort_algebra_advanced",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_additive_scaling" },
        ],
      },
    });

    // Teacher of cohort_ratio_foundation queries groups
    const res = await request.get("/api/teacher/student-groups?refresh=true", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const groups = await res.json();
    const scalingGroup = groups.find((g: any) => g.misconception_pattern === "m_additive_scaling");
    expect(scalingGroup).toBeDefined();

    const inGroupIds = scalingGroup.students.map((s: any) => s.student_id);
    expect(inGroupIds).toContain(assignedStu);
    expect(inGroupIds).not.toContain(unassignedStu);

    // Attempting to query unassigned cohort directly yields 403 Forbidden
    const unauthRes = await request.get("/api/teacher/student-groups?cohort_id=cohort_algebra_advanced", {
      headers: teacherHeader,
    });
    expect(unauthRes.status()).toBe(403);
  });

  test("AC 3: Unauthorized roles (student, unauthenticated) are rejected with 403/401 and logged", async ({ request }) => {
    // Student role forbidden
    const stuRes = await request.get("/api/teacher/student-groups", {
      headers: studentHeader,
    });
    expect(stuRes.status()).toBe(403);

    // Unauthenticated
    const unauthRes = await request.get("/api/teacher/student-groups");
    expect(unauthRes.status()).toBe(401);

    // Verify audit event
    const auditRes = await request.get("/api/admin/audit-events?event_type=student_groups_access_denied", {
      headers: adminHeader,
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    const deniedEvent = auditData.events.find((e: any) => e.event_type === "student_groups_access_denied");
    expect(deniedEvent).toBeDefined();
  });

  test("UI: Teacher Groups page (/teacher/groups) renders group cards, warnings, and filters", async ({ page, request }) => {
    const student1 = `stu_ui_grp1_${Date.now()}`;
    const student2 = `stu_ui_grp2_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: student1, member_role: "student" },
    });
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: student2, member_role: "student" },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: student1,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
          { attempt_number: 2, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
        ],
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: student2,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_ratio_part_whole" },
        ],
      },
    });

    // Also single attempt for order reversal to test evidence warning banner
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: student1,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", misconception_code: "m_order_reversal" },
        ],
      },
    });

    await page.goto("/teacher/groups");

    await expect(page.locator("h1")).toContainText("Intervention Groups by Need");

    // Check that group cards are rendered
    const partWholeCard = page.locator('[data-testid="group-card-grp_ratio_sharing_m_ratio_part_whole"]');
    await expect(partWholeCard).toBeVisible();
    await expect(partWholeCard.locator('[data-testid="group-skill"]')).toContainText("ratio_sharing");
    await expect(partWholeCard.locator('[data-testid="group-student-count"]')).toHaveText(/[2-9]/);

    // Check evidence warning banner on sparse card
    const reversalCard = page.locator('[data-testid="group-card-grp_ratio_sharing_m_order_reversal"]');
    await expect(reversalCard).toBeVisible();
    await expect(reversalCard.locator('[data-testid="evidence-limit-warning"]')).toBeVisible();

    // Check filter tab buttons
    await page.click('button:has-text("Established Need")');
    await expect(partWholeCard).toBeVisible();
    await expect(reversalCard).not.toBeVisible();

    await page.click('button:has-text("Preliminary / Limited Evidence")');
    await expect(reversalCard).toBeVisible();
    await expect(partWholeCard).not.toBeVisible();
  });
});
