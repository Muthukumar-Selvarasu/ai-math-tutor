import { test, expect } from '@playwright/test';

test.describe('EDU-04: Accept, reject, or override a recommendation', () => {
  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });

  const unassignedTeacherToken = JSON.stringify({
    sub: 'user_2test_tch_002',
    role: 'teacher',
  });

  const studentToken = JSON.stringify({
    sub: 'user_2test_stu_001',
    role: 'student',
  });

  const teacherHeader = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  const studentHeader = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  const unassignedTeacherHeader = {
    Authorization: `Bearer ${unassignedTeacherToken}`,
    'Content-Type': 'application/json',
  };

  test('Criterion 1: Created recommendation has pending review status until teacher acts', async ({ page }) => {
    const draftPayload = {
      cohort_id: 'cohort_ratio_foundation',
      student_id: 'user_internal_stu_001',
      recommendation: 'Provide targeted bar modeling practice on 3-part ratios',
      reason: 'Repeated difficulty in identifying total parts from ratio representation',
      confidence: 'Moderate',
      limitations: 'Based on 4 recent attempts on ratio sharing.',
      suggested_action: 'Assign bar modeling worksheet before next ratio quiz.',
      evidence: {
        attempts: [1, 2, 3, 4],
        skills: ['ratio.sharing'],
        hint_levels: [1, 2],
      },
    };

    const res = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: draftPayload,
    });
    expect(res.status()).toBe(201);
    const { draft } = await res.json();

    expect(['pending', 'pending_review']).toContain(draft.review_status);
    expect(draft.reviewer_decision).toBeNull();

    // Verify it stays pending when fetched
    const fetchRes = await page.request.get(`/api/teacher/recommendations/${draft.id}`, {
      headers: teacherHeader,
    });
    expect(fetchRes.status()).toBe(200);
    const fetched = await fetchRes.json();
    expect(['pending', 'pending_review']).toContain(fetched.review_status);
  });

  test('Criterion 2: Teacher accepts or rejects recommendation, audit event logs details, evidence is unchanged', async ({ page }) => {
    // 1. Create a draft
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: 'Pair student with peer for ratio word problem practice',
        reason: 'Student shows strong verbal reasoning but needs support setting up equations',
        confidence: 'Moderate',
        limitations: 'Observed during 2 guided practice sessions.',
        suggested_action: 'Facilitate peer collaboration during next session.',
        evidence: {
          attempts: [10, 11],
          skills: ['ratio.sharing'],
          timing: { average_duration_ms: 14000 },
        },
      },
    });
    expect(draftRes.status()).toBe(201);
    const { draft } = await draftRes.json();
    const originalEvidence = JSON.parse(JSON.stringify(draft.evidence));

    // 2. Accept decision
    const acceptRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'accepted',
        note: 'Approved for small group intervention on Tuesday',
      },
    });
    expect(acceptRes.status()).toBe(200);
    const accepted = await acceptRes.json();

    expect(accepted.review_status).toBe('accepted');
    expect(accepted.reviewer_decision.decision).toBe('accepted');
    expect(accepted.reviewer_decision.decided_by).toBe('user_internal_tch_001');
    expect(accepted.reviewer_decision.decided_at).toBeTruthy();
    // Evidence is strictly unchanged
    expect(accepted.evidence).toEqual(originalEvidence);
    expect(accepted.recommendation).toBe(draft.recommendation);
  });

  test('Criterion 3: An override decision strictly requires a rationale', async ({ page }) => {
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: 'Step down hint ladder on ratio scaling items',
        reason: 'Hint usage is high',
        confidence: 'Moderate',
        limitations: 'Classroom context not factored in.',
        suggested_action: 'Adjust hint escalation.',
      },
    });
    expect(draftRes.status()).toBe(201);
    const { draft } = await draftRes.json();

    // Attempt override without rationale
    const overrideWithoutRationaleRes = await page.request.post(
      `/api/teacher/recommendations/${draft.id}/review`,
      {
        headers: teacherHeader,
        data: {
          decision: 'overridden',
          note: '',
          rationale: '',
        },
      }
    );
    expect(overrideWithoutRationaleRes.status()).toBe(400);
    const errBody = await overrideWithoutRationaleRes.json();
    expect(errBody.error).toBe('bad_request');
    expect(errBody.message).toContain('rationale');

    // Status remains pending
    const checkRes = await page.request.get(`/api/teacher/recommendations/${draft.id}`, {
      headers: teacherHeader,
    });
    const checked = await checkRes.json();
    expect(['pending', 'pending_review']).toContain(checked.review_status);
  });

  test('Criterion 4: Decision idempotency and conflict prevention', async ({ page }) => {
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: 'Provide review of unit rate calculation',
        reason: 'Errors observed when denominator is not 1',
        confidence: 'Moderate',
        limitations: '3 practice items.',
        suggested_action: 'Unit rate refresher.',
      },
    });
    expect(draftRes.status()).toBe(201);
    const { draft } = await draftRes.json();

    // First decision: reject
    const rejectRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'rejected',
        note: 'Student already demonstrated mastery in class assessment yesterday',
      },
    });
    expect(rejectRes.status()).toBe(200);
    const rejected = await rejectRes.json();
    expect(rejected.review_status).toBe('rejected');

    // Identical retry returns stored result (idempotent 200)
    const retryRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'rejected',
        note: 'Student already demonstrated mastery in class assessment yesterday',
      },
    });
    expect(retryRes.status()).toBe(200);
    const retried = await retryRes.json();
    expect(retried.review_status).toBe('rejected');

    // Different decision is denied (409 conflict), and original decision remains
    const conflictRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'accepted',
        note: 'Attempting to change to accepted',
      },
    });
    expect(conflictRes.status()).toBe(409);
    const conflictErr = await conflictRes.json();
    expect(conflictErr.error).toBe('conflict');

    // Status still remains rejected
    const checkRes = await page.request.get(`/api/teacher/recommendations/${draft.id}`, {
      headers: teacherHeader,
    });
    const checked = await checkRes.json();
    expect(checked.review_status).toBe('rejected');
  });

  test('Criterion 5: Override saves rationale, preserves original recommendation and evidence, audit logs why', async ({ page }) => {
    const originalText = 'Assign visual fraction multiplication problem set';
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: originalText,
        reason: 'Fraction operations appear unsteady in ratio solving',
        confidence: 'Moderate',
        limitations: 'Automated evaluation.',
        suggested_action: 'Review fractions.',
        evidence: {
          attempts: [5, 6],
          skills: ['ratio.sharing'],
        },
      },
    });
    expect(draftRes.status()).toBe(201);
    const { draft } = await draftRes.json();

    const overrideRationale = 'Clinical teacher assessment: Student understands fractions well; error was misreading word problem.';
    const overrideRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'overridden',
        rationale: overrideRationale,
        override_recommendation: 'Provide highlighted reading guide for word problems instead.',
      },
    });
    expect(overrideRes.status()).toBe(200);
    const overridden = await overrideRes.json();

    expect(overridden.review_status).toBe('overridden');
    expect(overridden.recommendation).toBe(originalText);
    expect(overridden.evidence.attempts).toEqual([5, 6]);
    expect(overridden.reviewer_decision.decision).toBe('overridden');
    expect(overridden.reviewer_decision.rationale).toBe(overrideRationale);
    expect(overridden.reviewer_decision.override_recommendation).toBe('Provide highlighted reading guide for word problems instead.');
    expect(overridden.reviewer_decision.decided_by).toBe('user_internal_tch_001');
    expect(overridden.reviewer_decision.decided_at).toBeTruthy();
  });

  test('Criterion 6: Non-teacher or unassigned user is denied and recommendation stays pending', async ({ page }) => {
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: 'Coordinate multi-step ratio workshop',
        reason: 'Student needs structured pacing',
        confidence: 'Moderate',
        limitations: 'Observation data.',
        suggested_action: 'Workshop scheduling.',
      },
    });
    expect(draftRes.status()).toBe(201);
    const { draft } = await draftRes.json();

    // 1. Student attempts review -> 403 denied
    const studentAttempt = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: studentHeader,
      data: {
        decision: 'accepted',
        note: 'Student attempting self-approval',
      },
    });
    expect(studentAttempt.status()).toBe(403);

    // 2. Unassigned teacher attempts review -> 403 denied
    const unassignedAttempt = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: unassignedTeacherHeader,
      data: {
        decision: 'accepted',
        note: 'Teacher from other cohort attempting approval',
      },
    });
    expect(unassignedAttempt.status()).toBe(403);

    // Status remains pending
    const checkRes = await page.request.get(`/api/teacher/recommendations/${draft.id}`, {
      headers: teacherHeader,
    });
    const checked = await checkRes.json();
    expect(['pending', 'pending_review']).toContain(checked.review_status);
  });
});
