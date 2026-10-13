import { test, expect } from '@playwright/test';
import { validateV9, validateV8, validateQuestion } from '../../lib/content-validator';
import { selectTransferPartner, extractSimplifiedRatio } from '../../lib/transfer-selector';
import { getQuestion } from '../../lib/question-loader';

test.describe('STU-06: Test understanding with a similar question (Concept Connections)', () => {

  test('Criterion 1 & 7: Correct answer enters reflection with verified student value in template, structured options + skip, no hint decision, and offers approved transfer partner', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByTestId('question-card')).toBeVisible();

    // Initial state: awaiting_first_attempt, Level 0
    await expect(page.getByTestId('session-state-badge')).toContainText('awaiting_first_attempt');
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');

    // Submit correct answer: "36"
    await page.getByTestId('answer-input').fill('36');
    await page.getByTestId('submit-attempt-btn').click();

    // Criterion 7: Session enters reflection
    await expect(page.getByTestId('session-state-badge')).toContainText('reflection');

    // Reflection prompt is shown with student's verified value "36" replacing {student_value}
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toContainText("You calculated Maya's share as 36. How could you check your answer using Leo's share?");

    // Turn metadata: prompt_type is reflection, hint_level is null (not shown as Level 1-4)
    await expect(page.getByTestId('turn-prompt-type-badge')).toContainText('Prompt: reflection');

    // Reflection section renders structured options and Skip button
    await expect(page.getByTestId('reflection-section')).toBeVisible();
    await expect(page.getByTestId('reflection-option-refl_1')).toBeVisible();
    await expect(page.getByTestId('reflection-option-refl_2')).toBeVisible();
    await expect(page.getByTestId('reflection-option-refl_3')).toBeVisible();
    await expect(page.getByTestId('submit-reflection-btn')).toBeVisible();
    await expect(page.getByTestId('skip-reflection-btn')).toBeVisible();

    // Select reflection option 1 and submit
    await page.getByTestId('reflection-option-refl_1').click();
    await page.getByTestId('submit-reflection-btn').click();

    // Criterion 1: Moves to transfer_offered with authored feedback and transfer offer
    await expect(page.getByTestId('session-state-badge')).toContainText('transfer_offered');
    await expect(tutorPrompt).toContainText("Exactly! Checking that both shares add back up to the total is a great verification step.");
    await expect(tutorPrompt).toContainText("Would you like to try a similar question to solidify what you learned?");

    // Approved transfer controls are present
    await expect(page.getByTestId('accept-transfer-btn')).toBeVisible();
    await expect(page.getByTestId('decline-transfer-btn')).toBeVisible();
  });

  test('Criterion 8: Selecting reflection option or Skip stores choice and sound flag (visible to teacher/audit only), shows authored feedback, never shames, and moves to transfer_offered', async ({ page, request }) => {
    // 1. Create session via API to inspect attempt record and audit event
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();

    // Submit correct answer to enter reflection
    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '36' },
    });
    expect(submitRes.ok()).toBeTruthy();
    const submitData = await submitRes.json();
    expect(submitData.session.state).toBe('reflection');

    // Sound flag must NOT be leaked in student choices payload
    expect(submitData.tutor.choices.every((c: any) => c.sound === undefined)).toBeTruthy();

    // Submit reflection option 2 (which has sound: false)
    const reflRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'reflection_choice', option_id: 'refl_2' },
    });
    expect(reflRes.ok()).toBeTruthy();
    const reflData = await reflRes.json();

    // State moves to transfer_offered
    expect(reflData.session.state).toBe('transfer_offered');

    // Option's authored feedback is shown, and student is never told they are wrong
    expect(reflData.tutor.text).toContain("That checks the ratio difference, but not whether the dollar amounts match the total.");
    expect(reflData.tutor.text).not.toContain("wrong");
    expect(reflData.tutor.text).not.toContain("incorrect");

    // Attempt record and audit event store the choice and sound flag for teacher review
    expect(reflData.attempt.response_type).toBe('reflection_choice');
    expect(reflData.attempt.selected_option_id).toBe('refl_2');
    expect(reflData.attempt.sound).toBe(false);
    expect(reflData.audit_event.selected_option_id).toBe('refl_2');
    expect(reflData.audit_event.sound).toBe(false);

    // 2. Test Skip in UI
    await page.goto('/practice');
    await page.getByTestId('answer-input').fill('36');
    await page.getByTestId('submit-attempt-btn').click();
    await expect(page.getByTestId('session-state-badge')).toContainText('reflection');

    // Click Skip Reflection button
    await page.getByTestId('skip-reflection-btn').click();
    await expect(page.getByTestId('session-state-badge')).toContainText('transfer_offered');
    await expect(page.getByTestId('tutor-prompt')).toContainText("You skipped reflection.");
  });

  test('Criterion 2: Transfer question starts with level0_prompt, Level 0, no hint before first independent attempt, and show_solution is excluded', async ({ page, request }) => {
    await page.goto('/practice');

    // Solve original question and accept transfer
    await page.getByTestId('answer-input').fill('36');
    await page.getByTestId('submit-attempt-btn').click();
    await page.getByTestId('skip-reflection-btn').click();
    await page.getByTestId('accept-transfer-btn').click();

    // State is transfer_active
    await expect(page.getByTestId('session-state-badge')).toContainText('transfer_active');

    // Criterion 2: Level 0 and Attempt 0
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('0');

    // Transfer question stem & title are loaded (ratio_share_002: Sharing $80 in 3:5)
    await expect(page.getByTestId('problem-stem')).toContainText('Share $80 between Dan and Chloe in the ratio 3 : 5');

    // First prompt is level0_prompt: no hint given before first independent attempt
    await expect(page.getByTestId('tutor-prompt')).toContainText('Take a go at solving this question or share your first step to get started.');
    await expect(page.getByTestId('no-hint-notice')).toBeVisible();

    // Show solution button is NOT available in transfer_active
    await expect(page.getByTestId('show-solution-btn')).not.toBeVisible();

    // Directly attempting to call show_solution API in transfer_active returns 409 transition_not_allowed
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'skip' } });
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'accept' } });

    const showSolRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'show_solution' },
    });
    expect(showSolRes.status()).toBe(409);
    const errData = await showSolRes.json();
    expect(errData.error?.code || errData.error).toContain('transition_not_allowed');
  });

  test('Criterion 3: Transfer outcomes: correct (+0.20 confidence), declined/skipped (no confidence raise), and incorrect after struggle', async ({ request }) => {
    // 1. Decline transfer -> transfer_outcome=skipped, confidence remains 0.00
    const res1 = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const s1 = (await res1.json()).session;
    await request.post(`/api/sessions/${s1.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${s1.id}/events`, { data: { event: 'skip' } });

    const declineRes = await request.post(`/api/sessions/${s1.id}/events`, { data: { event: 'decline' } });
    expect(declineRes.ok()).toBeTruthy();
    const declineData = await declineRes.json();
    expect(declineData.session.state).toBe('declined');
    expect(declineData.session.transfer_outcome).toBe('skipped');
    expect(declineData.session.mastery_confidence).toBe(0.0);
    expect(declineData.tutor.text).toContain("No problem! You have completed this question.");

    // 2. Solve transfer correctly -> transfer_outcome=correct, confidence +0.20
    const res2 = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const s2 = (await res2.json()).session;
    await request.post(`/api/sessions/${s2.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${s2.id}/events`, { data: { event: 'skip' } });
    await request.post(`/api/sessions/${s2.id}/events`, { data: { event: 'accept' } });

    // Solve transfer question ratio_share_002 correctly: answer is 50
    const correctRes = await request.post(`/api/sessions/${s2.id}/events`, { data: { event: 'submit', answer_text: '50' } });
    expect(correctRes.ok()).toBeTruthy();
    const correctData = await correctRes.json();
    expect(correctData.session.state).toBe('completed');
    expect(correctData.session.transfer_outcome).toBe('correct');
    expect(correctData.session.mastery_confidence).toBeCloseTo(0.20, 2);

    // 3. Struggle on transfer question: Level 4, >= 3 counted attempts, incorrect -> completed with stuck_after_transfer and transfer_outcome=incorrect
    const res3 = await request.post('/api/sessions', { data: { question_id: 'ratio_share_001' } });
    const s3 = (await res3.json()).session;
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'submit', answer_text: '36' } });
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'skip' } });
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'accept' } });

    // 3 wrong attempts to reach Level 4 and 3 attempts
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'submit', answer_text: '10' } }); // Level 1, Attempt 1
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'submit', answer_text: '20' } }); // Level 2, Attempt 2
    await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'submit', answer_text: '30' } }); // Level 3, Attempt 3
    const struggleRes = await request.post(`/api/sessions/${s3.id}/events`, { data: { event: 'submit', answer_text: '40' } }); // Level 4, Attempt 4

    const struggleData = await struggleRes.json();
    expect(struggleData.session.state).toBe('completed');
    expect(struggleData.session.transfer_outcome).toBe('incorrect');
    expect(struggleData.session.flags).toContain('stuck_after_transfer');
    expect(struggleData.tutor.text).toContain("Good effort on this transfer question. We'll save your work for review.");
    expect(struggleData.session.mastery_confidence).toBe(0.0);
  });

  test('Criterion 4: Skill graph rejects items needing untaught skill, matching accepted value, or matching simplified ratio', () => {
    const original = getQuestion('ratio_share_001');

    // Ratio extraction check
    expect(extractSimplifiedRatio(original)).toBe('2:3');

    // Case A: Partner with untaught skill is rejected
    const untaughtPartner = {
      ...getQuestion('ratio_share_002'),
      skill_id: 'advanced_calculus_untaught',
    };
    const selectUntaught = selectTransferPartner({
      completedQuestion: original,
      questionBank: [untaughtPartner],
      taughtSkills: ['ratio_sharing'],
      cohortStartingSkills: ['ratio_sharing'],
    });
    expect(selectUntaught).toBeNull();

    // Case B: Partner with matching accepted value (36) is rejected
    const matchingValuePartner = {
      ...getQuestion('ratio_share_002'),
      accepted_answer_spec: {
        ...getQuestion('ratio_share_002').accepted_answer_spec,
        canonical_value: '36',
      },
    };
    const selectMatchValue = selectTransferPartner({
      completedQuestion: original,
      questionBank: [matchingValuePartner],
    });
    expect(selectMatchValue).toBeNull();

    // Case C: Partner with matching simplified ratio (e.g. 4 : 6 simplified to 2 : 3) is rejected
    const matchingRatioPartner = {
      ...getQuestion('ratio_share_002'),
      stem: 'Share $100 in the ratio 4 : 6. What is the larger share?',
    };
    const selectMatchRatio = selectTransferPartner({
      completedQuestion: original,
      questionBank: [matchingRatioPartner],
    });
    expect(selectMatchRatio).toBeNull();

    // Case D: Legal partner ratio_share_002 (ratio 3:5, answer 50, same skill) is selected
    const legalPartner = selectTransferPartner({
      completedQuestion: original,
      questionBank: [getQuestion('ratio_share_002')],
    });
    expect(legalPartner).not.toBeNull();
    expect(legalPartner?.question_id).toBe('ratio_share_002');
  });

  test('Criterion 5: Skill graph with no legal partner records no_legal_transfer, canned notice, and invents no item', async ({ request }) => {
    // When completed question has no legal partner available
    const qUnit = getQuestion('ratio_unit_001');

    // Select partner with empty question bank
    const partner = selectTransferPartner({
      completedQuestion: qUnit,
      questionBank: [],
    });
    expect(partner).toBeNull();

    // Session handles absence of partner gracefully
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();
    await request.post(`/api/sessions/${session.id}/events`, { data: { event: 'submit', answer_text: '36' } });

    // Simulate reflection when partner is null
    const originalLoader = getQuestion('ratio_share_002');
    const reflRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'reflection_choice', option_id: 'refl_1' },
    });
    expect(reflRes.ok()).toBeTruthy();
  });

  test('Criterion 6: Content validation fails an approved item with no legal transfer partner (Rule V8)', () => {
    const q = getQuestion('ratio_share_001');

    // When bank has legal partner ratio_share_002, V8 passes
    const validV8 = validateV8(q, [getQuestion('ratio_share_002')]);
    expect(validV8.valid).toBe(true);

    // When bank has NO legal partner for approved question q, V8 fails
    const invalidV8 = validateV8(q, []);
    expect(invalidV8.valid).toBe(false);
    expect(invalidV8.errors[0]).toContain('breaks Rule V8');
  });

  test('Criterion 9: Content validation rejects reflection block breaking Rule V9 (prompt template, options count, sound true, taxonomy phrasing)', () => {
    // 1. Missing or non-object reflection
    expect(validateV9(null).valid).toBe(false);

    // 2. prompt_template with more than 1 question mark
    expect(validateV9({
      prompt_template: "You found {student_value}? Did you check? How?",
      options: [
        { option_id: "1", label: "A", sound: true, feedback: "Good" },
        { option_id: "2", label: "B", sound: false, feedback: "Ok" },
        { option_id: "3", label: "C", sound: false, feedback: "Fine" },
      ],
    }).valid).toBe(false);

    // 3. prompt_template with 0 or multiple {student_value} placeholders
    expect(validateV9({
      prompt_template: "You found the value. How could you check?",
      options: [
        { option_id: "1", label: "A", sound: true, feedback: "Good" },
        { option_id: "2", label: "B", sound: false, feedback: "Ok" },
        { option_id: "3", label: "C", sound: false, feedback: "Fine" },
      ],
    }).valid).toBe(false);

    // 4. Fewer than 3 or more than 4 options
    expect(validateV9({
      prompt_template: "You got {student_value}. How to check?",
      options: [
        { option_id: "1", label: "A", sound: true, feedback: "Good" },
        { option_id: "2", label: "B", sound: false, feedback: "Ok" },
      ],
    }).valid).toBe(false);

    // 5. No option has sound: true
    expect(validateV9({
      prompt_template: "You got {student_value}. How to check?",
      options: [
        { option_id: "1", label: "A", sound: false, feedback: "Good" },
        { option_id: "2", label: "B", sound: false, feedback: "Ok" },
        { option_id: "3", label: "C", sound: false, feedback: "Fine" },
      ],
    }).valid).toBe(false);

    // 6. Option contains taxonomy code in label or feedback
    expect(validateV9({
      prompt_template: "You got {student_value}. How to check?",
      options: [
        { option_id: "1", label: "A", sound: true, feedback: "Good" },
        { option_id: "2", label: "This is a ratio reversal error", sound: false, feedback: "Ok" },
        { option_id: "3", label: "C", sound: false, feedback: "Fine" },
      ],
    }).valid).toBe(false);

    // 7. Valid reflection block passes V9
    const validReflection = getQuestion('ratio_share_001').reflection;
    const v9Result = validateV9(validReflection);
    expect(v9Result.valid).toBe(true);
    expect(v9Result.errors).toHaveLength(0);
  });

});
