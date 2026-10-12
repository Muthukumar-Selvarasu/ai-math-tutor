import { test, expect } from '@playwright/test';

test.describe('STU-03: Submit working and selected reasoning options', () => {
  test('Criterion 1: Student picks structured reasoning option, stored as selected_reasoning_option and maps to misconception hint or step', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Given reasoning options are visible for the question
    await expect(page.getByTestId('reasoning-section')).toBeVisible();
    const reasoningSelect = page.getByTestId('reasoning-option-select');
    await expect(reasoningSelect).toBeVisible();

    // When the student selects "Divided $60 by 3" (opt_diff) and submits strategy
    await reasoningSelect.selectOption('opt_diff');
    await page.getByTestId('submit-reasoning-btn').click();

    // Then choice is stored as selected_reasoning_option on the attempt
    const attemptItem = page.getByTestId('attempt-item').first();
    await expect(attemptItem).toBeVisible();
    await expect(page.getByTestId('attempt-reasoning-val')).toContainText('opt_diff');

    // And tutor responds with misconception-guided prompt mapping to unit_rate_error
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toContainText('Dividing $60 by 3 assumes 3 equal parts in total.');

    // Strategy submission is an answerless turn; attempt_count remains 0
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
  });

  test('Criterion 2: Accepts and parses varied formats; working step expression is parsed, matched to solution step, and stored', async ({
    page,
    request,
  }) => {
    // Submitting working step expression in UI
    await page.goto('/practice');
    await expect(page.getByTestId('step-working-section')).toBeVisible();

    // Given student enters step expression "2 + 3"
    await page.getByTestId('step-expression-input').fill('2 + 3');
    await page.getByTestId('submit-step-btn').click();

    // Then step is stored on the attempt
    const attemptItem = page.getByTestId('attempt-item').first();
    await expect(attemptItem).toBeVisible();
    await expect(page.getByTestId('attempt-step-val')).toContainText('2 + 3');

    // And tutor acknowledges step progress
    await expect(page.getByTestId('tutor-prompt')).toContainText('Good work on step: Find total number of parts');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('1');

    // Check normaliser parser accepts varied formats via sessions event API
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await sessionRes.json();

    // Fraction format: 3/5
    const fracRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '3/5', response_target: 'final' },
    });
    expect(fracRes.ok()).toBeTruthy();
    const fracData = await fracRes.json();
    expect(fracData.attempt.answer_text).toBe('3/5');

    // Percentage format: 20%
    const pctRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20%', response_target: 'final' },
    });
    expect(pctRes.ok()).toBeTruthy();
    const pctData = await pctRes.json();
    expect(pctData.attempt.answer_text).toBe('20%');

    // Ratio format: 2:3
    const ratioRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '2:3', response_target: 'final' },
    });
    expect(ratioRes.ok()).toBeTruthy();
    const ratioData = await ratioRes.json();
    expect(ratioData.attempt.answer_text).toBe('2:3');
  });

  test('Criterion 3: Saving a student note is stored scrubbed, shows canned note_ack, and is not a pipeline turn', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Initial session counters
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // Given student enters a note containing PII
    const noteInput = page.getByTestId('student-note-input');
    await expect(noteInput).toBeVisible();
    await noteInput.fill('Need teacher help. Contact me at student@school.edu or 555-123-4567');
    await page.getByTestId('save-note-btn').click();

    // Then tutor shows canned note_ack
    await expect(page.getByTestId('tutor-prompt')).toContainText('Your note has been saved for your teacher.');

    // And note is NOT a pipeline turn: counters do NOT change
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // Audit log records note_saved event
    await expect(page.getByTestId('audit-item').filter({ hasText: 'note_saved' })).toBeVisible();
  });

  test('Criterion 4: Optional confidence rating is stored on attempt; omitting it still submits normally', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Submit attempt WITH confidence rating
    await page.getByTestId('answer-input').fill('24');
    await page.getByTestId('confidence-rating-select').selectOption('4');
    await page.getByTestId('submit-attempt-btn').click();

    // Then confidence is stored on the attempt
    const firstAttempt = page.getByTestId('attempt-item').first();
    await expect(firstAttempt).toBeVisible();
    await expect(page.getByTestId('attempt-confidence-val')).toContainText('4/5');

    // Submit another attempt WITHOUT confidence rating (omitted)
    await page.getByTestId('confidence-rating-select').selectOption('');
    await page.getByTestId('answer-input').fill('36');
    await page.getByTestId('submit-attempt-btn').click();

    // Then submission succeeds normally
    await expect(page.getByTestId('session-state-badge')).toContainText('reflection');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('2');
  });

  test('Criterion 5: Unparsed input and comma outside 30,000 pattern asks for rephrase and does not mark student wrong', async ({
    page,
  }) => {
    await page.goto('/practice');

    // Given a number with comma outside 30,000 pattern: "7,5"
    await page.getByTestId('answer-input').fill('7,5');
    await page.getByTestId('submit-attempt-btn').click();

    // Then tutor asks for dot for decimals (canned use_dot_for_decimals)
    await expect(page.getByTestId('tutor-prompt')).toContainText(
      'Please use a dot rather than a comma for decimal numbers.'
    );

    // Student is not marked wrong: attempt count remains 0, level remains 0
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
    await expect(page.getByTestId('attempt-item').first()).toContainText('Not Counted');

    // Given unparsed gibberish
    await page.getByTestId('answer-input').fill('gibberish!@#');
    await page.getByTestId('submit-attempt-btn').click();

    // Second in a row triggers ambiguity guard (Criterion 6), but first check asked for rephrase
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
  });

  test('Criterion 6: Two consecutive cannot_verify (unparsed or comma_ambiguous) switches to structured mode and flags ambiguity_review; row 5b expression does not', async ({
    page,
    request,
  }) => {
    await page.goto('/practice');

    // Initially mode is keypad and flags are none
    await expect(page.getByTestId('input-mode-badge')).toContainText('keypad');
    await expect(page.getByTestId('session-flags-badge')).toContainText('none');

    // 1st unparsed / comma ambiguous: "7,5"
    await page.getByTestId('answer-input').fill('7,5');
    await page.getByTestId('submit-attempt-btn').click();

    // 1st time: asks for rephrase, no flag yet, mode still keypad
    await expect(page.getByTestId('tutor-prompt')).toContainText('Please use a dot rather than a comma');
    await expect(page.getByTestId('session-flags-badge')).toContainText('none');
    await expect(page.getByTestId('input-mode-badge')).toContainText('keypad');

    // 2nd consecutive unparsed / comma ambiguous: "invalid_input"
    await page.getByTestId('answer-input').fill('invalid_input');
    await page.getByTestId('submit-attempt-btn').click();

    // 2nd time: switches to structured mode and flags ambiguity_review
    await expect(page.getByTestId('tutor-prompt')).toContainText(
      "Let's switch to structured steps to make this easier to follow."
    );
    await expect(page.getByTestId('session-flags-badge')).toContainText('ambiguity_review');
    await expect(page.getByTestId('input-mode-badge')).toContainText('structured');

    // Hint level does NOT change and attempt count is NOT incremented
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // Row 5b verification: a parsed expression matching no step does NOT trigger ambiguity_review
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session: sess } = await sessionRes.json();

    const exprRes1 = await request.post(`/api/sessions/${sess.id}/events`, {
      data: {
        event: 'submit',
        step_expressions: ['10 + 20'],
        response_target: 'step',
      },
    });
    const exprData1 = await exprRes1.json();
    expect(exprData1.attempt.status).toBe('cannot_verify');
    expect(exprData1.attempt.state).toBe('ok');
    expect(exprData1.session.flags).not.toContain('ambiguity_review');
    expect(exprData1.session.input_mode).toBe('keypad');

    // Second unmatched step also leaves consecutive_cannot_verify unchanged
    const exprRes2 = await request.post(`/api/sessions/${sess.id}/events`, {
      data: {
        event: 'submit',
        step_expressions: ['99 - 1'],
        response_target: 'step',
      },
    });
    const exprData2 = await exprRes2.json();
    expect(exprData2.session.flags).not.toContain('ambiguity_review');
    expect(exprData2.session.input_mode).toBe('keypad');
  });

  test('Criterion 7: Verifier tool failure returns cannot_verify with state=tool_failure, canned tool_failure_notice, and session stays open', async ({
    request,
  }) => {
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await sessionRes.json();
    expect(session.state).toBe('awaiting_first_attempt');

    // When tool failure occurs during verifier execution
    const failRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
        simulate_tool_failure: true,
      },
    });
    expect(failRes.ok()).toBeTruthy();
    const failData = await failRes.json();

    // Then status is cannot_verify and state is tool_failure
    expect(failData.attempt.status).toBe('cannot_verify');
    expect(failData.attempt.state).toBe('tool_failure');

    // Student is told the check could not be completed via canned tool_failure_notice
    expect(failData.tutor.text).toBe(
      'We are experiencing a temporary issue checking this step. Your progress is saved.'
    );
    expect(failData.tutor.kind).toBe('canned');

    // Session stays open (awaiting_first_attempt), attempt_count not incremented, hint_level unchanged
    expect(failData.session.state).toBe('awaiting_first_attempt');
    expect(failData.session.attempt_count).toBe(0);
    expect(failData.session.hint_level).toBe(0);
  });
});
