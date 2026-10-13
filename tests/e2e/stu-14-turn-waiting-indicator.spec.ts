import { test, expect } from '@playwright/test';

test.describe('STU-14: Show a wait while the turn is checked', () => {

  test('Criterion 1 & 2: While waiting, student sees loading state with aria-busy and no unapproved tutor tokens until turn arrives', async ({
    page,
    request,
  }) => {
    // 1. Create session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);
    await expect(page.getByTestId('problem-stem')).toBeVisible();

    // Configure a simulated slow response (600ms) on next submit so we can inspect loading state
    await page.evaluate(() => {
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_slow_response_ms: 600 };
    });

    const answerInput = page.getByTestId('answer-input');
    const submitBtn = page.getByTestId('submit-attempt-btn');

    await answerInput.fill('15');
    await submitBtn.click();

    // Loading state is immediately visible
    const waitingIndicator = page.getByTestId('turn-waiting-indicator');
    await expect(waitingIndicator).toBeVisible();
    await expect(waitingIndicator).toHaveAttribute('aria-busy', 'true');
    await expect(waitingIndicator).toHaveAttribute('aria-live', 'polite');

    // While waiting, no tutor prompt with unapproved tokens is shown
    await expect(page.getByTestId('tutor-prompt')).toHaveCount(0);

    // After response completes, loading indicator disappears and approved tutor prompt appears
    await expect(page.getByTestId('turn-waiting-indicator')).toHaveCount(0);
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).not.toBeEmpty();
  });

  test('Criterion 3: Student answer is echoed immediately in conversation and inputs are disabled to prevent double submit', async ({
    page,
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);

    // Set simulated delay so we can inspect optimistic UI
    await page.evaluate(() => {
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_slow_response_ms: 800 };
    });

    const answerInput = page.getByTestId('answer-input');
    const submitBtn = page.getByTestId('submit-attempt-btn');

    await answerInput.fill('24');
    await submitBtn.click();

    // 1. Answer input is disabled immediately
    await expect(answerInput).toBeDisabled();
    await expect(submitBtn).toBeDisabled();

    // 2. Answer field is cleared
    await expect(answerInput).toHaveValue('');

    // 3. Student answer is echoed immediately in conversation / attempt history
    const optimisticAnswer = page.getByTestId('optimistic-answer');
    await expect(optimisticAnswer).toBeVisible();
    await expect(optimisticAnswer).toHaveText('24');
    await expect(page.getByTestId('pending-badge')).toBeVisible();

    // Wait for completion
    await expect(page.getByTestId('turn-waiting-indicator')).toHaveCount(0);
    await expect(answerInput).toBeEnabled();
  });

  test('Criterion 4: Timed child-appropriate wait messages (>1s thinking, >4s reassurance without model text)', async ({
    page,
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);

    // Simulate 4.5s delay to observe message transitions
    await page.evaluate(() => {
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_slow_response_ms: 4500 };
    });

    await page.getByTestId('answer-input').fill('10');
    await page.getByTestId('submit-attempt-btn').click();

    const stageMessage = page.getByTestId('waiting-stage-message');
    await expect(stageMessage).toBeVisible();

    // Initially (or within 1s) shows "Checking your answer…"
    // After 1 second (> 1000ms), shows "Thinking about your answer…"
    await expect(stageMessage).toContainText('Thinking about your answer…', { timeout: 3000 });

    // After 4 seconds, adds reassurance line "Still working, nearly there"
    const reassuranceMessage = page.getByTestId('waiting-reassurance-message');
    await expect(reassuranceMessage).toBeVisible({ timeout: 5000 });
    await expect(reassuranceMessage).toContainText('Still working, nearly there');

    // Verify messages contain no model-generated text or answer leaks
    const waitingText = await page.getByTestId('turn-waiting-indicator').innerText();
    expect(waitingText).not.toContain('36');
    expect(waitingText).not.toContain('misconception');
    expect(waitingText).not.toContain('ratio');

    // Finishes cleanly
    await expect(page.getByTestId('turn-waiting-indicator')).toHaveCount(0, { timeout: 6000 });
  });

  test('Criterion 5 & 8: Progress stream carries only checking, preparing, done and never verdict, value or model text', async ({
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();

    // Call progress stream endpoint
    const progressRes = await request.get(`/api/sessions/${session.id}/progress?delay_ms=10`);
    expect(progressRes.ok()).toBeTruthy();
    expect(progressRes.headers()['content-type']).toContain('text/event-stream');

    const streamText = await progressRes.text();

    // Must carry only checking, preparing, done
    expect(streamText).toContain('"stage":"checking"');
    expect(streamText).toContain('"stage":"preparing"');
    expect(streamText).toContain('"stage":"done"');

    // Must NEVER carry verdict, student value, or model text
    expect(streamText).not.toContain('"verdict"');
    expect(streamText).not.toContain('"correct"');
    expect(streamText).not.toContain('"incorrect"');
    expect(streamText).not.toContain('36');
    expect(streamText).not.toContain('"model"');
    expect(streamText).not.toContain('"tutor"');
  });

  test('Criterion 6: Loading state is accessible with screen-reader announcement and does not rely on color/animation alone', async ({
    page,
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);

    await page.evaluate(() => {
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_slow_response_ms: 1200 };
    });

    await page.getByTestId('answer-input').fill('12');
    await page.getByTestId('submit-attempt-btn').click();

    const indicator = page.getByTestId('turn-waiting-indicator');
    await expect(indicator).toBeVisible();

    // Aria attributes
    await expect(indicator).toHaveAttribute('aria-busy', 'true');
    await expect(indicator).toHaveAttribute('aria-live', 'polite');
    await expect(indicator).toHaveAttribute('role', 'status');

    // Screen reader accessible announcement text is present
    const srAnnouncement = page.getByTestId('sr-waiting-announcement');
    await expect(srAnnouncement).toBeAttached();
    await expect(srAnnouncement).toContainText('Checking your answer, please wait...');

    // Spinner has accessible label
    const spinner = page.getByTestId('waiting-spinner');
    await expect(spinner).toHaveAttribute('role', 'status');

    // Written text is present (not relying on color or animation alone)
    const stageMsg = page.getByTestId('waiting-stage-message');
    await expect(stageMsg).toBeVisible();
    const text = await stageMsg.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('Criterion 7a & 7b: 409 request_in_progress triggers 3s retry with same idempotency key; failure delivers deterministic fallback', async ({
    page,
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);

    // Track network requests to verify idempotency keys
    const idempotencyKeys: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/events') && req.method() === 'POST') {
        const key = req.headers()['idempotency-key'] || req.headers()['Idempotency-Key'];
        if (key) idempotencyKeys.push(key);
      }
    });

    // Configure simulation:
    // 1. Simulate 409 in_progress on submit
    // 2. Accelerate retry delay for fast test execution (200ms instead of 3000ms)
    await page.evaluate(() => {
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_in_progress: true };
      window.__RETRY_AFTER_MS = 200;
    });

    await page.getByTestId('answer-input').fill('20');
    await page.getByTestId('submit-attempt-btn').click();

    // Verify loading indicator is active while retrying
    await expect(page.getByTestId('turn-waiting-indicator')).toBeVisible();

    // After retry fails, loading state ends and student sees deterministic fallback
    await expect(page.getByTestId('turn-waiting-indicator')).toHaveCount(0, { timeout: 4000 });
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText('What is the first step you would take to solve this problem?');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: fallback');

    // Verify idempotency keys: exact same key sent on both initial and retry requests!
    expect(idempotencyKeys.length).toBeGreaterThanOrEqual(2);
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1]);
  });

  test('Criterion 7c: Client request timeout (15s) retries once with same key; exhaustion delivers deterministic fallback', async ({
    page,
    request,
  }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session } = await createRes.json();

    await page.goto(`/practice?sessionId=${session.id}`);

    const idempotencyKeys: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/events') && req.method() === 'POST') {
        const key = req.headers()['idempotency-key'] || req.headers()['Idempotency-Key'];
        if (key) idempotencyKeys.push(key);
      }
    });

    // Set client timeout to 250ms and retry delay to 100ms for test execution
    // Set server delay to 800ms so both attempts exceed client timeout
    await page.evaluate(() => {
      window.__CLIENT_TIMEOUT_MS = 250;
      window.__RETRY_AFTER_MS = 100;
      window.__SUBMIT_EXTRA_PAYLOAD = { simulate_slow_response_ms: 800 };
    });

    await page.getByTestId('answer-input').fill('25');
    await page.getByTestId('submit-attempt-btn').click();

    // Verifies loading state ends with deterministic fallback
    await expect(page.getByTestId('turn-waiting-indicator')).toHaveCount(0, { timeout: 3000 });
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText('What is the first step you would take to solve this problem?');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: fallback');

    // Same idempotency key reused across retries
    expect(idempotencyKeys.length).toBeGreaterThanOrEqual(2);
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1]);
  });

});
