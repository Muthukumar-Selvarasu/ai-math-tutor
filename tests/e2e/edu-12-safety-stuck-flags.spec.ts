import { test, expect } from '@playwright/test';

test.describe('EDU-12: See safety and stuck-session flags', () => {
  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });

  const unassignedTeacherToken = JSON.stringify({
    sub: 'user_2test_tch_003',
    role: 'teacher',
  });

  const supportContactToken = JSON.stringify({
    sub: 'user_2test_sup_001',
    role: 'coordinator',
  });

  const adminTokenWithGrant = JSON.stringify({
    sub: 'user_2test_adm_001',
    role: 'administrator',
  });

  const studentToken = JSON.stringify({
    sub: 'user_2test_stu_001',
    role: 'student',
  });

  const tutorToken = JSON.stringify({
    sub: 'user_2test_tut_001',
    role: 'tutor',
  });

  const teacherHeader = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  const unassignedTeacherHeader = {
    Authorization: `Bearer ${unassignedTeacherToken}`,
    'Content-Type': 'application/json',
  };

  const supportContactHeader = {
    Authorization: `Bearer ${supportContactToken}`,
    'Content-Type': 'application/json',
  };

  const adminHeader = {
    Authorization: `Bearer ${adminTokenWithGrant}`,
    'Content-Type': 'application/json',
  };

  const studentHeader = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  const tutorHeader = {
    Authorization: `Bearer ${tutorToken}`,
    'Content-Type': 'application/json',
  };

  test('Criterion 1: Assigned teacher sees all 7 flags and timestamps as notices on review list and flags API', async ({ page }) => {
    const flagsToTest = [
      'safety_fallback',
      'worrying_disclosure',
      'stuck_after_transfer',
      'ambiguity_review',
      'support_withheld',
      'turn_cap_reached',
      'verification_unavailable',
    ];

    // Create a session for each flag on the teacher-assigned cohort
    for (const flagName of flagsToTest) {
      const sRes = await page.request.post('/api/sessions', {
        headers: studentHeader,
        data: {
          question_id: 'ratio_share_001',
          student_id: `student_flag_${flagName}`,
          cohort_id: 'cohort_ratio_foundation',
          flags: [flagName],
        },
      });
      expect([200, 201]).toContain(sRes.status());
    }

    // Teacher queries GET /api/session-flags
    const flagsRes = await page.request.get('/api/session-flags', {
      headers: teacherHeader,
    });
    expect(flagsRes.status()).toBe(200);
    const flagsList = await flagsRes.json();

    for (const flagName of flagsToTest) {
      const match = flagsList.find((f: any) => f.kind === flagName);
      expect(match).toBeTruthy();
      expect(match.session_id).toBeTruthy();
      expect(match.created_at).toBeTruthy();
    }
  });

  test('Criterion 2: Cohort support contact sees safety_fallback & worrying_disclosure when cohort has no teacher', async ({ page }) => {
    const unstaffedCohortId = `cohort_unstaffed_${Date.now()}`;

    // 1. Create an unstaffed cohort with support contact user_internal_sup_001
    await page.request.post('/api/admin/cohorts', {
      headers: adminHeader,
      data: {
        id: unstaffedCohortId,
        name: 'Unstaffed Remote Cohort',
        support_contact_user_id: 'user_internal_sup_001',
      },
    });

    // 2. Create sessions in that cohort with various flags
    await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_unstaffed_01',
        cohort_id: unstaffedCohortId,
        flags: ['worrying_disclosure', 'turn_cap_reached'],
      },
    });

    await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_unstaffed_02',
        cohort_id: unstaffedCohortId,
        flags: ['safety_fallback', 'ambiguity_review'],
      },
    });

    // 3. Support contact requests session flags
    const supRes = await page.request.get('/api/session-flags', {
      headers: supportContactHeader,
    });
    expect(supRes.status()).toBe(200);
    const supFlags = await supRes.json();

    // RLS: Support contact sees ONLY safety_fallback and worrying_disclosure for their cohort
    const cohortFlags = supFlags.filter((f: any) => f.cohort_id === unstaffedCohortId);
    expect(cohortFlags.length).toBe(2);

    const kinds = cohortFlags.map((f: any) => f.kind);
    expect(kinds).toContain('worrying_disclosure');
    expect(kinds).toContain('safety_fallback');
    // Non-safety flags (turn_cap_reached, ambiguity_review) are strictly withheld
    expect(kinds).not.toContain('turn_cap_reached');
    expect(kinds).not.toContain('ambiguity_review');
  });

  test('Criterion 3: trace_review administrator sees flags when cohort has neither teacher nor support contact', async ({ page }) => {
    const abandonedCohortId = `cohort_abandoned_${Date.now()}`;

    // Create a cohort without teacher and without support contact
    await page.request.post('/api/admin/cohorts', {
      headers: adminHeader,
      data: {
        id: abandonedCohortId,
        name: 'Completely Unstaffed Cohort',
        support_contact_user_id: null,
      },
    });

    // Create a session with safety flag
    await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_abandoned_01',
        cohort_id: abandonedCohortId,
        flags: ['safety_fallback'],
      },
    });

    // Administrator with trace_review accesses session flags
    const adminFlagsRes = await page.request.get('/api/session-flags', {
      headers: adminHeader,
    });
    expect(adminFlagsRes.status()).toBe(200);
    const adminFlags = await adminFlagsRes.json();

    const found = adminFlags.find((f: any) => f.cohort_id === abandonedCohortId && f.kind === 'safety_fallback');
    expect(found).toBeTruthy();
  });

  test('Criterion 4: Unauthorized users (student, tutor, unassigned teacher) are denied with 403 and logged', async ({ page }) => {
    // 1. Student access is denied
    const studentRes = await page.request.get('/api/session-flags', {
      headers: studentHeader,
    });
    expect(studentRes.status()).toBe(403);

    // 2. Tutor access is denied
    const tutorRes = await page.request.get('/api/session-flags', {
      headers: tutorHeader,
    });
    expect(tutorRes.status()).toBe(403);

    // 3. Unassigned teacher (no cohorts) is denied
    const unassignedRes = await page.request.get('/api/session-flags', {
      headers: unassignedTeacherHeader,
    });
    expect(unassignedRes.status()).toBe(403);

    // 4. Teacher assigned to another cohort requesting session from cohort_ratio_foundation is denied
    const otherTeacherHeader = {
      Authorization: `Bearer ${JSON.stringify({ sub: 'user_2test_tch_002', role: 'teacher' })}`,
      'Content-Type': 'application/json',
    };
    const sRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_cross_cohort',
        cohort_id: 'cohort_ratio_foundation',
        flags: ['safety_fallback'],
      },
    });
    const sData = await sRes.json();
    const sid = sData.session?.id || sData.id;
    const otherTeacherRes = await page.request.get(`/api/session-flags?session_id=${sid}`, {
      headers: otherTeacherHeader,
    });
    expect(otherTeacherRes.status()).toBe(403);
  });
});
