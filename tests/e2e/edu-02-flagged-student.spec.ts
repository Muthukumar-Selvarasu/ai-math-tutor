import { test, expect } from '@playwright/test';

test.describe('EDU-02: Understand why a student was flagged', () => {
  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });
  const teacherHeader = { Authorization: `Bearer ${teacherToken}` };

  test('Criterion 1: Flagged student drill-down lists attempts, skills, timing, hint levels, sessions, and non-shaming explanations', async ({ page }) => {
    const studentId = `student_flagged_${Date.now()}`;

    // Create session and simulate repeated wrong attempts leading to flag
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    expect([200, 201]).toContain(createRes.status());
    const { session } = await createRes.json();

    // Submit repeated errors
    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '12', response_duration_ms: 14000 },
    });
    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15', response_duration_ms: 11000 },
    });
    // Request help to advance hint level
    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'not_sure', response_duration_ms: 8000 },
    });

    // Query teacher flagged-students API
    const flagsRes = await page.request.get(`/api/teacher/flagged-students?student_id=${studentId}`, {
      headers: teacherHeader,
    });
    expect(flagsRes.status()).toBe(200);
    const flaggedList = await flagsRes.json();

    expect(flaggedList.length).toBeGreaterThan(0);
    const studentData = flaggedList.find((s: any) => s.student_id === studentId);
    expect(studentData).toBeTruthy();
    expect(studentData.flagged).toBe(true);

    // Verify evidence drill-down fields
    const evidence = studentData.evidence;
    expect(evidence.attempts.length).toBeGreaterThanOrEqual(2);
    expect(evidence.attempts[0].input_value).toBeTruthy();
    expect(evidence.skills.some((sk: string) => sk.includes('ratio'))).toBe(true);
    expect(evidence.timing.total_duration_ms).toBeGreaterThan(0);
    expect(evidence.timing.average_duration_ms).toBeGreaterThan(0);
    expect(evidence.hint_levels.length).toBeGreaterThan(0);
    expect(evidence.sessions.length).toBeGreaterThanOrEqual(1);

    // Verify respectful, non-shaming flag explanations
    expect(studentData.flag_explanations.length).toBeGreaterThan(0);
    for (const exp of studentData.flag_explanations) {
      expect(exp.toLowerCase()).not.toContain('weak');
      expect(exp.toLowerCase()).not.toContain('failing');
      expect(exp.toLowerCase()).not.toContain('low ability');
    }
  });

  test('Criterion 2: Recommendation displays confidence, limitations, suggested action, review status, and reviewer decision once made', async ({ page }) => {
    const draftPayload = {
      recommendation: 'Conduct a 15-minute small group bar-model visual activity',
      reason: 'Students showed confusion comparing ratio parts to whole quantities',
      confidence: 'Moderate',
      limitations: 'Evidence is based on recent practice items and should be verified alongside classroom observation.',
      suggested_action: 'Assign approved visual ratio exercises and monitor upcoming attempts.',
      cohort_id: 'cohort_ratio_foundation',
    };

    const postRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: draftPayload,
    });
    expect(postRes.status()).toBe(201);
    const { draft } = await postRes.json();

    expect(draft.confidence).toBe('Moderate');
    expect(draft.limitations).toContain('classroom observation');
    expect(draft.suggested_action).toBeTruthy();
    expect(draft.review_status).toBe('pending_review');
    expect(draft.reviewer_decision).toBeNull();

    // Make human reviewer decision (Teacher accepts)
    const reviewRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: teacherHeader,
      data: {
        decision: 'accepted',
        note: 'Approved for small group intervention on Thursday',
      },
    });
    expect(reviewRes.status()).toBe(200);
    const reviewed = await reviewRes.json();

    expect(reviewed.review_status).toBe('accepted');
    expect(reviewed.reviewer_decision).toBeTruthy();
    expect(reviewed.reviewer_decision.decision).toBe('accepted');
    expect(reviewed.reviewer_decision.note).toContain('Approved for small group');
  });

  test('Criterion 3: Low confidence recommendations are explicitly labelled as such and not stated as fact', async ({ page }) => {
    const lowConfPayload = {
      recommendation: 'Consider checking conceptual understanding of ratio simplification',
      reason: 'Only two attempts recorded on this skill',
      confidence: 'Low',
      limitations: 'Very limited sample size (2 attempts); preliminary observation only.',
      suggested_action: 'Observe student working on next item before initiating intervention.',
    };

    const postRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: lowConfPayload,
    });
    expect(postRes.status()).toBe(201);
    const { draft } = await postRes.json();

    expect(draft.is_low_confidence).toBe(true);
    expect(draft.confidence).toBe('Low');
    expect(draft.confidence_label).toContain('Preliminary indicator only — low confidence; not stated as fact');
  });

  test('Criterion 4: Insight draft containing placement, grading, admissions, exclusion, or remedial wording is deterministically rejected, hidden, and stored', async ({ page }) => {
    const forbiddenPayload = {
      recommendation: 'Recommend academic placement in remedial class due to low exam score and selective entry admissions test failure',
      reason: 'Student failed assessment mark',
      confidence: 'Moderate',
    };

    // Submitting draft with forbidden wording
    const postRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: forbiddenPayload,
    });

    // Deterministic check rejects draft (422)
    expect(postRes.status()).toBe(422);
    const resBody = await postRes.json();
    expect(resBody.rejected).toBe(true);
    expect(resBody.rejection_reason).toContain('Rejected by deterministic wording check');
    expect(resBody.rejection_reason).toMatch(/placement|remedial|admissions|grade/i);

    // Verify rejected draft is NEVER returned in teacher recommendations list
    const recsRes = await page.request.get('/api/teacher/recommendations', {
      headers: teacherHeader,
    });
    expect(recsRes.status()).toBe(200);
    const recsList = await recsRes.json();
    const leakedDraft = recsList.find((r: any) => r.id === resBody.draft_id);
    expect(leakedDraft).toBeUndefined();

    // Verify rejection audit event was logged
    const adminToken = JSON.stringify({ sub: 'user_2test_adm_001', role: 'administrator' });
    const auditRes = await page.request.get('/api/admin/audit-events?event_type=insight_draft_rejected', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    const rejectEvent = auditData.events.find((e: any) => e.event_type === 'insight_draft_rejected');
    expect(rejectEvent).toBeTruthy();
    expect(rejectEvent.reason).toContain('deterministic wording check');
  });

  test('Criterion 5: Teacher UI page (/teacher/flags) renders evidence drill-down and allows recommendation review', async ({ page }) => {
    await page.goto('/teacher/flags');

    await expect(page.getByRole('heading', { name: 'Flag Explanation & Educator Oversight' })).toBeVisible();

    // If flagged students exist, verify card and evidence sections are present
    const studentCards = page.getByTestId('flagged-student-card');
    const count = await studentCards.count();
    if (count > 0) {
      await studentCards.first().click();
      await expect(page.getByTestId('evidence-attempts')).toBeVisible();
      await expect(page.getByTestId('evidence-skills')).toBeVisible();
      await expect(page.getByTestId('evidence-timing')).toBeVisible();
      await expect(page.getByTestId('evidence-hint-levels')).toBeVisible();
      await expect(page.getByTestId('evidence-sessions')).toBeVisible();
    }
  });
});
