import { test, expect } from "@playwright/test";
import { getStudentsNeedingReview, evaluateStudentReviewFlags } from "../../lib/student-review.js";

test.describe("EDU-01: See students needing review (PRD §22.1 #22, FR-12)", () => {
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

  test("AC 1: Student with at least 3 attempts and same misconception 3 times on one skill is flagged with reason", async ({ request }) => {
    const studentId = `student_misconception_${Date.now()}`;

    // Assign student to teacher's cohort
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: studentId,
        member_role: "student",
      },
    });

    // Create session with 3 attempts sharing misconception 'm_ratio_part_whole'
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "active",
        attempts: [
          {
            attempt_number: 1,
            input_value: "3:7",
            verdict: "incorrect",
            misconception_code: "m_ratio_part_whole",
            hint_level: 1,
            timestamp: "2026-10-13T10:00:00Z",
          },
          {
            attempt_number: 2,
            input_value: "3:10",
            verdict: "incorrect",
            misconception_code: "m_ratio_part_whole",
            hint_level: 2,
            timestamp: "2026-10-13T10:02:00Z",
          },
          {
            attempt_number: 3,
            input_value: "4:10",
            verdict: "incorrect",
            misconception_code: "m_ratio_part_whole",
            hint_level: 3,
            timestamp: "2026-10-13T10:04:00Z",
          },
        ],
      },
    });

    const res = await request.get("/api/teacher/review-list", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const data = await res.json();
    const studentRow = data.find((s: any) => s.student_id === studentId);
    expect(studentRow).toBeDefined();
    expect(studentRow.flagged).toBe(true);
    expect(studentRow.evidence_status).toBe("needs_review");
    expect(studentRow.matched_rules).toContain("same_misconception_3_times");
    expect(studentRow.reason).toContain("m_ratio_part_whole");
    expect(studentRow.relevant_attempts_count).toBe(3);
  });

  test("AC 1: Student with hint level 4 or 5 on 2 of the last 5 attempts is flagged", async ({ request }) => {
    const studentId = `student_high_hints_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: studentId,
        member_role: "student",
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "active",
        attempts: [
          { attempt_number: 1, input_value: "5", verdict: "incorrect", hint_level: 1 },
          { attempt_number: 2, input_value: "6", verdict: "incorrect", hint_level: 2 },
          { attempt_number: 3, input_value: "7", verdict: "incorrect", hint_level: 4 },
          { attempt_number: 4, input_value: "8", verdict: "incorrect", hint_level: 3 },
          { attempt_number: 5, input_value: "9", verdict: "incorrect", hint_level: 5 },
        ],
      },
    });

    const res = await request.get("/api/teacher/review-list", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const data = await res.json();
    const studentRow = data.find((s: any) => s.student_id === studentId);
    expect(studentRow).toBeDefined();
    expect(studentRow.flagged).toBe(true);
    expect(studentRow.matched_rules).toContain("high_hints_in_recent_attempts");
    expect(studentRow.reason).toContain("Hint level 4 or 5 reached on 2 of the last 5 attempts");
  });

  test("AC 1: Student with transfer incorrect or skipped twice is flagged", async ({ request }) => {
    const studentId = `student_trans_trouble_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: studentId,
        member_role: "student",
      },
    });

    // Session 1: transfer declined/skipped
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "completed",
        flags: ["transfer_skipped"],
        attempts: [
          { attempt_number: 1, input_value: "5", verdict: "correct", hint_level: 0 },
        ],
      },
    });

    // Session 2: transfer stuck
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "stuck",
        flags: ["stuck_after_transfer"],
        attempts: [
          { attempt_number: 1, input_value: "6", verdict: "correct", hint_level: 0 },
          { attempt_number: 2, input_value: "8", verdict: "incorrect", hint_level: 1 },
        ],
      },
    });

    const res = await request.get("/api/teacher/review-list", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const data = await res.json();
    const studentRow = data.find((s: any) => s.student_id === studentId);
    expect(studentRow).toBeDefined();
    expect(studentRow.flagged).toBe(true);
    expect(studentRow.matched_rules).toContain("transfer_failure_or_skipped_twice");
  });

  test("AC 2: Fewer than 3 relevant attempts says 'not enough evidence yet' and is NOT flagged", async ({ request }) => {
    const studentId = `student_novice_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: studentId,
        member_role: "student",
      },
    });

    // Only 2 attempts
    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: studentId,
        cohort_id: "cohort_ratio_foundation",
        state: "active",
        attempts: [
          { attempt_number: 1, input_value: "5", verdict: "incorrect", hint_level: 4 },
          { attempt_number: 2, input_value: "6", verdict: "incorrect", hint_level: 5 },
        ],
      },
    });

    const res = await request.get("/api/teacher/review-list", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);

    const data = await res.json();
    const studentRow = data.find((s: any) => s.student_id === studentId);
    expect(studentRow).toBeDefined();
    expect(studentRow.flagged).toBe(false);
    expect(studentRow.evidence_status).toBe("not_enough_evidence_yet");
    expect(studentRow.reason).toBe("not enough evidence yet");
  });

  test("AC 3: Only assigned students are listed; unassigned students or cohorts are excluded", async ({ request }) => {
    const assignedStudent = `student_assigned_${Date.now()}`;
    const unassignedStudent = `student_unassigned_${Date.now()}`;

    // Create another cohort
    await request.post("/api/admin/cohorts", {
      headers: adminHeader,
      data: {
        id: "cohort_algebra_advanced",
        name: "Year 8 Algebra Advanced",
      },
    });

    // Assign assignedStudent to cohort_ratio_foundation
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: {
        user_id: assignedStudent,
        member_role: "student",
      },
    });

    // Assign unassignedStudent to cohort_algebra_advanced
    await request.post("/api/admin/cohorts/cohort_algebra_advanced/assignments", {
      headers: adminHeader,
      data: {
        user_id: unassignedStudent,
        member_role: "student",
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: assignedStudent,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "correct", hint_level: 0 },
          { attempt_number: 2, verdict: "correct", hint_level: 0 },
          { attempt_number: 3, verdict: "correct", hint_level: 0 },
        ],
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: unassignedStudent,
        cohort_id: "cohort_algebra_advanced",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", hint_level: 4 },
          { attempt_number: 2, verdict: "incorrect", hint_level: 4 },
          { attempt_number: 3, verdict: "incorrect", hint_level: 4 },
        ],
      },
    });

    // Teacher of cohort_ratio_foundation calls review-list
    const res = await request.get("/api/teacher/review-list", {
      headers: teacherHeader,
    });
    expect(res.status()).toBe(200);
    const data = await res.json();

    const studentIds = data.map((s: any) => s.student_id);
    expect(studentIds).toContain(assignedStudent);
    expect(studentIds).not.toContain(unassignedStudent);

    // If teacher attempts to query cohort_algebra_advanced directly -> 403 Forbidden
    const unauthCohortRes = await request.get("/api/teacher/review-list?cohort_id=cohort_algebra_advanced", {
      headers: teacherHeader,
    });
    expect(unauthCohortRes.status()).toBe(403);
  });

  test("AC 3: Unauthorized roles (student, unauthenticated) are rejected and logged", async ({ request }) => {
    // Student role
    const studentRes = await request.get("/api/teacher/review-list", {
      headers: studentHeader,
    });
    expect(studentRes.status()).toBe(403);

    // Unauthenticated
    const unauthRes = await request.get("/api/teacher/review-list");
    expect(unauthRes.status()).toBe(401);

    // Verify audit event via admin audit events API
    const auditRes = await request.get("/api/admin/audit-events?event_type=review_list_access_denied", {
      headers: adminHeader,
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    const deniedEvent = auditData.events.find((e: any) => e.event_type === "review_list_access_denied");
    expect(deniedEvent).toBeDefined();
  });

  test("Non-functional requirement: computes review queue in under 3 seconds for 150 synthetic students", async () => {
    const startTime = Date.now();
    const syntheticSessions = [];

    for (let i = 0; i < 150; i++) {
      const sId = `syn_student_${i}`;
      const attemptCount = i % 2 === 0 ? 4 : 2;
      const attempts = [];
      for (let j = 0; j < attemptCount; j++) {
        attempts.push({
          attempt_number: j + 1,
          input_value: `${j}`,
          verdict: j % 2 === 0 ? "incorrect" : "correct",
          misconception_code: i % 5 === 0 ? "m_ratio_part_whole" : null,
          hint_level: j >= 2 ? 4 : 1,
        });
      }

      syntheticSessions.push({
        id: `syn_sess_${i}`,
        student_id: sId,
        cohort_id: "cohort_ratio_foundation",
        attempts,
      });
    }

    const teacherUser = {
      id: "user_internal_tch_001",
      role: "teacher",
      cohort_ids: ["cohort_ratio_foundation"],
    };

    const reviewItems = syntheticSessions.map((sess) =>
      evaluateStudentReviewFlags(sess.student_id, [sess])
    );
    const duration = Date.now() - startTime;

    expect(reviewItems.length).toBe(150);
    // Non-functional requirement from PRD: Loads in under 3 seconds (3000 ms)
    expect(duration).toBeLessThan(3000);
  });

  test("UI: Teacher Review Queue page (/teacher/review) displays non-leaderboard notice, filters, and student rows", async ({ page, request }) => {
    const flaggedStudent = `stu_ui_flagged_${Date.now()}`;
    const notEnoughStudent = `stu_ui_sparse_${Date.now()}`;

    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: flaggedStudent, member_role: "student" },
    });
    await request.post("/api/admin/cohorts/cohort_ratio_foundation/assignments", {
      headers: adminHeader,
      data: { user_id: notEnoughStudent, member_role: "student" },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: flaggedStudent,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", hint_level: 4 },
          { attempt_number: 2, verdict: "incorrect", hint_level: 5 },
          { attempt_number: 3, verdict: "incorrect", hint_level: 2 },
        ],
      },
    });

    await request.post("/api/sessions", {
      data: {
        question_id: "ratio_share_001",
        student_id: notEnoughStudent,
        cohort_id: "cohort_ratio_foundation",
        attempts: [
          { attempt_number: 1, verdict: "incorrect", hint_level: 1 },
        ],
      },
    });

    await page.goto("/teacher/review");

    // Check header and non-leaderboard notice
    await expect(page.locator("h1")).toContainText("Student Review Queue");
    const notice = page.locator('[data-testid="non-leaderboard-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("It is not a leaderboard");

    // Check student rows
    const flaggedRow = page.locator(`[data-testid="student-row-${flaggedStudent}"]`);
    await expect(flaggedRow).toBeVisible();
    await expect(flaggedRow.locator('[data-testid="badge-needs-review"]')).toBeVisible();

    const sparseRow = page.locator(`[data-testid="student-row-${notEnoughStudent}"]`);
    await expect(sparseRow).toBeVisible();
    await expect(sparseRow.locator('[data-testid="badge-not-enough-evidence"]')).toBeVisible();

    // Test filter tabs: Click "Needs Review"
    await page.click('button:has-text("Needs Review")');
    await expect(flaggedRow).toBeVisible();
    await expect(sparseRow).not.toBeVisible();

    // Click "Not Enough Evidence"
    await page.click('button:has-text("Not Enough Evidence")');
    await expect(sparseRow).toBeVisible();
    await expect(flaggedRow).not.toBeVisible();
  });
});
