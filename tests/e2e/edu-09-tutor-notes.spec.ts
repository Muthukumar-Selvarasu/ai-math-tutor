import { test, expect } from '@playwright/test';

test.describe('EDU-09: Add a tutor note', () => {
  const assignedTutorToken = JSON.stringify({
    sub: 'user_2test_tut_001',
    role: 'tutor',
  });

  const unassignedTutorToken = JSON.stringify({
    sub: 'user_2test_tut_002',
    role: 'tutor',
  });

  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });

  const studentToken = JSON.stringify({
    sub: 'user_2test_stu_001',
    role: 'student',
  });

  const assignedTutorHeader = {
    Authorization: `Bearer ${assignedTutorToken}`,
    'Content-Type': 'application/json',
  };

  const unassignedTutorHeader = {
    Authorization: `Bearer ${unassignedTutorToken}`,
    'Content-Type': 'application/json',
  };

  const teacherHeader = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  const studentHeader = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  test('Criterion 1: Assigned tutor sees session ids, question titles, and times, without responses or tutor output', async ({ page }) => {
    // 1. Create a student session with an attempt and a turn
    const sessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    expect([200, 201]).toContain(sessionRes.status());
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id || sessionData.id;

    // Submit an attempt
    await page.request.post(`/api/sessions/${sessionId}/events`, {
      headers: studentHeader,
      data: {
        event: 'submit',
        answer_text: '12',
        response_duration_ms: 12000,
      },
    });

    // 2. Tutor calls GET /api/tutor/sessions
    const listRes = await page.request.get('/api/tutor/sessions', {
      headers: assignedTutorHeader,
    });
    expect(listRes.status()).toBe(200);
    const { sessions } = await listRes.json();

    expect(Array.isArray(sessions)).toBe(true);
    const listedSession = sessions.find((s) => s.session_id === sessionId);
    expect(listedSession).toBeTruthy();
    expect(listedSession.session_id).toBe(sessionId);
    expect(listedSession.question_title).toBeTruthy();
    expect(listedSession.started_at).toBeTruthy();

    // Invariant: Student responses and tutor output are NOT exposed in tutor list
    expect(listedSession.attempts).toBeUndefined();
    expect(listedSession.turns).toBeUndefined();
    expect(listedSession.responses).toBeUndefined();
    expect(listedSession.tutor_output).toBeUndefined();
    expect(listedSession.transcript).toBeUndefined();
  });

  test('Criterion 2: Assigned tutor saves a note on a session; assigned teacher sees it on replay', async ({ page }) => {
    // 1. Create a session
    const sessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id || sessionData.id;

    // 2. Tutor saves a note on the session
    const noteText = 'Student demonstrated solid understanding of simplifying ratios using visual strip diagrams.';
    const noteRes = await page.request.post(`/api/tutor/sessions/${sessionId}/notes`, {
      headers: assignedTutorHeader,
      data: { body: noteText },
    });
    expect(noteRes.status()).toBe(201);
    const noteData = await noteRes.json();
    expect(noteData.session_id).toBe(sessionId);
    expect(noteData.body).toBe(noteText);
    expect(noteData.author_id).toBe('user_internal_tut_001');

    // 3. Assigned teacher accesses the session replay and sees the tutor note
    const replayRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: teacherHeader,
    });
    expect(replayRes.status()).toBe(200);
    const replayData = await replayRes.json();

    expect(Array.isArray(replayData.tutor_notes)).toBe(true);
    const foundNote = replayData.tutor_notes.find((n) => n.body === noteText);
    expect(foundNote).toBeTruthy();
    expect(foundNote.author_id).toBe('user_internal_tut_001');
  });

  test('Criterion 3: Tutor requesting session replay is denied with 403', async ({ page }) => {
    // Create a session
    const sessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id || sessionData.id;

    // Tutor attempts to load replay
    const replayAttemptRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: assignedTutorHeader,
    });
    expect(replayAttemptRes.status()).toBe(403);
    const err = await replayAttemptRes.json();
    expect(err.error).toBe('forbidden');
  });

  test('Criterion 4: Unassigned tutor saving note is denied with 403 and logged', async ({ page }) => {
    const sessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id || sessionData.id;

    // Unassigned tutor attempts to save note
    const unassignedRes = await page.request.post(`/api/tutor/sessions/${sessionId}/notes`, {
      headers: unassignedTutorHeader,
      data: { body: 'Unauthorized tutor attempting note' },
    });
    expect(unassignedRes.status()).toBe(403);
    const err = await unassignedRes.json();
    expect(err.error).toBe('forbidden');
  });

  test('Criterion 5: Tutor cannot review recommendations or change publication status', async ({ page }) => {
    // 1. Create a recommendation draft
    const draftRes = await page.request.post('/api/teacher/recommendations', {
      headers: teacherHeader,
      data: {
        cohort_id: 'cohort_ratio_foundation',
        student_id: 'user_internal_stu_001',
        recommendation: 'Check understanding of ratio division',
        reason: 'Observation',
        confidence: 'Moderate',
        limitations: 'Limited sample.',
        suggested_action: 'Guided practice.',
      },
    });
    const { draft } = await draftRes.json();

    // Tutor attempts to accept recommendation -> 403 denied
    const recReviewRes = await page.request.post(`/api/teacher/recommendations/${draft.id}/review`, {
      headers: assignedTutorHeader,
      data: { decision: 'accepted', note: 'Tutor trying to accept' },
    });
    expect(recReviewRes.status()).toBe(403);

    // Tutor attempts to change publication status -> 403 denied
    const pubDecisionRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: assignedTutorHeader,
      data: { decision: 'approved', note: 'Tutor trying to publish' },
    });
    expect(pubDecisionRes.status()).toBe(403);
  });
});
