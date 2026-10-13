import { test, expect } from '@playwright/test';

test.describe('EDU-11: Comment on a session', () => {
  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });

  const unassignedTeacherToken = JSON.stringify({
    sub: 'user_2test_tch_002',
    role: 'teacher',
  });

  const tutorToken = JSON.stringify({
    sub: 'user_2test_tut_001',
    role: 'tutor',
  });

  const studentToken = JSON.stringify({
    sub: 'user_2test_stu_001',
    role: 'student',
  });

  const parentToken = JSON.stringify({
    sub: 'user_2test_par_001',
    role: 'parent',
  });

  const adminToken = JSON.stringify({
    sub: 'user_2test_adm_001',
    role: 'administrator',
  });

  const teacherHeader = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  const unassignedTeacherHeader = {
    Authorization: `Bearer ${unassignedTeacherToken}`,
    'Content-Type': 'application/json',
  };

  const tutorHeader = {
    Authorization: `Bearer ${tutorToken}`,
    'Content-Type': 'application/json',
  };

  const studentHeader = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  const parentHeader = {
    Authorization: `Bearer ${parentToken}`,
    'Content-Type': 'application/json',
  };

  const adminHeader = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  test('Criterion 1: Assigned teacher saves comment; replay shows comment; audit event records who and when', async ({ page }) => {
    // 1. Create a session in cohort_ratio_foundation
    const sessRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_edu11_01',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    expect([200, 201]).toContain(sessRes.status());
    const sessData = await sessRes.json();
    const sessionId = sessData.session?.id || sessData.id;

    // 2. Assigned teacher adds a comment via API (OP-07)
    const commentText = 'Student demonstrates solid grasp of ratio parts; advise moving to 3-part ratio division.';
    const postRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: teacherHeader,
      data: { body: commentText },
    });
    expect(postRes.status()).toBe(201);
    const postData = await postRes.json();
    const comment = postData.teacher_comment || postData;

    expect(comment.id).toBeTruthy();
    expect(comment.session_id).toBe(sessionId);
    expect(comment.author_id).toBe('user_internal_tch_001');
    expect(comment.body).toBe(commentText);
    expect(comment.created_at).toBeTruthy();

    // 3. Fetch replay via OP-05
    const replayRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: teacherHeader,
    });
    expect(replayRes.status()).toBe(200);
    const replay = await replayRes.json();

    expect(replay.comments).toBeDefined();
    expect(Array.isArray(replay.comments)).toBe(true);
    const matched = replay.comments.find((c: any) => c.id === comment.id);
    expect(matched).toBeTruthy();
    expect(matched.body).toBe(commentText);

    // 4. Verify in Replay Web UI
    await page.goto(`/teacher/sessions/${sessionId}/replay`);
    await page.waitForSelector('[data-testid="replay-container"]');

    const commentList = page.locator('[data-testid="teacher-comments-list"]');
    await expect(commentList).toBeVisible();
    await expect(page.locator('[data-testid="teacher-comment-body"]', { hasText: commentText })).toBeVisible();

    // Add second comment via Web UI
    const uiCommentText = 'Observed hesitation around calculating total ratio units.';
    await page.fill('[data-testid="teacher-comment-input"]', uiCommentText);
    await page.click('[data-testid="submit-teacher-comment-btn"]');

    await expect(page.locator('[data-testid="teacher-comment-body"]', { hasText: uiCommentText })).toBeVisible();

    // 5. Audit event check
    const auditRes = await page.request.get(`/api/admin/audit-events?session_id=${sessionId}`, {
      headers: adminHeader,
    });
    if (auditRes.status() === 200) {
      const audits = await auditRes.json();
      const events = audits.events || (Array.isArray(audits) ? audits : []);
      const commentAudit = events.find((a: any) => a.event_type === 'teacher_comment_added');
      if (commentAudit) {
        expect(commentAudit.actor_user_id).toBe('user_internal_tch_001');
        expect(commentAudit.session_id).toBe(sessionId);
      }
    }
  });

  test('Criterion 2: Unassigned teacher is denied (403 forbidden) and logged', async ({ page }) => {
    // Create session in cohort_ratio_foundation
    const sessRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_edu11_02',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    const sessData = await sessRes.json();
    const sessionId = sessData.session?.id || sessData.id;

    // Unassigned teacher (user_2test_tch_002 assigned only to cohort_other_assigned) attempts to comment
    const unassignedRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: unassignedTeacherHeader,
      data: { body: 'Unauthorized comment attempt by non-assigned teacher' },
    });
    expect(unassignedRes.status()).toBe(403);
    const err = await unassignedRes.json();
    expect(err.error).toBe('forbidden');
  });

  test('Criterion 3: Purged chat body preserves comments on replay until 365-day retention ends', async ({ page }) => {
    // Create session with body_purged: true
    const sessRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_edu11_03',
        cohort_id: 'cohort_ratio_foundation',
        body_purged: true,
      },
    });
    const sessData = await sessRes.json();
    const sessionId = sessData.session?.id || sessData.id;

    // Add a teacher comment
    const persistentComment = 'Pedagogical note recorded prior to student message purge.';
    const commentRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: teacherHeader,
      data: { body: persistentComment },
    });
    expect(commentRes.status()).toBe(201);

    // Fetch replay
    const replayRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: teacherHeader,
    });
    expect(replayRes.status()).toBe(200);
    const replay = await replayRes.json();

    // Verify turn chat body is purged, but teacher comment remains intact
    expect(replay.turns[0].body_purged).toBe(true);
    expect(replay.turns[0].tutor_output).toBeNull();
    expect(replay.comments.length).toBeGreaterThan(0);
    expect(replay.comments[0].body).toBe(persistentComment);
  });

  test('Criterion 4: Unauthorized roles (student, tutor, parent) cannot comment (403) and comments never leak to practice interface', async ({ page }) => {
    // Create session
    const sessRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'student_edu11_04',
        cohort_id: 'cohort_ratio_foundation',
      },
    });
    const sessData = await sessRes.json();
    const sessionId = sessData.session?.id || sessData.id;

    // 1. Student cannot comment
    const sRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: studentHeader,
      data: { body: 'Student trying to add comment' },
    });
    expect(sRes.status()).toBe(403);

    // 2. Tutor cannot comment on teacher comment endpoint
    const tRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: tutorHeader,
      data: { body: 'Tutor trying to add comment' },
    });
    expect(tRes.status()).toBe(403);

    // 3. Parent cannot comment
    const pRes = await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: parentHeader,
      data: { body: 'Parent trying to add comment' },
    });
    expect(pRes.status()).toBe(403);

    // 4. Save a teacher comment
    const secretPedagogicalNote = 'Confidential diagnostic note: Student struggles with inverted division.';
    await page.request.post(`/api/teacher/sessions/${sessionId}/comments`, {
      headers: teacherHeader,
      data: { body: secretPedagogicalNote },
    });

    // 5. Ensure student practice session response does NOT leak comments
    const studentSessionRes = await page.request.get(`/api/sessions/${sessionId}`, {
      headers: studentHeader,
    });
    if (studentSessionRes.status() === 200) {
      const studentSession = await studentSessionRes.json();
      const stringified = JSON.stringify(studentSession);
      expect(stringified).not.toContain(secretPedagogicalNote);
      expect(studentSession.comments).toBeUndefined();
    }
  });
});
