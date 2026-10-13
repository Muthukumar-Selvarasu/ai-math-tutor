import { test, expect } from '@playwright/test';
import {
  evaluateRetrievalGate,
  searchExemplarsStub,
  validateRetrievalQuery,
  isRetrievalCacheEnabled,
  buildExemplarCacheKey,
  MISCONCEPTION_TAXONOMY,
} from '../../lib/retrieval-gate.js';

test.describe('STU-15: Retrieve exemplars only when the verifier can use them', () => {

  test('Criterion 1: correct, partially_correct, tool_failure, and deterministic match skip retrieval and record retrieval: skipped', async ({ request }) => {
    // 1. Correct answer submission
    const resCorrect = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess1 } = await resCorrect.json();

    const submitCorrect = await request.post(`/api/sessions/${sess1.id}/events`, {
      data: { event: 'submit', answer_text: '36', response_target: 'final' },
    });
    expect(submitCorrect.ok()).toBeTruthy();
    const correctData = await submitCorrect.json();
    expect(correctData.attempt.status).toBe('correct');
    expect(correctData.attempt.retrieval).toBe('skipped');
    expect(correctData.attempt.misconception).toBe('none');
    expect(correctData.attempt.exemplars).toEqual([]);
    expect(correctData.tutor.retrieval).toBe('skipped');
    expect(correctData.tutor.misconception).toBe('none');
    expect(correctData.tutor.exemplars).toEqual([]);

    // 2. Partially correct step submission
    const resPartial = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess2 } = await resPartial.json();

    const submitPartial = await request.post(`/api/sessions/${sess2.id}/events`, {
      data: { event: 'submit', step_expressions: ['2 + 3'] },
    });
    expect(submitPartial.ok()).toBeTruthy();
    const partialData = await submitPartial.json();
    expect(partialData.attempt.status).toBe('partially_correct');
    expect(partialData.attempt.retrieval).toBe('skipped');
    expect(partialData.attempt.misconception).toBe('none');
    expect(partialData.attempt.exemplars).toEqual([]);
    expect(partialData.tutor.retrieval).toBe('skipped');
    expect(partialData.tutor.misconception).toBe('none');

    // 3. Tool failure submission
    const resToolFail = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess3 } = await resToolFail.json();

    const submitToolFail = await request.post(`/api/sessions/${sess3.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
        response_target: 'final',
        simulate_tool_failure: true,
      },
    });
    expect(submitToolFail.ok()).toBeTruthy();
    const toolFailData = await submitToolFail.json();
    expect(toolFailData.attempt.status).toBe('cannot_verify');
    expect(toolFailData.attempt.state).toBe('tool_failure');
    expect(toolFailData.attempt.retrieval).toBe('skipped');
    expect(toolFailData.attempt.misconception).toBe('none');
    expect(toolFailData.attempt.exemplars).toEqual([]);
    expect(toolFailData.tutor.retrieval).toBe('skipped');
    expect(toolFailData.tutor.misconception).toBe('none');
    expect(toolFailData.tutor.exemplars).toEqual([]);

    // 4. Deterministic misconception match (e.g. "24" matches ratio_reversal)
    const resMatch = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess4 } = await resMatch.json();

    const submitMatch = await request.post(`/api/sessions/${sess4.id}/events`, {
      data: { event: 'submit', answer_text: '24', response_target: 'final' },
    });
    expect(submitMatch.ok()).toBeTruthy();
    const matchData = await submitMatch.json();
    expect(matchData.attempt.retrieval).toBe('skipped');
    expect(matchData.attempt.misconception).toBe('ratio_reversal');
    expect(matchData.attempt.exemplars).toEqual([]);
    expect(matchData.tutor.retrieval).toBe('skipped');
    expect(matchData.tutor.misconception).toBe('ratio_reversal');
  });

  test('Criterion 2: incorrect without match or cannot_verify with state=ok opens gate and records retrieval: empty at Tier 1a', async ({ request }) => {
    // 1. Incorrect answer without match ("19")
    const resInc = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess1 } = await resInc.json();

    const submitInc = await request.post(`/api/sessions/${sess1.id}/events`, {
      data: { event: 'submit', answer_text: '19', response_target: 'final' },
    });
    expect(submitInc.ok()).toBeTruthy();
    const incData = await submitInc.json();
    expect(incData.attempt.status).toBe('incorrect');
    expect(incData.attempt.retrieval).toBe('empty');
    expect(incData.attempt.exemplars).toEqual([]);
    expect(incData.tutor.retrieval).toBe('empty');
    expect(incData.tutor.exemplars).toEqual([]);

    // 2. cannot_verify with state=ok (parsed expression matching no step)
    const resExpr = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session: sess2 } = await resExpr.json();

    const submitExpr = await request.post(`/api/sessions/${sess2.id}/events`, {
      data: { event: 'submit', answer_text: '5 * 7', response_target: 'final' },
    });
    expect(submitExpr.ok()).toBeTruthy();
    const exprData = await submitExpr.json();
    expect(exprData.attempt.status).toBe('cannot_verify');
    expect(exprData.attempt.state).toBe('ok');
    expect(exprData.attempt.retrieval).toBe('empty');
    expect(exprData.attempt.exemplars).toEqual([]);
    expect(exprData.tutor.retrieval).toBe('empty');
    expect(exprData.tutor.exemplars).toEqual([]);
  });

  test('Criterion 3: cannot_verify with state=ok and no matched step forces classifier label to insufficient_evidence', async ({ request }) => {
    const res = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'template' },
    });
    const { session } = await res.json();

    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '7 * 9', response_target: 'final' },
    });
    expect(submitRes.ok()).toBeTruthy();
    const data = await submitRes.json();
    expect(data.attempt.status).toBe('cannot_verify');
    expect(data.attempt.state).toBe('ok');
    expect(data.attempt.misconception).toBe('insufficient_evidence');
    expect(data.attempt.misconception_code).toBe('insufficient_evidence');
    expect(data.tutor.misconception).toBe('insufficient_evidence');
    expect(data.attempt.exemplars_used).toBe('none');
    expect(data.tutor.exemplars_used).toBe('none');
  });

  test('Criterion 4: Empty retrieval records exemplars_used: none and the turn still completes normally', async ({ request }) => {
    // Test in LLM dialogue mode
    const resLlm = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', dialogue_mode: 'llm' },
    });
    const { session } = await resLlm.json();

    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20', response_target: 'final' },
    });
    expect(submitRes.ok()).toBeTruthy();
    const data = await submitRes.json();

    // Turn completes successfully
    expect(data.tutor.text).toBeTruthy();
    expect(data.tutor.kind).toBeTruthy();
    expect(data.session.turn_number).toBeGreaterThan(1);
    expect(data.attempt.exemplars_used).toBe('none');
    expect(data.tutor.exemplars_used).toBe('none');
    expect(data.attempt.exemplars).toEqual([]);
    expect(data.tutor.exemplars).toEqual([]);
  });

  test('Criterion 5: Retrieval query contains numbers only and prompt-capture guard rejects student free text', () => {
    // 1. Valid numbers-only query passes
    const validQuery = {
      skill_id: 'ratio_division',
      error_category: 'arithmetic_error',
      canonical_value: '30',
      relation_tags: ['inverse_of_answer', 'sum_of_givens'],
      taxonomy_version: '1.0.0',
    };
    expect(() => validateRetrievalQuery(validQuery)).not.toThrow();

    // 2. Free text in query is rejected by prompt-capture guard
    const leakyQuery1 = {
      skill_id: 'ratio_division',
      error_category: 'arithmetic_error',
      canonical_value: '30',
      free_text: 'Maya gets 30 dollars because she worked hard',
    };
    expect(() => validateRetrievalQuery(leakyQuery1)).toThrow(/Prompt-capture guard violation/);

    const leakyQuery2 = {
      skill_id: 'ratio_division',
      student_text: 'I think the answer is 25',
      canonical_value: '25',
    };
    expect(() => validateRetrievalQuery(leakyQuery2)).toThrow(/Prompt-capture guard violation/);

    // 3. Natural language sentences inside canonical_value are rejected
    const leakyQuery3 = {
      skill_id: 'ratio_division',
      canonical_value: 'maya gets 30 dollars',
    };
    expect(() => validateRetrievalQuery(leakyQuery3)).toThrow(/Prompt-capture guard violation.*canonical_value/);
  });

  test('Criterion 6: Tier 1a has no cache; Gate B exact-key cache format is deterministic', () => {
    // 1. Verify Tier 1a has no cache
    expect(isRetrievalCacheEnabled()).toBe(false);

    // 2. Verify deterministic exact-key format for Tier 1b
    const key1 = buildExemplarCacheKey({
      error_category: 'ratio_reversal',
      skill_id: 'ratio_division',
      taxonomy_version: '1.0.0',
      canonical_value: '24',
      relation_tags: ['swapped_ratio'],
    });
    const key2 = buildExemplarCacheKey({
      error_category: 'ratio_reversal',
      skill_id: 'ratio_division',
      taxonomy_version: '1.0.0',
      canonical_value: '24',
      relation_tags: ['swapped_ratio'],
    });
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2);
    expect(typeof key1).toBe('string');
    expect(key1.length).toBe(64); // SHA-256 hex string length
  });

  test('Criterion 7: Taxonomy used for launch includes all 12 domain codes plus insufficient_evidence (13 total)', () => {
    expect(MISCONCEPTION_TAXONOMY).toHaveLength(13);

    const expectedCodes = [
      'ratio_additive_interpretation',
      'ratio_reversal',
      'whole_to_part_confusion',
      'unit_rate_error',
      'scale_direction_error',
      'unit_conversion_error',
      'arithmetic_error_after_correct_setup',
      'irrelevant_operation',
      'diagram_misread',
      'premature_rounding',
      'incomplete_reasoning',
      'answer_guessing',
      'insufficient_evidence',
    ];

    for (const code of expectedCodes) {
      expect(MISCONCEPTION_TAXONOMY).toContain(code);
    }
  });

});
