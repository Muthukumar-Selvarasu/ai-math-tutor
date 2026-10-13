import { test, expect } from '@playwright/test';

test.describe('STU-19: Estimate understanding from this turn (StudentStateEstimator AG-05)', () => {

  test('Criterion 1: Every tutoring turn stores schema-valid student_state computed from prior persisted results', async ({ request }) => {
    // 1. Create a fresh session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu19_crit1_student' },
    });
    expect(createRes.status()).toBe(201);
    const session = (await createRes.json()).session;

    // Check initial student_state on newly created session
    expect(session.student_state).toBeDefined();
    expect(session.student_state).toEqual({
      repeated_wrong_value: false,
      consecutive_unsuccessful: 0,
      previous_progress: 'none',
    });
    expect(session.tone).toBe('neutral');

    // 2. Turn 1: Submit first incorrect answer ("15")
    const turn1Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15' },
    });
    expect(turn1Res.status()).toBe(200);
    const turn1Data = await turn1Res.json();

    // Turn 1 had no prior attempts in history
    expect(turn1Data.tutor.student_state).toBeDefined();
    expect(turn1Data.tutor.student_state.repeated_wrong_value).toBe(false);
    expect(turn1Data.tutor.student_state.consecutive_unsuccessful).toBe(0);
    expect(turn1Data.tutor.student_state.previous_progress).toBe('none');
    expect(turn1Data.tutor.tone).toBe('neutral');

    // 3. Turn 2: Submit a different incorrect answer ("20")
    const turn2Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20' },
    });
    expect(turn2Res.status()).toBe(200);
    const turn2Data = await turn2Res.json();

    // Prior attempt was unsuccessful -> consecutive_unsuccessful is 1
    // "20" is not a repeated wrong value -> repeated_wrong_value is false
    expect(turn2Data.tutor.student_state.consecutive_unsuccessful).toBe(1);
    expect(turn2Data.tutor.student_state.repeated_wrong_value).toBe(false);
    expect(turn2Data.tutor.student_state.previous_progress).toBe('none');

    // 4. Turn 3: Submit a third incorrect answer ("25")
    const turn3Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '25' },
    });
    expect(turn3Res.status()).toBe(200);
    const turn3Data = await turn3Res.json();

    // Prior attempts were 2 unsuccessful attempts -> consecutive_unsuccessful is 2
    expect(turn3Data.tutor.student_state.consecutive_unsuccessful).toBe(2);
    expect(turn3Data.tutor.student_state.repeated_wrong_value).toBe(false);
    // When consecutive_unsuccessful >= 2, hint policy derives "supportive" tone
    expect(turn3Data.tutor.tone).toBe('supportive');

    // Verify session persistence in GET /api/sessions/[id]
    const getRes = await request.get(`/api/sessions/${session.id}`);
    expect(getRes.status()).toBe(200);
    const fetchedSession = (await getRes.json()).session;
    expect(fetchedSession.student_state).toEqual(turn3Data.tutor.student_state);
    expect(fetchedSession.tone).toBe('supportive');
  });

  test('Criterion 1 & 2: Repeated wrong value triggers repeated_wrong_value=true and patient tone', async ({ request }) => {
    // 1. Create session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu19_repeat_student' },
    });
    const session = (await createRes.json()).session;

    // 2. Attempt 1: submit incorrect answer "15"
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15' },
    });

    // 3. Attempt 2: submit the EXACT same wrong answer "15"
    const repeatRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15' },
    });
    expect(repeatRes.status()).toBe(200);
    const repeatData = await repeatRes.json();

    // Must detect repeated wrong value
    expect(repeatData.tutor.student_state.repeated_wrong_value).toBe(true);
    expect(repeatData.tutor.student_state.consecutive_unsuccessful).toBe(1);
    // Repeated wrong value must map to "patient" tone
    expect(repeatData.tutor.tone).toBe('patient');

    // 4. Also handles currency formatting like "$15"
    const repeatCurrencyRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '$15' },
    });
    const repeatCurrencyData = await repeatCurrencyRes.json();
    expect(repeatCurrencyData.tutor.student_state.repeated_wrong_value).toBe(true);
    expect(repeatCurrencyData.tutor.tone).toBe('patient');
  });

  test('Criterion 1 & 2: Step progress sets previous_progress (advancing / stalled) and resets streak', async ({ request }) => {
    // 1. Create session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu19_progress_student' },
    });
    const session = (await createRes.json()).session;

    // 2. Submit wrong answer first to build an unsuccessful attempt
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '10' },
    });

    // 3. Submit a correct intermediate step expression: "60 / 5"
    const step1Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', step_expressions: ['60 / 5'] },
    });
    expect(step1Res.status()).toBe(200);
    const step1Data = await step1Res.json();

    // This attempt was partially_correct advancing!
    expect(step1Data.attempt.status).toBe('partially_correct');
    expect(step1Data.attempt.progress).toBe('advancing');

    // 4. Next turn: submit an answer to observe previous_progress='advancing' and encouraging tone
    const nextTurnRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20' },
    });
    expect(nextTurnRes.status()).toBe(200);
    const nextTurnData = await nextTurnRes.json();

    // Previous attempt was advancing, so previous_progress is 'advancing'
    expect(nextTurnData.tutor.student_state.previous_progress).toBe('advancing');
    // Advancing partial progress reset the unsuccessful streak to 0
    expect(nextTurnData.tutor.student_state.consecutive_unsuccessful).toBe(0);
    // Advancing progress derives "encouraging" tone
    expect(nextTurnData.tutor.tone).toBe('encouraging');

    // 5. Submit the same step expression again ("60 / 5") -> progress becomes stalled
    const step2Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', step_expressions: ['60 / 5'] },
    });
    expect(step2Res.status()).toBe(200);
    const step2Data = await step2Res.json();
    expect(step2Data.attempt.progress).toBe('stalled');

    // 6. Turn following stalled progress should see previous_progress='stalled' and patient tone
    const afterStalledRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '25' },
    });
    const afterStalledData = await afterStalledRes.json();
    expect(afterStalledData.tutor.student_state.previous_progress).toBe('stalled');
    expect(afterStalledData.tutor.tone).toBe('patient');
  });

  test('Criterion 1 & 2: "I am not sure" and "Show solution" compute student_state deterministically with no model call', async ({ request }) => {
    // 1. Create session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'stu19_notsure_student' },
    });
    const session = (await createRes.json()).session;

    // 2. First attempt: submit incorrect answer
    await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '15' },
    });

    // 3. Second turn: click "I am not sure"
    const notSureRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'not_sure' },
    });
    expect(notSureRes.status()).toBe(200);
    const notSureData = await notSureRes.json();

    // Not sure turn stores schema-valid student_state
    expect(notSureData.tutor.student_state).toBeDefined();
    expect(notSureData.tutor.student_state.consecutive_unsuccessful).toBe(1);
    expect(notSureData.tutor.tone).toBeDefined();

    // 4. Third turn: second "not_sure"
    const notSure2Res = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'not_sure' },
    });
    const notSure2Data = await notSure2Res.json();
    // Prior attempts had 1 incorrect + 1 not_sure = 2 consecutive unsuccessful attempts
    expect(notSure2Data.tutor.student_state.consecutive_unsuccessful).toBe(2);
    expect(notSure2Data.tutor.tone).toBe('supportive');

    // 5. Fourth turn: "show_solution"
    const showSolutionRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'show_solution' },
    });
    expect(showSolutionRes.status()).toBe(200);
    const showSolutionData = await showSolutionRes.json();
    expect(showSolutionData.tutor.student_state).toBeDefined();
    expect(showSolutionData.tutor.student_state.consecutive_unsuccessful).toBe(3);
    expect(showSolutionData.tutor.tone).toBe('supportive');
  });

  test('UI Verification: Practice page renders tone and student state badges in tutor meta row', async ({ page }) => {
    // 1. Navigate to practice page
    await page.goto('/practice?question_id=ratio_share_001');
    await page.waitForSelector('[data-testid="tutor-card"]');

    // Initial state: Level 0, Tone badge and Student State badge visible
    const toneBadge = page.locator('[data-testid="turn-tone-badge"]');
    await expect(toneBadge).toBeVisible();
    await expect(toneBadge).toContainText('Tone: neutral');

    const stateBadge = page.locator('[data-testid="student-state-badge"]');
    await expect(stateBadge).toBeVisible();
    await expect(stateBadge).toContainText('Unsuccessful: 0');

    // 2. Enter an incorrect answer ("15")
    await page.fill('[data-testid="answer-input"]', '15');
    await page.click('[data-testid="submit-attempt-btn"]');

    // Wait for response and verify updated badges
    await page.waitForTimeout(500);
    await expect(toneBadge).toBeVisible();

    // 3. Enter the same incorrect answer again ("15") to trigger repeated error
    await page.fill('[data-testid="answer-input"]', '15');
    await page.click('[data-testid="submit-attempt-btn"]');

    // Wait for response and verify patient tone and Repeated state
    await page.waitForTimeout(500);
    await expect(toneBadge).toContainText('Tone: patient');
    await expect(stateBadge).toContainText('State: Repeated');
  });

});
