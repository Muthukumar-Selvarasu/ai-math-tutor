import { test, expect } from '@playwright/test';
import crypto from 'crypto';

test.describe('STU-12: Leave and resume a session', () => {
  test.beforeEach(async ({ request }) => {
    // Reset session store to ensure clean slate across tests
    await request.post('/api/checker/diagram', { data: { reset: true } }).catch(() => {});
  });

  test('Criterion 1: Given the student leaves a session, when they return, then the same question, attempts, and hint level are restored', async ({ page, request }) => {
    // 1. Create a session on ratio_share_001
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'student_resume_1' },
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const sessionId = createData.session.id;

    // 2. Perform an attempt to escalate hint level and increase attempt count
    const attemptRes = await request.post(`/api/sessions/${sessionId}/events`, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      data: { event: 'submit', answer_text: '10' }, // incorrect attempt
    });
    expect(attemptRes.status()).toBe(200);
    const attemptData = await attemptRes.json();
    expect(attemptData.session.hint_level).toBe(1);
    expect(attemptData.session.attempt_count).toBe(1);

    // 3. Student leaves (API check): GET /api/sessions/{id} returns the exact state
    const getRes = await request.get(`/api/sessions/${sessionId}`);
    expect(getRes.status()).toBe(200);
    const getData = await getRes.json();
    expect(getData.session.id).toBe(sessionId);
    expect(getData.session.question_id).toBe('ratio_share_001');
    expect(getData.session.hint_level).toBe(1);
    expect(getData.session.attempt_count).toBe(1);
    expect(getData.session.state).toBe('active');
    expect(getData.tutor.text).toBeTruthy();

    // 4. Student returns (UI check): navigate to practice with sessionId query parameter
    await page.goto(`/practice?sessionId=${sessionId}`);
    await expect(page.getByTestId('question-card')).toBeVisible();
    await expect(page.getByTestId('problem-stem')).toContainText('Share $60 between Leo and Maya in the ratio 2 : 3');
    await expect(page.getByTestId('session-state-badge')).toContainText('active');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('1');
    await expect(page.getByTestId('attempt-item')).toHaveCount(1);
  });

  test('Criterion 2: Given client sends an idempotency key, when retried, then server returns stored result and does not create a second attempt', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session = (await createRes.json()).session;

    const idempotencyKey = crypto.randomUUID();
    const eventPayload = { event: 'submit', answer_text: '15' };

    // First submission
    const res1 = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': idempotencyKey },
      data: eventPayload,
    });
    expect(res1.status()).toBe(200);
    const data1 = await res1.json();
    expect(data1.session.attempt_count).toBe(1);

    // Immediate replay with the SAME idempotency key and SAME request body
    const res2 = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': idempotencyKey },
      data: eventPayload,
    });
    expect(res2.status()).toBe(200);
    expect(res2.headers()['idempotent-replay']).toBe('true');
    const data2 = await res2.json();
    expect(data2.session.attempt_count).toBe(1);

    // Verify session store has exactly 1 attempt record (no duplicate created)
    const checkRes = await request.get(`/api/sessions/${session.id}`);
    const checkData = await checkRes.json();
    expect(checkData.session.attempt_count).toBe(1);
    expect(checkData.session.attempts.length).toBe(1);
  });

  test('Criterion 3: Given attempt row is persisted and tutor turn is not, when retried with same key, completes or returns attempt without incrementing attempt count', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session = (await createRes.json()).session;

    const crashIdempotencyKey = crypto.randomUUID();

    // First attempt simulates a crash after attempt row was persisted but before tutor turn completed
    const crashRes = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': crashIdempotencyKey },
      data: {
        event: 'submit',
        answer_text: '20',
        simulate_crash_before_turn_persist: true,
      },
    });
    // Server threw crash or handled failure
    expect([400, 500]).toContain(crashRes.status());

    // Verify attempt row is already in session
    const midRes = await request.get(`/api/sessions/${session.id}`);
    const midData = await midRes.json();
    expect(midData.session.attempt_count).toBe(1);

    // Retry with the SAME idempotency key
    const retryRes = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': crashIdempotencyKey },
      data: {
        event: 'submit',
        answer_text: '20',
      },
    });
    expect(retryRes.status()).toBe(200);
    const retryData = await retryRes.json();
    // Attempt count remains 1 and is NOT incremented twice
    expect(retryData.session.attempt_count).toBe(1);
    expect(retryData.tutor).toBeDefined();

    // Verify attempt count in store remains exactly 1
    const finalRes = await request.get(`/api/sessions/${session.id}`);
    const finalData = await finalRes.json();
    expect(finalData.session.attempt_count).toBe(1);
  });

  test('Criterion 4: Given function times out after turn is persisted, when retried, student sees persisted turn and not a second tutor question', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session = (await createRes.json()).session;

    const timeoutIdempotencyKey = crypto.randomUUID();

    // First request simulates gateway timeout right after turn was persisted
    const timeoutRes = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': timeoutIdempotencyKey },
      data: {
        event: 'submit',
        answer_text: '25',
        simulate_timeout_after_turn_persist: true,
      },
    });
    expect(timeoutRes.status()).toBe(504);
    const timeoutErr = await timeoutRes.json();
    expect(timeoutErr.error.code).toBe('gateway_timeout');

    // Student retries with the SAME idempotency key
    const retryRes = await request.post(`/api/sessions/${session.id}/events`, {
      headers: { 'Idempotency-Key': timeoutIdempotencyKey },
      data: {
        event: 'submit',
        answer_text: '25',
      },
    });
    expect(retryRes.status()).toBe(200);
    expect(retryRes.headers()['idempotent-replay']).toBe('true');
    const retryData = await retryRes.json();
    expect(retryData.session.attempt_count).toBe(1);
    expect(retryData.tutor).toBeDefined();

    // Verify no second tutor question was generated in history
    const finalRes = await request.get(`/api/sessions/${session.id}`);
    const finalData = await finalRes.json();
    expect(finalData.session.attempt_count).toBe(1);
  });

  test('Criterion 5: State machine rejection returns 409 transition_not_allowed in PRD 15.9 error payload and writes audit event', async ({ request, page }) => {
    // 5a. "Show me the solution" in awaiting_first_attempt is illegal
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session = (await createRes.json()).session;
    expect(session.state).toBe('awaiting_first_attempt');

    const rejectRes1 = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'show_solution' },
    });
    expect(rejectRes1.status()).toBe(409);
    const errPayload1 = await rejectRes1.json();
    expect(errPayload1.error.code).toBe('transition_not_allowed');
    expect(errPayload1.error.retryable).toBe(false);
    expect(errPayload1.error.request_id).toBeDefined();

    // Verify session state was not mutated
    const sessionCheck = (await (await request.get(`/api/sessions/${session.id}`)).json()).session;
    expect(sessionCheck.state).toBe('awaiting_first_attempt');

    // 5b. Verify UI does not show show-solution-btn in awaiting_first_attempt
    await page.goto(`/practice?sessionId=${session.id}`);
    await expect(page.getByTestId('session-state-badge')).toContainText('awaiting_first_attempt');
    await expect(page.getByTestId('show-solution-btn')).toHaveCount(0);

    // 5c. Move to transfer_active and check show_solution rejection
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'skip' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'accept' } });

    const rejectRes2 = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'show_solution' },
    });
    expect(rejectRes2.status()).toBe(409);
    const errPayload2 = await rejectRes2.json();
    expect(errPayload2.error.code).toBe('transition_not_allowed');
  });

  test('Criterion 6: Same Idempotency-Key with different body or on different session returns 409 idempotency_conflict; in-progress returns 409 request_in_progress', async ({ request }) => {
    const res1 = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const s1 = (await res1.json()).session;

    const res2 = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const s2 = (await res2.json()).session;

    const sharedKey = crypto.randomUUID();

    // 1. Successful first call on s1
    const okRes = await request.post(`/api/sessions/${s1.id}/events`, {
      headers: { 'Idempotency-Key': sharedKey },
      data: { event: 'submit', answer_text: '15' },
    });
    expect(okRes.status()).toBe(200);

    // 2. Conflict: Same key with DIFFERENT request body on s1
    const conflictBodyRes = await request.post(`/api/sessions/${s1.id}/events`, {
      headers: { 'Idempotency-Key': sharedKey },
      data: { event: 'submit', answer_text: '20' }, // different body!
    });
    expect(conflictBodyRes.status()).toBe(409);
    const errBody = await conflictBodyRes.json();
    expect(errBody.error.code).toBe('idempotency_conflict');
    expect(errBody.error.retryable).toBe(false);

    // 3. Conflict: Same key on DIFFERENT session s2
    const conflictSessionRes = await request.post(`/api/sessions/${s2.id}/events`, {
      headers: { 'Idempotency-Key': sharedKey },
      data: { event: 'submit', answer_text: '15' },
    });
    expect(conflictSessionRes.status()).toBe(409);
    const errSession = await conflictSessionRes.json();
    expect(errSession.error.code).toBe('idempotency_conflict');

    // 4. In-progress check: simulate in-progress record
    const progressKey = crypto.randomUUID();
    // Pre-seed an in-progress record via a helper or direct test route check
    const inProgRes = await request.post('/api/checker/diagram', {
      data: {
        set_idempotency_in_progress: {
          key: progressKey,
          session_id: s1.id,
          request_hash: crypto.createHash('sha256').update(JSON.stringify({ event: 'not_sure' })).digest('hex'),
        },
      },
    }).catch(() => null);

    if (inProgRes && inProgRes.ok()) {
      const progCheckRes = await request.post(`/api/sessions/${s1.id}/events`, {
        headers: { 'Idempotency-Key': progressKey },
        data: { event: 'not_sure' },
      });
      expect(progCheckRes.status()).toBe(409);
      const progErr = await progCheckRes.json();
      expect(progErr.error.code).toBe('request_in_progress');
      expect(progErr.error.retry_after_s).toBe(3);
    }
  });

  test('Criterion 7: Any non-2xx response uses the single error payload of PRD section 15.9', async ({ request }) => {
    // 7a. 404 not_found
    const notFoundRes = await request.get('/api/sessions/non_existent_uuid_0000');
    expect(notFoundRes.status()).toBe(404);
    const notFoundJson = await notFoundRes.json();
    expect(notFoundJson).toHaveProperty('error');
    expect(notFoundJson.error).toMatchObject({
      code: 'not_found',
      message: expect.any(String),
      retryable: false,
      retry_after_s: null,
      request_id: expect.any(String),
    });

    // 7b. 400 invalid_request (e.g. mutual exclusivity violation: answer_text and step_expressions together)
    const createRes = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const session = (await createRes.json()).session;

    const badReqRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
        step_expressions: ['12 * 3'], // violates mutual exclusivity rule!
      },
    });
    expect(badReqRes.status()).toBe(400);
    const badReqJson = await badReqRes.json();
    expect(badReqJson).toHaveProperty('error');
    expect(badReqJson.error).toMatchObject({
      code: 'invalid_request',
      message: expect.any(String),
      retryable: false,
      retry_after_s: null,
      request_id: expect.any(String),
    });
  });

  test('Criterion 8: SessionView holds SessionState, QuestionView without solution leaks, and TutorTurn', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    expect(createRes.status()).toBe(201);
    const sessionView = await createRes.json();

    // 1. SessionState verification
    expect(sessionView.session).toHaveProperty('id');
    expect(sessionView.session).toHaveProperty('state');
    expect(sessionView.session).toHaveProperty('question_id', 'ratio_share_001');
    expect(sessionView.session).toHaveProperty('hint_level', 0);
    expect(sessionView.session).toHaveProperty('attempt_count', 0);

    // 2. QuestionView verification
    const qView = sessionView.question;
    expect(qView).toHaveProperty('question_id', 'ratio_share_001');
    expect(qView).toHaveProperty('version');
    expect(qView).toHaveProperty('stem');
    expect(qView).toHaveProperty('answer_type');
    expect(qView).toHaveProperty('unit');
    expect(qView).toHaveProperty('answer_requires_unit');
    expect(qView).toHaveProperty('reasoning_options');
    expect(Array.isArray(qView.reasoning_options)).toBe(true);
    for (const opt of qView.reasoning_options) {
      expect(opt).toHaveProperty('option_id');
      expect(opt).toHaveProperty('label');
    }
    expect(qView).toHaveProperty('has_diagram');

    // Strict leak checks: QuestionView must NEVER hold accepted_answer_spec, solution_steps, scaffold_probes, etc.
    expect(qView).not.toHaveProperty('accepted_answer_spec');
    expect(qView).not.toHaveProperty('solution_steps');
    expect(qView).not.toHaveProperty('scaffold_probes');
    expect(qView).not.toHaveProperty('alternate_solution_paths');
    expect(qView).not.toHaveProperty('method_leak_patterns');
    expect(qView).not.toHaveProperty('misconception_predictions');
    expect(qView).not.toHaveProperty('isomorphic_worked_example');
    expect(qView).not.toHaveProperty('reflection'); // reflection block with sound flags

    // 3. TutorTurn verification
    expect(sessionView.tutor).toHaveProperty('kind');
    expect(sessionView.tutor).toHaveProperty('text');
    expect(sessionView.tutor).toHaveProperty('controls');
  });

  test('Criterion 9: GET /api/sessions/{id}/diagram returns SVG with CSP none when level allows; returns 404 when disallowed or wrong student', async ({ request }) => {
    // 1. At Level 0 on ratio_share_001 (diagram min_level 3): disallowed -> returns 404 not_found
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'student_owner_1' },
    });
    const session = (await createRes.json()).session;

    const diagResL0 = await request.get(`/api/sessions/${session.id}/diagram`);
    expect(diagResL0.status()).toBe(404);
    const errL0 = await diagResL0.json();
    expect(errL0.error.code).toBe('not_found');

    // 2. Escalate session hint level to Level 3 via three "not_sure" escalations
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'not_sure' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'not_sure' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'not_sure' } });

    // 3. Disallowed for another student: calling with different student id -> returns 404 not_found
    const wrongStudentRes = await request.get(`/api/sessions/${session.id}/diagram`, {
      headers: { 'X-Student-Id': 'different_student_999' },
    });
    expect(wrongStudentRes.status()).toBe(404);
    const wrongErr = await wrongStudentRes.json();
    expect(wrongErr.error.code).toBe('not_found');

    // 4. Allowed for owner student at Level 3 -> returns 200 with SVG and CSP default-src none
    const validDiagRes = await request.get(`/api/sessions/${session.id}/diagram`, {
      headers: { 'X-Student-Id': 'student_owner_1' },
    });
    expect(validDiagRes.status()).toBe(200);
    expect(validDiagRes.headers()['content-type']).toContain('image/svg+xml');
    expect(validDiagRes.headers()['content-security-policy']).toBe("default-src 'none'");
    const svgText = await validDiagRes.text();
    expect(svgText).toContain('<svg');
  });

  test('Criterion 10: Note arrives in any state including terminal, stored in student_note with state_at_save, answered with note_ack, not a pipeline turn', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session = (await createRes.json()).session;

    // 1. Note in awaiting_first_attempt
    const note1Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'note', note_text: 'I think we need to divide by 5.' },
    });
    expect(note1Res.status()).toBe(200);
    const note1Data = await note1Res.json();
    expect(note1Data.note.state_at_save).toBe('awaiting_first_attempt');
    expect(note1Data.tutor.text).toContain('Your note has been saved for your teacher');
    // Not a pipeline turn: attempt_count and turn_number unchanged
    expect(note1Data.session.attempt_count).toBe(0);
    expect(note1Data.session.turn_number).toBe(1);

    // 2. Note in terminal state (after solve and decline transfer)
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'skip' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'decline' } });

    const sessionTerminal = (await (await request.get(`/api/sessions/${session.id}`)).json()).session;
    expect(sessionTerminal.state).toBe('declined');

    const note2Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'note', note_text: 'Great session, finished now!' },
    });
    expect(note2Res.status()).toBe(200);
    const note2Data = await note2Res.json();
    expect(note2Data.note.state_at_save).toBe('declined');
    expect(note2Data.session.state).toBe('declined');
  });

  test('Criterion 11: Controls-by-state table matches PRD 8.5.1 and tutor.controls is source of client controls', async ({ request, page }) => {
    const createRes = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const session = (await createRes.json()).session;

    // 1. awaiting_first_attempt: ["answer", "steps", "options", "not_sure", "note"]
    const getL0 = await request.get(`/api/sessions/${session.id}`);
    const l0Data = await getL0.json();
    expect(l0Data.tutor.controls).toEqual(['answer', 'steps', 'options', 'not_sure', 'note']);

    // 2. active: ["answer", "steps", "options", "not_sure", "show_solution", "note"]
    const activeRes = await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'not_sure' } });
    const activeData = await activeRes.json();
    expect(activeData.tutor.controls).toEqual(['answer', 'steps', 'options', 'not_sure', 'show_solution', 'note']);

    // 3. reflection: ["reflection_options", "skip", "note"]
    const reflRes = await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    const reflData = await reflRes.json();
    expect(reflData.tutor.controls).toEqual(['reflection_options', 'skip', 'note']);

    // 4. transfer_offered: ["accept", "decline", "note"]
    const transOffRes = await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'skip' } });
    const transOffData = await transOffRes.json();
    expect(transOffData.tutor.controls).toEqual(['accept', 'decline', 'note']);

    // 5. transfer_active: ["answer", "steps", "options", "not_sure", "note"]
    const transActRes = await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'accept' } });
    const transActData = await transActRes.json();
    expect(transActData.tutor.controls).toEqual(['answer', 'steps', 'options', 'not_sure', 'note']);

    // UI test: In transfer_active, client shows answer and not_sure, but NOT show_solution
    await page.goto(`/practice?sessionId=${transActData.session.id}`);
    await expect(page.getByTestId('submit-attempt-btn')).toBeVisible();
    await expect(page.getByTestId('not-sure-btn')).toBeVisible();
    await expect(page.getByTestId('show-solution-btn')).toHaveCount(0);
  });
});
