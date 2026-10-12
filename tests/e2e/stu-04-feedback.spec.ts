import { test, expect } from '@playwright/test';
import {
  MISCONCEPTION_TAXONOMY,
  MISCONCEPTION_CONFIDENCE_THRESHOLD,
  classifyMisconception,
  validateClassifierOutput,
} from '../../lib/misconception-classifier';
import { checkSafetyGuard } from '../../lib/safety-guard';

test.describe('STU-04: Feedback on why my answer is incorrect', () => {
  test('Criterion 1: Incorrect answer with LLM-classified misconception at or above threshold asks targeted scaffold in plain English without naming label', async ({
    page,
    request,
  }) => {
    // Navigate to practice page
    await page.goto('/practice');

    // Select LLM Classifier Mode
    const modeSelect = page.getByTestId('dialogue-mode-select');
    await expect(modeSelect).toBeVisible();
    await modeSelect.selectOption('llm');

    // Enter incorrect answer "24" (Leo's share instead of Maya's share -> ratio_reversal)
    await page.getByTestId('answer-input').fill('24');
    await page.getByTestId('submit-attempt-btn').click();

    // Verify hint level escalated to Level 1
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');
    await expect(page.getByTestId('attempt-count-badge')).toContainText('1');

    // Verify metadata shows prompt_type: targeted_scaffold
    await expect(page.getByTestId('turn-prompt-type-badge')).toContainText('Prompt: targeted_scaffold');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: targeted_scaffold');
    await expect(page.getByTestId('turn-model-badge')).toContainText('Model: classifier');

    // Verify tutor delivers targeted scaffold question directing attention to who receives 3 parts
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText('Check which person receives 3 parts of the money according to the ratio.');

    // Crucial check: Tutor speech bubble NEVER names the raw taxonomy code to the student
    const promptText = await tutorPrompt.innerText();
    expect(promptText).not.toContain('ratio_reversal');
    expect(promptText).not.toContain('misconception');

    // Verify single prompt rule passes
    await expect(page.getByTestId('turn-single-prompt-badge')).toContainText('Single Prompt: Passed');

    // Also verify via API event submission with another high-confidence code
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'llm' },
    });
    const { session } = await sessionRes.json();

    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '20',
        response_target: 'final',
        simulated_classification: {
          code: 'unit_rate_error',
          confidence: 0.90,
          evidence: 'Student divided 60 directly by 3 without adding parts',
        },
      },
    });
    expect(submitRes.ok()).toBeTruthy();
    const submitData = await submitRes.json();
    expect(submitData.tutor.prompt_type).toBe('targeted_scaffold');
    expect(submitData.tutor.text).toContain('How many total equal parts are there when you combine 2 and 3?');
    expect(submitData.tutor.text).not.toContain('unit_rate_error');
  });

  test('Criterion 2: Confidence below threshold sets prompt_type=diagnostic_probe and asks neutral question without naming label', async ({
    page,
    request,
  }) => {
    await page.goto('/practice');

    // Switch to LLM Classifier mode
    await page.getByTestId('dialogue-mode-select').selectOption('llm');

    // Submit an unmatched numeric discrepancy "99" (yields insufficient_evidence with confidence 0.35)
    await page.getByTestId('answer-input').fill('99');
    await page.getByTestId('submit-attempt-btn').click();

    // Verify prompt_type is diagnostic_probe
    await expect(page.getByTestId('turn-prompt-type-badge')).toContainText('Prompt: diagnostic_probe');
    await expect(page.getByTestId('turn-kind-badge')).toContainText('Kind: diagnostic_probe');

    // Tutor asks neutral question without naming any misconception label
    const tutorPrompt = page.getByTestId('tutor-prompt');
    await expect(tutorPrompt).toBeVisible();
    await expect(tutorPrompt).toContainText('What steps did you take to reach that number?');

    const promptText = await tutorPrompt.innerText();
    expect(promptText).not.toContain('insufficient_evidence');
    expect(promptText).not.toContain('misconception');

    // Also verify API event with confidence below 0.80 for a specific taxonomy code
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'llm' },
    });
    const { session } = await sessionRes.json();

    const lowConfidenceRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '30',
        response_target: 'final',
        simulated_classification: {
          code: 'whole_to_part_confusion',
          confidence: 0.65, // Below 0.80 threshold
          evidence: 'Uncertain whether student confused part with whole or guessed',
        },
      },
    });
    expect(lowConfidenceRes.ok()).toBeTruthy();
    const lowConfidenceData = await lowConfidenceRes.json();

    // Policy forces prompt_type to diagnostic_probe when confidence < 0.80
    expect(lowConfidenceData.tutor.prompt_type).toBe('diagnostic_probe');
    expect(lowConfidenceData.tutor.text).toBe('What steps did you take to reach that number?');
    expect(lowConfidenceData.tutor.text).not.toContain('whole_to_part_confusion');
  });

  test('Criterion 3: Safety Guard checks feedback: blocks shaming, comparison, ability labels, and enforces plain English', async ({
    request,
  }) => {
    // 1. Direct Safety Guard unit assertions
    // A safe candidate passes cleanly
    const safeResult = checkSafetyGuard('How many equal parts make up the total ratio?');
    expect(safeResult.verdict).toBe('allow');
    expect(safeResult.reason_code).toBeNull();

    // Shaming language is blocked
    const shamingResult = checkSafetyGuard('You are stupid and that answer is obviously wrong.');
    expect(shamingResult.verdict).toBe('block');
    expect(shamingResult.reason_code).toBe('shaming_language');

    // Peer comparison is blocked
    const comparisonResult = checkSafetyGuard('Other students worked this out much faster than you.');
    expect(comparisonResult.verdict).toBe('block');
    expect(comparisonResult.reason_code).toBe('peer_comparison');

    // Ability / intelligence label is blocked
    const abilityResult = checkSafetyGuard('You must be bad at math to make that mistake.');
    expect(abilityResult.verdict).toBe('block');
    expect(abilityResult.reason_code).toBe('ability_label');

    // Raw taxonomy code leakage is blocked
    const taxonomyLeakResult = checkSafetyGuard('Your calculation shows ratio_reversal error.');
    expect(taxonomyLeakResult.verdict).toBe('block');
    expect(taxonomyLeakResult.reason_code).toBe('taxonomy_leakage');

    // Sentence length > 25 words requires revision
    const longSentence =
      'To understand how this problem works you must carefully add all parts of the ratio together and then divide sixty dollars by that sum to determine each part.';
    const lengthResult = checkSafetyGuard(longSentence);
    expect(lengthResult.verdict).toBe('revise');
    expect(lengthResult.reason_code).toBe('sentence_too_long');

    // 2. Integration with session pipeline: Safety Guard blocks unsafe candidate and falls back safely
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'llm' },
    });
    const { session } = await sessionRes.json();

    const unsafeRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '10',
        response_target: 'final',
        simulate_unsafe_feedback: true, // Triggers candidate containing shaming/comparison
      },
    });
    expect(unsafeRes.ok()).toBeTruthy();
    const unsafeData = await unsafeRes.json();

    // Verifies the unsafe text is intercepted; fallback canned text delivered instead
    expect(unsafeData.tutor.text).not.toContain('stupid');
    expect(unsafeData.tutor.text).not.toContain('behind other students');
    expect(unsafeData.tutor.kind).toBe('fallback');
    expect(unsafeData.tutor.safety_verdict).toBe('block');
  });

  test('Criterion 4: Classifier returns and stores closed taxonomy code, confidence, evidence, alternative labels, prompt type, and reviewer status', async ({
    page,
    request,
  }) => {
    // 1. Verify taxonomy closure (13 closed enum values)
    expect(MISCONCEPTION_TAXONOMY).toHaveLength(13);
    expect(MISCONCEPTION_TAXONOMY).toContain('ratio_additive_interpretation');
    expect(MISCONCEPTION_TAXONOMY).toContain('ratio_reversal');
    expect(MISCONCEPTION_TAXONOMY).toContain('whole_to_part_confusion');
    expect(MISCONCEPTION_TAXONOMY).toContain('unit_rate_error');
    expect(MISCONCEPTION_TAXONOMY).toContain('scale_direction_error');
    expect(MISCONCEPTION_TAXONOMY).toContain('unit_conversion_error');
    expect(MISCONCEPTION_TAXONOMY).toContain('arithmetic_error_after_correct_setup');
    expect(MISCONCEPTION_TAXONOMY).toContain('irrelevant_operation');
    expect(MISCONCEPTION_TAXONOMY).toContain('diagram_misread');
    expect(MISCONCEPTION_TAXONOMY).toContain('premature_rounding');
    expect(MISCONCEPTION_TAXONOMY).toContain('incomplete_reasoning');
    expect(MISCONCEPTION_TAXONOMY).toContain('answer_guessing');
    expect(MISCONCEPTION_TAXONOMY).toContain('insufficient_evidence');

    // Invalid taxonomy code is rejected by schema validator
    expect(() =>
      validateClassifierOutput({
        code: 'non_existent_code',
        confidence: 0.9,
      })
    ).toThrow('Invalid taxonomy code');

    // 2. Submit attempt with full classifier schema contract via API
    const sessionRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'llm' },
    });
    const { session } = await sessionRes.json();

    const classifyPayload = {
      event: 'submit',
      answer_text: '20',
      response_target: 'final',
      simulated_classification: {
        code: 'unit_rate_error',
        confidence: 0.94,
        evidence: 'Divided 60 directly by 3 without computing total ratio parts.',
        alternative_labels: ['whole_to_part_confusion'],
        cited_exemplar_ids: ['ex_ratio_001'],
      },
    };

    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: classifyPayload,
    });
    expect(submitRes.ok()).toBeTruthy();
    const result = await submitRes.json();

    // Verify stored misconception_event attributes
    const evt = result.misconception_event;
    expect(evt).toBeTruthy();
    expect(evt.code).toBe('unit_rate_error');
    expect(evt.confidence).toBe(0.94);
    expect(evt.evidence).toBe('Divided 60 directly by 3 without computing total ratio parts.');
    expect(evt.alternative_labels).toEqual(['whole_to_part_confusion']);
    expect(evt.recommended_prompt_type).toBe('targeted_scaffold');
    expect(evt.reviewer_status).toBe('unreviewed'); // Initial status starts unreviewed
    expect(evt.cited_exemplar_ids).toEqual(['ex_ratio_001']);

    // Check attempt record stores misconception metadata
    expect(result.attempt.misconception_code).toBe('unit_rate_error');
    expect(result.attempt.prompt_type).toBe('targeted_scaffold');
    expect(result.attempt.reviewer_status).toBe('unreviewed');

    // 3. Test insufficient_evidence sentinel: must not claim a misconception
    const sentinelRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '47',
        response_target: 'final',
        simulated_classification: {
          code: 'insufficient_evidence',
          confidence: 0.25,
          evidence: 'Numeric input shows no known misconception pattern.',
        },
      },
    });
    expect(sentinelRes.ok()).toBeTruthy();
    const sentinelData = await sentinelRes.json();
    const sentinelEvt = sentinelData.misconception_event;
    expect(sentinelEvt.code).toBe('insufficient_evidence');
    expect(sentinelEvt.recommended_prompt_type).toBe('diagnostic_probe');
    expect(sentinelEvt.reviewer_status).toBe('unreviewed');

    // 4. UI check: Teacher Diagnostic Events card renders stored events and reviewer status
    await page.goto('/practice');
    await page.getByTestId('dialogue-mode-select').selectOption('llm');
    await page.getByTestId('answer-input').fill('24');
    await page.getByTestId('submit-attempt-btn').click();

    const diagnosticCard = page.getByTestId('misconception-events-card');
    await expect(diagnosticCard).toBeVisible();

    const eventItem = page.getByTestId('misconception-event-item').first();
    await expect(eventItem).toBeVisible();
    await expect(page.getByTestId('event-taxonomy-code').first()).toContainText('ratio_reversal');
    await expect(page.getByTestId('event-reviewer-status').first()).toContainText('unreviewed');
    await expect(page.getByTestId('event-prompt-type').first()).toContainText('targeted_scaffold');
    await expect(page.getByTestId('event-confidence').first()).toContainText('0.9');
  });
});
