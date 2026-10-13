import { test, expect } from '@playwright/test';
import {
  MathVerifierAgent,
  verifyExpression,
  applyOverlay,
  simplifyRatio,
  areRatiosEquivalent,
  isRatioSwapped,
  checkUnitConsistency,
  matchExpressionByForm,
  getVerifierCache,
  clearVerifierCache,
  validatePureResultSchema,
} from '../../lib/math-verifier.js';
import { validateQuestion } from '../../lib/content-validator.js';
import { getQuestion } from '../../lib/question-loader.js';

test.describe('STU-11: Deterministic Ratio & Math Verifier', () => {
  test.beforeEach(() => {
    clearVerifierCache();
  });

  test('Criterion 1: Equivalent answer in another format (3/4 and 0.75) returns correct', async ({ request }) => {
    // 1. Direct verifier verification
    const questionSpec = {
      question_id: 'q_fraction_001',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '0.75',
        tolerance: 0,
        accepted_forms: ['0.75', '3/4'],
      },
    };

    const resFraction = verifyExpression({
      question: questionSpec,
      studentInput: '3/4',
      fieldKind: 'answer',
    });
    expect(resFraction.status).toBe('correct');
    expect(resFraction.canonical_value).toBe('3/4');

    const resDecimal = verifyExpression({
      question: questionSpec,
      studentInput: '0.75',
      fieldKind: 'answer',
    });
    expect(resDecimal.status).toBe('correct');
    expect(resDecimal.canonical_value).toBe('0.75');

    // 2. Integration via API session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { session } = await createRes.json();

    // ratio_share_001 accepted is 36, also accept formatted $36
    const eventRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '$36',
      },
    });
    expect(eventRes.ok()).toBeTruthy();
    const eventData = await eventRes.json();
    expect(eventData.tutor.verifier_result.status_post_overlay).toBe('correct');
  });

  test('Criterion 2: Ratio that simplifies to the accepted ratio (6:4 and 3:2) returns correct', async () => {
    // Test simplifyRatio and areRatiosEquivalent helpers
    expect(simplifyRatio('6:4').simplified).toBe('3:2');
    expect(simplifyRatio('15 : 10').simplified).toBe('3:2');
    expect(areRatiosEquivalent('6:4', '3:2')).toBe(true);
    expect(areRatiosEquivalent('6:4', '2:3')).toBe(false);

    const questionSpec = {
      question_id: 'ratio_simp_test',
      version: 1,
      accepted_answer_spec: {
        type: 'ratio',
        canonical_value: '3:2',
        tolerance: 0,
      },
    };

    const result = verifyExpression({
      question: questionSpec,
      studentInput: '6:4',
      fieldKind: 'answer',
    });
    expect(result.status).toBe('correct');
    expect(result.canonical_value).toBe('6:4');
  });

  test('Criterion 3: Proportional scaling is correct, additive change of same numbers is incorrect', async ({ request }) => {
    // ratio_unit_001: 4 oranges cost $10. What do 8 oranges cost?
    // Canonical answer is 20 ($20). Additive error would be 10 + 4 = 14 or 16.
    const q = getQuestion('ratio_unit_001');
    expect(q).toBeTruthy();

    const correctRes = verifyExpression({
      question: q,
      studentInput: '20',
      fieldKind: 'answer',
    });
    expect(correctRes.status).toBe('correct');

    const additiveRes = verifyExpression({
      question: q,
      studentInput: '14',
      fieldKind: 'answer',
    });
    expect(additiveRes.status).toBe('incorrect');
    expect(additiveRes.relation_tags).toContain('difference_of_givens');

    // Also test via API
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_unit_001' },
    });
    const { session } = await createRes.json();

    const submitAdditive = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '14',
      },
    });
    const addData = await submitAdditive.json();
    expect(addData.tutor.verifier_result.status_post_overlay).toBe('incorrect');
    expect(addData.session.hint_level).toBe(1);
  });

  test('Criterion 4: Supported unit conversion (8 km vs 8000 m) is correct, wrong unit is unit_error', async () => {
    const questionSpec = {
      question_id: 'dist_q',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '8000',
        unit: 'm',
        answer_requires_unit: true,
      },
    };

    // Correct conversion: 8 km -> 8000 m
    const kmRes = verifyExpression({
      question: questionSpec,
      studentInput: '8 km',
      fieldKind: 'answer',
    });
    expect(kmRes.status).toBe('correct');
    expect(kmRes.canonical_value).toBe('8');
    expect(kmRes.unit).toBe('km');

    // Matching base unit: 8000 m
    const mRes = verifyExpression({
      question: questionSpec,
      studentInput: '8000 m',
      fieldKind: 'answer',
    });
    expect(mRes.status).toBe('correct');

    // Wrong unit: 8000 kg -> unit_error
    const wrongUnitRes = verifyExpression({
      question: questionSpec,
      studentInput: '8000 kg',
      fieldKind: 'answer',
    });
    expect(wrongUnitRes.status).toBe('incorrect');
    expect(wrongUnitRes.error_category).toBe('unit_error');
    expect(wrongUnitRes.relation_tags).toContain('wrong_unit_scale');
  });

  test('Criterion 5: Tolerance rule: within tolerance is correct, outside is incorrect', async () => {
    const questionSpec = {
      question_id: 'q_tolerance',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '10',
        tolerance: 0.5,
      },
    };

    // Within tolerance (10.4 is 4% error)
    const insideRes = verifyExpression({
      question: questionSpec,
      studentInput: '10.4',
      fieldKind: 'answer',
    });
    expect(insideRes.status).toBe('correct');

    // Outside tolerance (11.0 is 10% error)
    const outsideRes = verifyExpression({
      question: questionSpec,
      studentInput: '11.0',
      fieldKind: 'answer',
    });
    expect(outsideRes.status).toBe('incorrect');
  });

  test('Criterion 6: Structured step expression on a supported item is partially_correct, accepted_answer: false, and hint level escalates', async ({ request }) => {
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();
    expect(session.hint_level).toBe(0);

    // Submit structured step expression "2 + 3"
    const stepRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        step_expressions: ['2 + 3'],
      },
    });
    expect(stepRes.ok()).toBeTruthy();
    const data = await stepRes.json();

    expect(data.tutor.verifier_result.status_post_overlay).toBe('partially_correct');
    expect(data.tutor.verifier_result.accepted_answer).toBe(false);
    expect(data.attempt.accepted_answer).toBe(false);
    expect(data.attempt.status).toBe('partially_correct');
    expect(data.session.hint_level).toBe(1); // Escalated by 1
    expect(data.tutor.text).toContain('calculation');
  });

  test('Criterion 7: Disagreeing answer key and solution plan returns cannot_verify and flags session', async ({ request }) => {
    // Inconsistent question spec where answer_key_inconsistency is true
    const inconsistentQuestion = {
      question_id: 'ratio_bad_001',
      version: 1,
      flagged: true,
      answer_key_inconsistency: true,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '36',
      },
    };

    // Run verifier directly
    const pure = verifyExpression({
      question: inconsistentQuestion,
      studentInput: '36',
      fieldKind: 'answer',
    });
    expect(pure.status).toBe('cannot_verify');

    // Run via MathVerifierAgent
    const agentRes = MathVerifierAgent.runTurn({
      question: inconsistentQuestion,
      input: '36',
      fieldKind: 'answer',
      responseTarget: 'final',
    });
    expect(agentRes.pureResult.status).toBe('cannot_verify');
    expect(agentRes.outcome.status_post_overlay).toBe('cannot_verify');
  });

  test('Criterion 8: Scaffold probe answer expected value returns partially_correct, progress=advancing, level unchanged; wrong probe answer returns incorrect', async ({ request }) => {
    // Create session for ratio_share_001
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();

    // Trigger not_sure so tutor asks probe_1 ("How many total equal parts are there in the ratio 2 : 3?")
    const notSureRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'not_sure' },
    });
    const notSureData = await notSureRes.json();
    expect(notSureData.session.hint_level).toBe(1);
    expect(notSureData.session.active_probe_id).toBe('probe_1');
    expect(notSureData.session.next_target).toBe('probe');

    // Student answers probe_1 with expected value "5"
    const probeSubmitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '5',
        response_target: 'probe',
      },
    });
    const probeData = await probeSubmitRes.json();

    // Verifier returns partially_correct, progress: advancing, level stays 1
    expect(probeData.tutor.verifier_result.status_post_overlay).toBe('partially_correct');
    expect(probeData.tutor.verifier_result.progress).toBe('advancing');
    expect(probeData.session.hint_level).toBe(1); // Hint level does NOT escalate
    expect(probeData.session.active_probe_id).toBeNull();
    expect(probeData.session.next_target).toBe('final');

    // Now test a wrong probe answer on another session
    const createRes2 = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const session2 = (await createRes2.json()).session;
    await request.post(`/api/sessions/${session2.id}/events`, { data: { event: 'not_sure' } });

    // Submit wrong probe answer "99"
    const wrongProbeRes = await request.post(`/api/sessions/${session2.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '99',
        response_target: 'probe',
      },
    });
    const wrongData = await wrongProbeRes.json();
    expect(wrongData.tutor.verifier_result.status_post_overlay).toBe('incorrect');
    expect(wrongData.session.hint_level).toBe(2); // Escalates on incorrect
  });

  test('Criterion 9: Response-target overlay is applied after cache and is never cached; same value without active probe judged without overlay', async () => {
    const q = getQuestion('ratio_share_001');
    clearVerifierCache();

    // 1. Run with responseTarget="probe" for probe value "5"
    const probeTurn = MathVerifierAgent.runTurn({
      question: q,
      input: '5',
      fieldKind: 'step',
      responseTarget: 'probe',
    });

    expect(probeTurn.pureResult.status).toBe('incorrect'); // In pure result (target_value != final answer 36)
    expect(probeTurn.pureResult.matched_step_ids).toContain('step_1');
    expect(probeTurn.outcome.status_post_overlay).toBe('partially_correct');
    expect(probeTurn.outcome.overlay_applied).toBe(true);

    // Verify cache has only pure result, NOT the overlay
    const cache = getVerifierCache();
    expect(cache.size).toBe(1);
    const cachedPure = Array.from(cache.values())[0];
    expect(cachedPure.status).toBe('incorrect');
    expect(cachedPure.overlay_applied).toBeUndefined();
    expect(cachedPure.response_target).toBeUndefined();

    // 2. Run same value "5" with responseTarget="final"
    const finalTurn = MathVerifierAgent.runTurn({
      question: q,
      input: '5',
      fieldKind: 'answer',
      responseTarget: 'final',
    });

    // Pure result hit cache
    expect(finalTurn.pureResult.status).toBe('incorrect');
    // Overlay for final answer matching step value makes status incorrect with incomplete error category
    expect(finalTurn.outcome.status_post_overlay).toBe('incorrect');
    expect(finalTurn.outcome.error_category).toBe('incomplete');
    expect(finalTurn.outcome.overlay_applied).toBe(true);
  });

  test('Criterion 10: Intermediate value in final answer field returns incorrect with error_category incomplete', async () => {
    const q = getQuestion('ratio_share_001');

    // Intermediate value 12 (value of 1 part) sent to final answer field
    const turn = MathVerifierAgent.runTurn({
      question: q,
      input: '12',
      fieldKind: 'answer',
      responseTarget: 'final',
    });

    expect(turn.outcome.status_post_overlay).toBe('incorrect');
    expect(turn.outcome.error_category).toBe('incomplete');
    expect(turn.outcome.matched_step_ids).toContain('step_2');
    expect(turn.outcome.matched_solution_step_post_overlay).toBeNull();
  });

  test('Criterion 11: Expression 7.5 × 4 is partially_correct, accepted_answer: false, never correct; 4 × 7.5 matches, 7.5 ÷ 4 does not', async () => {
    const questionSpec = {
      question_id: 'q_expr_test',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '30',
        tolerance: 0,
      },
      solution_steps: [
        {
          step_id: 'step_mult',
          target_expression: '7.5 * 4',
          target_value: '30',
        },
      ],
    };

    // "7.5 × 4" in answer field
    const turn1 = MathVerifierAgent.runTurn({
      question: questionSpec,
      input: '7.5 × 4',
      fieldKind: 'step',
      responseTarget: 'step',
    });
    expect(turn1.outcome.status_post_overlay).toBe('partially_correct');
    expect(turn1.outcome.accepted_answer).toBe(false);

    // "4 × 7.5" gives the same result (commutative)
    const turn2 = MathVerifierAgent.runTurn({
      question: questionSpec,
      input: '4 × 7.5',
      fieldKind: 'step',
      responseTarget: 'step',
    });
    expect(turn2.outcome.status_post_overlay).toBe('partially_correct');
    expect(turn2.outcome.accepted_answer).toBe(false);

    // "7.5 ÷ 4" does not match
    const turn3 = MathVerifierAgent.runTurn({
      question: questionSpec,
      input: '7.5 ÷ 4',
      fieldKind: 'step',
      responseTarget: 'step',
    });
    expect(turn3.outcome.status_post_overlay).not.toBe('partially_correct');
  });

  test('Criterion 12: Expression matching no step in answer field returns cannot_verify (row 5b, uncounted, level unchanged); in probe field returns incorrect', async ({ request }) => {
    // 1. In answer field: creates session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    const { session } = await createRes.json();
    expect(session.hint_level).toBe(0);
    expect(session.attempt_count).toBe(0);

    // Submit unmatched expression "100 / 7" to answer field
    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '100 ÷ 7',
        response_target: 'final',
      },
    });
    expect(submitRes.ok()).toBeTruthy();
    const data = await submitRes.json();

    // SM-1 row 5b: cannot_verify, state=ok, attempt not counted, hint level unchanged
    expect(data.tutor.verifier_result.status_post_overlay).toBe('cannot_verify');
    expect(data.tutor.verifier_result.state).toBe('ok');
    expect(data.attempt.counted).toBe(false);
    expect(data.session.hint_level).toBe(0);
    expect(data.session.attempt_count).toBe(0);
    expect(data.tutor.text).toContain('the number your calculation gives');

    // 2. In probe field: overlay makes it incorrect
    const q = getQuestion('ratio_share_001');
    const probeOutcome = applyOverlay({
      pureResult: {
        status: 'cannot_verify',
        state: 'ok',
        input_kind: 'expression',
        matched_step_ids: [],
        matched_solution_step: null,
      },
      responseTarget: 'probe',
      question: q,
      input: '100 ÷ 7',
    });
    expect(probeOutcome.status_post_overlay).toBe('incorrect');
  });

  test('Criterion 13: kind: setup probe expression matching counts_as_step_id is partially_correct, different expression is incorrect', async () => {
    const questionSpec = {
      question_id: 'q_setup_probe',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '36',
      },
      solution_steps: [
        {
          step_id: 'step_setup',
          target_expression: '60 / 5',
          target_value: '12',
        },
        {
          step_id: 'step_final',
          target_expression: '12 * 3',
          target_value: '36',
        },
      ],
      scaffold_probes: [
        {
          probe_id: 'probe_setup',
          kind: 'setup',
          min_level: 2,
          template: 'Write the calculation to find 1 part.',
          expected_expression: '60 / 5',
          expected_value: '12',
          counts_as_step_id: 'step_setup',
        },
      ],
    };

    // Matching expression "60 ÷ 5"
    const matchTurn = MathVerifierAgent.runTurn({
      question: questionSpec,
      input: '60 ÷ 5',
      fieldKind: 'step',
      responseTarget: 'probe',
    });
    expect(matchTurn.outcome.status_post_overlay).toBe('partially_correct');
    expect(matchTurn.outcome.matched_solution_step_post_overlay).toBe('step_setup');

    // Non-matching expression "60 - 5"
    const mismatchTurn = MathVerifierAgent.runTurn({
      question: questionSpec,
      input: '60 - 5',
      fieldKind: 'step',
      responseTarget: 'probe',
    });
    expect(mismatchTurn.outcome.status_post_overlay).toBe('incorrect');
  });

  test('Criterion 14: Value equal to intermediate step target_value in pure verifier has status incorrect, matched_step_ids; swapped ratio is incorrect with reversed_ratio_match and swapped_ratio tag', async () => {
    const q = getQuestion('ratio_share_001');

    // Intermediate value 12
    const pureInterm = verifyExpression({
      question: q,
      studentInput: '12',
      fieldKind: 'answer',
    });
    expect(pureInterm.status).toBe('incorrect');
    expect(pureInterm.matched_step_ids).toContain('step_2');
    expect(pureInterm.matched_solution_step).toBeNull();

    // Ratio reversal: question accepted is 3:2, student enters 2:3
    const ratioQ = {
      question_id: 'ratio_q',
      version: 1,
      accepted_answer_spec: {
        type: 'ratio',
        canonical_value: '3:2',
      },
    };

    expect(isRatioSwapped('2:3', '3:2')).toBe(true);
    const swappedRes = verifyExpression({
      question: ratioQ,
      studentInput: '2:3',
      fieldKind: 'answer',
    });
    expect(swappedRes.status).toBe('incorrect');
    expect(swappedRes.error_category).toBe('reversed_ratio_match');
    expect(swappedRes.relation_tags).toContain('swapped_ratio');
  });

  test('Criterion 15: Unparseable input returns cannot_verify with canonical_value=null and incomplete; tool failure returns cannot_verify tool_failure', async ({ request }) => {
    const q = getQuestion('ratio_share_001');

    // 1. Unparseable input
    const unparsed = verifyExpression({
      question: q,
      studentInput: '???!!!',
      fieldKind: 'answer',
    });
    expect(unparsed.status).toBe('cannot_verify');
    expect(unparsed.canonical_value).toBeNull();
    expect(unparsed.error_category).toBe('incomplete');

    // 2. Simulated tool failure
    const toolFail = MathVerifierAgent.runTurn({
      question: q,
      input: '36',
      fieldKind: 'answer',
      responseTarget: 'final',
      simulate_tool_failure: true,
    });
    expect(toolFail.pureResult.status).toBe('cannot_verify');
    expect(toolFail.pureResult.state).toBe('tool_failure');
    expect(toolFail.pureResult.canonical_value).toBeNull();
    expect(toolFail.pureResult.error_category).toBeNull();
  });

  test('Criterion 16: / in answer field is fraction (3/4 = 0.75); in step or probe field read as ÷ (450/5 matches 450 / 5); x between numerals is ×', async () => {
    // 1. Answer field fraction
    const fracSpec = {
      question_id: 'frac_q',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '0.75',
      },
    };
    const answerRes = verifyExpression({
      question: fracSpec,
      studentInput: '3/4',
      fieldKind: 'answer',
    });
    expect(answerRes.status).toBe('correct');
    expect(answerRes.canonical_value).toBe('3/4');

    // 2. Step field division: 450/5 matches 450 / 5
    expect(matchExpressionByForm('450/5', '450 / 5')).toBe(true);
    expect(matchExpressionByForm('450 ÷ 5', '450 / 5')).toBe(true);

    // 3. x between numerals is multiplication: 12x3 matches 12 * 3
    expect(matchExpressionByForm('12x3', '12 * 3')).toBe(true);
    expect(matchExpressionByForm('12 × 3', '12 * 3')).toBe(true);
  });

  test('Criterion 17: Pure result validates against pure result schema, relation_tags derived from error_category, cached object has no session field', async () => {
    const q = getQuestion('ratio_share_001');

    const turn = MathVerifierAgent.runTurn({
      question: q,
      input: '24', // Predicted misconception ratio_reversal
      fieldKind: 'answer',
      responseTarget: 'final',
    });
    const pure = turn.pureResult;

    const validation = validatePureResultSchema(pure);
    expect(validation.valid).toBe(true);
    expect(pure.relation_tags).toContain('swapped_ratio');

    // Cached item check
    const cache = getVerifierCache();
    expect(cache.size).toBeGreaterThan(0);
    const cachedItem = Array.from(cache.values())[0];
    expect(cachedItem).not.toHaveProperty('session_id');
    expect(cachedItem).not.toHaveProperty('hint_level');
    expect(cachedItem).not.toHaveProperty('attempt_count');
    expect(cachedItem).not.toHaveProperty('progress');
  });

  test('Criterion 18: Content validation fails item whose kind: value probe does not evaluate or equals final answer, or kind: setup probe expected_expression != target_expression', () => {
    // 1. Kind: value probe whose expected_value equals final answer
    const invalidValueProbeQ = {
      question_id: 'bad_probe_val',
      title: 'Bad Probe',
      stem: 'Stem text',
      accepted_answer_spec: {
        canonical_value: '36',
      },
      solution_steps: [{ step_id: 'step_1', target_expression: '2+3', target_value: '5' }],
      scaffold_probes: [
        {
          probe_id: 'p1',
          kind: 'value',
          min_level: 1,
          template: 'What is Maya share?',
          expected_value: '36', // Equals final answer!
          counts_as_step_id: 'step_1',
        },
      ],
    };
    const valResult1 = validateQuestion(invalidValueProbeQ);
    expect(valResult1.valid).toBe(false);
    expect(valResult1.errors.some((e) => e.includes("equals item's final answer"))).toBe(true);

    // 2. Kind: setup probe whose expected_expression != target_expression of counts_as_step_id
    const invalidSetupProbeQ = {
      question_id: 'bad_probe_setup',
      title: 'Bad Setup Probe',
      stem: 'Stem text',
      accepted_answer_spec: {
        canonical_value: '36',
      },
      solution_steps: [{ step_id: 'step_1', target_expression: '60 / 5', target_value: '12' }],
      scaffold_probes: [
        {
          probe_id: 'p2',
          kind: 'setup',
          min_level: 1,
          template: 'Write setup',
          expected_expression: '60 / 3', // Does not match step_1 target_expression 60 / 5
          counts_as_step_id: 'step_1',
        },
      ],
    };
    const valResult2 = validateQuestion(invalidSetupProbeQ);
    expect(valResult2.valid).toBe(false);
    expect(valResult2.errors.some((e) => e.includes('does not match step') && e.includes('target_expression'))).toBe(true);
  });

  test('Criterion 19: Two accepted methods / valid alternatives: submitting either returns correct', async () => {
    const questionSpec = {
      question_id: 'multi_method_q',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '12',
        valid_alternatives: ['12', '12.0', '24/2'],
      },
      alternate_solution_paths: [
        {
          path_id: 'primary',
          steps: ['step_1'],
        },
        {
          path_id: 'alt_method',
          steps: ['alt_step_1'],
        },
      ],
    };

    const res1 = verifyExpression({
      question: questionSpec,
      studentInput: '12',
      fieldKind: 'answer',
    });
    expect(res1.status).toBe('correct');

    const res2 = verifyExpression({
      question: questionSpec,
      studentInput: '24/2',
      fieldKind: 'answer',
    });
    expect(res2.status).toBe('correct');
  });

  test('Criterion 20: Rounding rule: value inside rounding rule is correct, outside is incorrect', async () => {
    const questionSpec = {
      question_id: 'q_rounding',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '3.14',
        rounding_rule: '2_decimal_places',
      },
    };

    // Inside rounding rule: 3.142 -> 3.14
    const resInside = verifyExpression({
      question: questionSpec,
      studentInput: '3.142',
      fieldKind: 'answer',
    });
    expect(resInside.status).toBe('correct');

    // Outside rounding rule: 3.19 -> 3.19 != 3.14
    const resOutside = verifyExpression({
      question: questionSpec,
      studentInput: '3.19',
      fieldKind: 'answer',
    });
    expect(resOutside.status).toBe('incorrect');
  });

  test('Criterion 21: Required unit missing returns incorrect with error_category missing_unit', async () => {
    const questionSpec = {
      question_id: 'q_req_unit',
      version: 1,
      accepted_answer_spec: {
        type: 'numeric',
        canonical_value: '15',
        unit: 'kg',
        answer_requires_unit: true,
      },
    };

    // Submits bare number without required unit
    const bareRes = verifyExpression({
      question: questionSpec,
      studentInput: '15',
      fieldKind: 'answer',
    });
    expect(bareRes.status).toBe('incorrect');
    expect(bareRes.error_category).toBe('missing_unit');
    expect(bareRes.relation_tags).toEqual(['none']);

    // Submits with required unit
    const withUnitRes = verifyExpression({
      question: questionSpec,
      studentInput: '15 kg',
      fieldKind: 'answer',
    });
    expect(withUnitRes.status).toBe('correct');
  });
});
