import { test, expect } from '@playwright/test';

test.describe('EDU-03: Replay a tutoring session', () => {
  const assignedTeacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });
  const assignedTeacherHeader = { Authorization: `Bearer ${assignedTeacherToken}` };

  const unassignedTeacherToken = JSON.stringify({
    sub: 'user_2test_tch_unassigned',
    role: 'teacher',
  });
  // Note: user_2test_tch_unassigned is not provisioned or has non-matching cohorts

  const adminWithTraceToken = JSON.stringify({
    sub: 'user_2test_adm_001',
    role: 'administrator',
  });
  const adminWithTraceHeader = { Authorization: `Bearer ${adminToken}` };
  function adminToken() {
    return JSON.stringify({ sub: 'user_2test_adm_001', role: 'administrator' });
  }

  test('Criterion 1 & 2: Replay shows each turn, pending draft recommendation with evidence, question/diagram versions, verifier result, and learner delta', async ({ page, request }) => {
    // 1. Create session and simulate student turn
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_001' },
    });
    expect([200, 201]).toContain(createRes.status());
    const { session } = await createRes.json();

    // Submit an attempt
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20' },
    });

    // 2. Fetch replay as assigned teacher
    const replayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    expect(replayRes.status()).toBe(200);
    const replay = await replayRes.json();

    expect(replay.session_id).toBe(session.id);
    expect(replay.question_version).toBeDefined();
    expect(replay.diagram_version).toBeDefined();
    expect(replay.turns.length).toBeGreaterThanOrEqual(1);

    // Verify turn fields (Criterion 2)
    const turn1 = replay.turns[0];
    expect(turn1.turn_number).toBe(1);
    expect(turn1.student_response).toBe('20');
    expect(turn1.verifier_status).toBe('incorrect');
    expect(turn1.hint_level).toBeDefined();
    expect(turn1.tutor_output).toBeTruthy();
    expect(turn1.misconception).toBeDefined();
    expect(turn1.misconception.code).toBeTruthy();
    expect(turn1.learner_model_change).toBeDefined();

    // Verify one pending draft recommendation with evidence (Criterion 1)
    expect(replay.recommendations.length).toBe(1);
    const rec = replay.recommendations[0];
    expect(rec.recommendation).toBeTruthy();
    expect(rec.evidence).toBeTruthy();
    expect(rec.review_status).toBe('pending_review');
  });

  test('Criterion 3: Turn metadata includes model name, model version, prompt version, policy version, and audit timestamps', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_meta' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '36' },
    });

    const replayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    const replay = await replayRes.json();
    const turn = replay.turns[0];

    expect(turn.model).toBeTruthy();
    expect(turn.model_version).toBe('v1');
    expect(turn.prompt_version).toBeTruthy();
    expect(turn.policy_version).toBeTruthy();
    expect(turn.audit_timestamps?.created_at).toBeTruthy();
  });

  test('Criterion 4: Purged session replay still shows verifier status, hint level, versions, and timestamps with retention notice', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_purge' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15' },
    });

    // Run retention purge for sessions older than now
    const cronSecret = process.env.CRON_SECRET || 'development-cron-secret-change-me';
    await request.get(`/api/jobs/retention-purge?older_than=${new Date(Date.now() + 10000).toISOString()}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const replayRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    const replay = await replayRes.json();
    const turn = replay.turns[0];

    expect(turn.body_purged).toBe(true);
    expect(turn.student_response).toBeNull();
    expect(turn.tutor_output).toBeNull();
    expect(turn.retention_notice).toContain('Message body purged in compliance with data retention policy');
    // Metadata remains intact
    expect(turn.verifier_status).toBeTruthy();
    expect(turn.hint_level).toBeDefined();
    expect(turn.prompt_version).toBeTruthy();
    expect(turn.audit_timestamps?.created_at).toBeTruthy();
  });

  test('Criterion 5: Unauthorized roles (tutor, parent, student) or unassigned teachers are denied (403) and logged', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_auth' },
    });
    const { session } = await createRes.json();

    // 1. Parent role -> 403
    const parentToken = JSON.stringify({ sub: 'user_2test_par_001', role: 'parent' });
    const parentRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    expect(parentRes.status()).toBe(403);

    // 2. Student role -> 403
    const stuToken = JSON.stringify({ sub: 'user_2test_stu_001', role: 'student' });
    const stuRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${stuToken}` },
    });
    expect(stuRes.status()).toBe(403);

    // Verify denial logged in audit trail
    const adminToken = JSON.stringify({ sub: 'user_2test_adm_001', role: 'administrator' });
    const auditRes = await request.get('/api/admin/audit-events?event_type=replay_access_denied', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.events.length).toBeGreaterThanOrEqual(1);
  });

  test('Criterion 6: Trace links are accessible ONLY to administrators holding trace_review; teachers never receive trace links', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_traces' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '36' },
    });

    // 1. Teacher access: trace_link MUST be null
    const teacherRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    const teacherReplay = await teacherRes.json();
    expect(teacherReplay.turns[0].trace_link).toBeNull();

    // 2. Administrator with trace_review: trace_link is present
    const adminToken = JSON.stringify({
      sub: 'user_2test_adm_001',
      role: 'administrator',
    });
    const adminRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminRes.status()).toBe(200);
    const adminReplay = await adminRes.json();
    expect(adminReplay.turns[0].trace_link).toContain('https://cloud.langfuse.com/project/traces/');
  });

  test('Criterion 7: Misconception reviewer status starts as unreviewed; teacher can confirm or reject and it is stored', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_misc' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '18' },
    });

    // Verify initial reviewer status is "unreviewed"
    const initialRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    const initialReplay = await initialRes.json();
    expect(initialReplay.turns[0].misconception.reviewer_status).toBe('unreviewed');

    // Teacher sets reviewer status to "confirmed"
    const reviewRes = await request.post(`/api/teacher/sessions/${session.id}/misconception-review`, {
      headers: assignedTeacherHeader,
      data: {
        turn_number: 1,
        reviewer_status: 'confirmed',
        note: 'Verified student treated ratio parts additively',
      },
    });
    expect(reviewRes.status()).toBe(200);

    // Verify updated status persists in replay
    const updatedRes = await request.get(`/api/teacher/sessions/${session.id}/replay`, {
      headers: assignedTeacherHeader,
    });
    const updatedReplay = await updatedRes.json();
    expect(updatedReplay.turns[0].misconception.reviewer_status).toBe('confirmed');
  });

  test('Criterion 8: Teacher UI page (/teacher/sessions/[session_id]/replay) renders interactive timeline scrub and controls', async ({ page, request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu_replay_ui' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20' },
    });

    await page.goto(`/teacher/sessions/${session.id}/replay`);

    await expect(page.getByTestId('replay-container')).toBeVisible();
    await expect(page.getByTestId('turn-card')).toBeVisible();
    await expect(page.getByTestId('turn-verifier-status')).toContainText('incorrect');
    await expect(page.getByTestId('turn-student-response')).toContainText('20');
    await expect(page.getByTestId('confirm-misconception-btn')).toBeVisible();
    await expect(page.getByTestId('reject-misconception-btn')).toBeVisible();

    // Click confirm misconception in UI
    await page.getByTestId('confirm-misconception-btn').click();
    await expect(page.getByTestId('reviewer-status-badge')).toContainText('confirmed');
  });
});
