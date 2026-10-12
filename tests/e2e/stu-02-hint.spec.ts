import { test, expect } from '@playwright/test';

test.describe('STU-02: One focused hint at a time', () => {
  test('Criterion 1 & 3: Deterministic single_prompt checker passes valid prompts and fails multi-prompt sentences', async ({
    request,
  }) => {
    // Criterion 3: Given "Look at the table. What is the ratio?", check passes
    const passRes = await request.post('/api/checker/single-prompt', {
      data: { text: 'Look at the table. What is the ratio?' },
    });
    expect(passRes.ok()).toBeTruthy();
    const passData = await passRes.json();
    expect(passData.passed).toBe(true);
    expect(passData.score).toBe('single_prompt');
    expect(passData.imperative_count).toBe(1);
    expect(passData.question_count).toBe(1);

    // Criterion 3: Given "Look at the table. Find the parts. What is the ratio?", check fails
    const failRes = await request.post('/api/checker/single-prompt', {
      data: { text: 'Look at the table. Find the parts. What is the ratio?' },
    });
    expect(failRes.ok()).toBeTruthy();
    const failData = await failRes.json();
    expect(failData.passed).toBe(false);
    expect(failData.score).toBe('single_prompt');
    expect(failData.imperative_count).toBe(2);
    expect(failData.reasons.length).toBeGreaterThan(0);

    // Additional checks for multi-question and allowed verbs
    const multiQuestionRes = await request.post('/api/checker/single-prompt', {
      data: { text: "What is Maya's share? What is Leo's share?" },
    });
    const multiQuestionData = await multiQuestionRes.json();
    expect(multiQuestionData.passed).toBe(false);
    expect(multiQuestionData.question_count).toBe(2);

    const singleVerbRes = await request.post('/api/checker/single-prompt', {
      data: { text: 'Try adding the parts together.' },
    });
    const singleVerbData = await singleVerbRes.json();
    expect(singleVerbData.passed).toBe(true);
    expect(singleVerbData.imperative_count).toBe(1);
  });

  test('Criterion 2: Policy escalates level by +1 on incorrect or not_sure, but NOT on correct answer', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Starts at Level 0
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');

    // Given an incorrect attempt at Level 0
    await page.getByTestId('answer-input').fill('20');
    await page.getByTestId('submit-attempt-btn').click();

    // When policy runs, level rises by one to Level 1
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('1');

    // Given another incorrect attempt at Level 1
    await page.getByTestId('answer-input').fill('24');
    await page.getByTestId('submit-attempt-btn').click();

    // When policy runs, level rises by one to Level 2
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 2');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('2');

    // Given a CORRECT answer ("36") at Level 2
    await page.getByTestId('answer-input').fill('36');
    await page.getByTestId('submit-attempt-btn').click();

    // Then state moves to reflection and level does NOT raise (remains Level 2)
    await expect(page.getByTestId('session-state-badge')).toContainText('reflection');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 2');
    await expect(page.getByTestId('hint-level-badge')).not.toContainText('Level 3');
  });

  test('Criterion 4: Turn delivery stores hint level, model, prompt version, policy version, and trace status', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Initial turn metadata (Level 0)
    await expect(page.getByTestId('turn-model-badge')).toContainText('Model: template');
    await expect(page.getByTestId('turn-prompt-version-badge')).toContainText('Prompt: v1.0.0');
    await expect(page.getByTestId('turn-policy-version-badge')).toContainText('Policy: v1.0.0');
    await expect(page.getByTestId('turn-trace-status-badge')).toContainText('Trace: missing');

    // Escalate with not_sure to receive Level 1 hint
    await page.getByTestId('not-sure-btn').click();

    // Delivered turn at Level 1 retains full metadata and single_prompt: Passed
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: probe_template');
    await expect(page.getByTestId('turn-model-badge')).toContainText('Model: template');
    await expect(page.getByTestId('turn-prompt-version-badge')).toContainText('Prompt: v1.0.0');
    await expect(page.getByTestId('turn-policy-version-badge')).toContainText('Policy: v1.0.0');
    await expect(page.getByTestId('turn-trace-status-badge')).toContainText('Trace: missing');
    await expect(page.getByTestId('turn-single-prompt-badge')).toContainText('Single Prompt: Passed');
  });

  test('Criterion 5: Policy selects first unasked probe in authored order whose min_level <= current level, and falls back to canned fallback_l{level} when exhausted', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Initial state: Level 0
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // First escalation: Level 0 -> Level 1 (via incorrect attempt)
    await page.getByTestId('answer-input').fill('15');
    await page.getByTestId('submit-attempt-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');

    // Policy selects probe_1 (first authored probe, min_level: 1)
    const tutorPrompt1 = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt1).toContainText('How many total equal parts are there in the ratio 2 : 3?');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: probe_template');

    // Second escalation: Level 1 -> Level 2 (via incorrect attempt)
    await page.getByTestId('answer-input').fill('10');
    await page.getByTestId('submit-attempt-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 2');

    // Policy selects probe_2 (second authored probe, min_level: 2)
    const tutorPrompt2 = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt2).toContainText('How much is one single part worth if 5 parts equal $60?');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: probe_template');

    // Third escalation: Level 2 -> Level 3 (via incorrect attempt)
    // Authored scaffold_probes only has probe_1 and probe_2; no probe remains for Level 3!
    await page.getByTestId('answer-input').fill('20');
    await page.getByTestId('submit-attempt-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 3');

    // When none remains, the turn is the canned fallback_l3 with no model call
    const tutorPrompt3 = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt3).toContainText('Look at how the numbers are connected.');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: fallback');
    await expect(page.getByTestId('turn-single-prompt-badge')).toContainText('Single Prompt: Passed');
  });
});
