import { test, expect } from '@playwright/test';

test.describe('STU-01: Attempt before guidance', () => {
  test('Criterion 1: Question opens in awaiting_first_attempt with level0_prompt and no hint', async ({ page }) => {
    // Given a published question is opened
    await page.goto('/practice');

    // Then question card loads
    await expect(page.getByTestId('question-card')).toBeVisible();
    await expect(page.getByTestId('problem-stem')).toContainText('Share $60 between Leo and Maya in the ratio 2 : 3');

    // When the session starts
    // Then state is awaiting_first_attempt and level is 0
    await expect(page.getByTestId('session-state-badge')).toContainText('awaiting_first_attempt');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');

    // Tutor asks for first attempt / current thinking (canned level0_prompt) and shows no hint
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText('Take a go at solving this question or share your first step to get started.');
    await expect(page.getByTestId('no-hint-notice')).toBeVisible();

    // Show solution button must not exist in awaiting_first_attempt
    await expect(page.getByTestId('show-solution-btn')).toHaveCount(0);

    // Initial controls are visible
    await expect(page.getByTestId('submit-attempt-btn')).toBeVisible();
    await expect(page.getByTestId('not-sure-btn')).toBeVisible();
  });

  test('Criterion 2: "I am not sure" in awaiting_first_attempt escalates level to 1, preserves attempt count at 0, and asks next probe', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByTestId('session-state-badge')).toContainText('awaiting_first_attempt');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // When student presses "I am not sure"
    await page.getByTestId('not-sure-btn').click();

    // Then state moves to active
    await expect(page.getByTestId('session-state-badge')).toContainText('active');

    // Level rises by one to Level 1
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');

    // Attempt is NOT counted toward attempt_count (remains 0)
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');

    // Tutor asks next probe for Level 1
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toContainText('How many total equal parts are there in the ratio 2 : 3?');

    // History logs not_sure attempt as Not Counted
    const attemptItem = page.getByTestId('attempt-item').first();
    await expect(attemptItem).toBeVisible();
    await expect(attemptItem).toContainText('Not Counted');
    await expect(attemptItem).toContainText('Level 1');

    // Audit trail records not_sure_escalation
    const auditItem = page.getByTestId('audit-item').filter({ hasText: 'not_sure_escalation' });
    await expect(auditItem).toBeVisible();
  });

  test('Criterion 3: "I am not sure" at Level 4 stays at Level 4 and never reaches Level 5', async ({ page }) => {
    await page.goto('/practice');

    // Escalate through "I am not sure" clicks: Level 0 -> 1 -> 2 -> 3 -> 4
    // 1st click: Level 0 -> Level 1
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');

    // 2nd click: Level 1 -> Level 2
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 2');

    // 3rd click: Level 2 -> Level 3
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 3');

    // 4th click: Level 3 -> Level 4
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 4');

    // When student presses "I am not sure" at Level 4
    await page.getByTestId('not-sure-btn').click();

    // Then level STAYS 4 and NEVER reaches Level 5
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 4');
    await expect(page.getByTestId('hint-level-badge')).not.toContainText('Level 5');

    // Tutor shows encouragement or remaining probe
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText("Keep going! Take a moment to review what you've found so far.");

    // Press again at Level 4 to verify idempotent ceiling
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 4');
    await expect(page.getByTestId('hint-level-badge')).not.toContainText('Level 5');

    // Attempt count remains 0 throughout all "I am not sure" presses
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
  });

  test('Criterion 4: Submitting an attempt stores attempt number, hint level, duration, and records audit event', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');

    // Enter answer
    await page.getByTestId('answer-input').fill('36');

    // Submit attempt
    await page.getByTestId('submit-attempt-btn').click();

    // Then attempt count increments to 1
    await expect(page.getByTestId('attempt-count-badge')).toContainText('1');

    // Attempt is stored in attempt history with Attempt #1, Counted, Hint Level 0, and duration
    const attemptItem = page.getByTestId('attempt-item').first();
    await expect(attemptItem).toBeVisible();
    await expect(attemptItem).toContainText('Attempt #1');
    await expect(attemptItem).toContainText('Counted');
    await expect(attemptItem).toContainText('Answer: 36');
    await expect(attemptItem).toContainText('Level 0');
    await expect(attemptItem).toContainText('Duration:');

    // Audit event is recorded
    const auditItem = page.getByTestId('audit-item').filter({ hasText: 'attempt_submitted' });
    await expect(auditItem).toBeVisible();
  });
});
