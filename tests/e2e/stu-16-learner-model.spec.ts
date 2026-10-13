import { test, expect } from '@playwright/test';
import {
  updateLearnerModel,
  getOrCreateSkillState,
  getSkillState,
  getAllSkillStatesForStudent,
  runLearnerRollup,
  buildStudentDashboard,
  validateDashboardLanguage,
  resetLearnerStore,
  FORBIDDEN_WORDS,
  FORBIDDEN_COMPARISONS,
} from '../../lib/learner-model';
import { recommendNextQuestion } from '../../lib/practice-planner';

test.describe('STU-16: Update the learner model on the turn', () => {

  test.beforeEach(() => {
    resetLearnerStore();
  });

  test('Criterion 1: Counted success at hint level 0 increases mastery by 0.15 (capped at 1.0)', async () => {
    const studentId = `stu_l0_${Date.now()}`;
    const skillId = 'ratio_sharing';

    // 1st success at Level 0
    const state1 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    expect(state1.mastery_estimate).toBe(0.15);

    // 2nd success at Level 0
    const state2 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    expect(state2.mastery_estimate).toBe(0.30);

    // Simulate multiple successes up to and past 1.0 cap
    for (let i = 0; i < 6; i++) {
      updateLearnerModel(studentId, skillId, {
        is_correct: true,
        hint_level: 0,
        is_counted: true,
      });
    }
    const finalState = getSkillState(studentId, skillId);
    expect(finalState.mastery_estimate).toBeLessThanOrEqual(1.0);
    expect(finalState.mastery_estimate).toBe(1.0);
  });

  test('Criterion 2: Counted success after hint level 1, 2, or 3 increases mastery by 0.05', async () => {
    const studentId = `stu_l123_${Date.now()}`;
    const skillId = 'ratio_sharing';

    // Level 1 success
    const s1 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 1,
      is_counted: true,
    });
    expect(s1.mastery_estimate).toBe(0.05);

    // Level 2 success
    const s2 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 2,
      is_counted: true,
    });
    expect(s2.mastery_estimate).toBe(0.10);

    // Level 3 success
    const s3 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 3,
      is_counted: true,
    });
    expect(s3.mastery_estimate).toBe(0.15);
  });

  test('Criterion 3: Completion only at hint level 4 or 5 does not increase mastery', async () => {
    const studentId = `stu_l45_${Date.now()}`;
    const skillId = 'ratio_sharing';

    // Initial state has mastery 0.20 from prior success
    updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 1,
      is_counted: true,
    });
    updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    const baseline = getSkillState(studentId, skillId).mastery_estimate;
    expect(baseline).toBe(0.20);

    // Completion at Level 4
    const sLevel4 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 4,
      is_counted: true,
    });
    expect(sLevel4.mastery_estimate).toBe(0.20);

    // Completion at Level 5
    const sLevel5 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 5,
      is_counted: true,
    });
    expect(sLevel5.mastery_estimate).toBe(0.20);
  });

  test('Criterion 4: Successful transfer raises confidence by +0.20 (capped at 1.0); without one, confidence is not increased', async () => {
    const studentId = `stu_trans_${Date.now()}`;
    const skillId = 'ratio_sharing';

    // Non-transfer success: mastery increases, confidence does not increase
    const sNonTransfer = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_transfer: false,
      is_counted: true,
    });
    expect(sNonTransfer.mastery_confidence).toBe(0.0);

    // Successful transfer: confidence increases by +0.20
    const sTransfer1 = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_transfer: true,
      transfer_outcome: 'correct',
      is_counted: true,
    });
    expect(sTransfer1.mastery_confidence).toBe(0.20);

    // Failed transfer: confidence not increased
    const sTransferFail = updateLearnerModel(studentId, skillId, {
      is_correct: false,
      hint_level: 2,
      is_transfer: true,
      transfer_outcome: 'incorrect',
      is_counted: true,
    });
    // Note: conflict check will also evaluate
    expect(sTransferFail.mastery_confidence).toBe(0.10); // 0.20 - 0.10 conflict penalty

    // Reach confidence 1.0 cap with multiple successful transfers
    for (let i = 0; i < 6; i++) {
      updateLearnerModel(studentId, skillId, {
        is_correct: true,
        hint_level: 0,
        is_transfer: true,
        transfer_outcome: 'correct',
        is_counted: true,
      });
    }
    const finalState = getSkillState(studentId, skillId);
    expect(finalState.mastery_confidence).toBeLessThanOrEqual(1.0);
    expect(finalState.mastery_confidence).toBe(1.0);
  });

  test('Criterion 5: Conflict rule — last 3 counted attempts conflict reduces confidence by -0.10 (floor 0)', async () => {
    const studentId = `stu_conf_${Date.now()}`;
    const skillId = 'ratio_sharing';

    // Build initial confidence with 2 successful transfers
    updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_transfer: true,
      transfer_outcome: 'correct',
      is_counted: true,
    });
    updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_transfer: true,
      transfer_outcome: 'correct',
      is_counted: true,
    });
    // Currently 2 correct attempts: confidence = 0.40
    let state = getSkillState(studentId, skillId);
    expect(state.mastery_confidence).toBe(0.40);

    // 3rd attempt is incorrect -> last 3 attempts: [correct, correct, incorrect] -> CONFLICT!
    state = updateLearnerModel(studentId, skillId, {
      is_correct: false,
      hint_level: 1,
      is_counted: true,
    });
    // Confidence decreased by 0.10 -> 0.30
    expect(state.mastery_confidence).toBe(0.30);

    // 4th attempt is incorrect -> last 3 attempts: [correct, incorrect, incorrect] -> CONFLICT!
    state = updateLearnerModel(studentId, skillId, {
      is_correct: false,
      hint_level: 2,
      is_counted: true,
    });
    // Confidence decreased by 0.10 -> 0.20
    expect(state.mastery_confidence).toBe(0.20);

    // 5th attempt is incorrect -> last 3 attempts: [incorrect, incorrect, incorrect] -> NO CONFLICT!
    state = updateLearnerModel(studentId, skillId, {
      is_correct: false,
      hint_level: 2,
      is_counted: true,
    });
    // No decrease
    expect(state.mastery_confidence).toBe(0.20);

    // Repeated conflicts down to floor 0
    state = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    expect(state.mastery_confidence).toBe(0.10);

    state = updateLearnerModel(studentId, skillId, {
      is_correct: false,
      hint_level: 1,
      is_counted: true,
    });
    expect(state.mastery_confidence).toBe(0.0);

    // Further conflict does not drop below 0
    state = updateLearnerModel(studentId, skillId, {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    expect(state.mastery_confidence).toBe(0.0);
  });

  test('Criterion 6: Next practice item uses this turn write immediately; cohort aggregates may stay up to one hour old', async ({ page }) => {
    const studentId = `stu_persist_${Date.now()}`;

    // 1. Create a session via API
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    expect(createRes.status()).toBe(201);
    const { session } = await createRes.json();
    const sessionId = session.id;

    // 2. Submit correct answer at level 0
    const eventRes = await page.request.post(`/api/sessions/${sessionId}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
        response_duration_ms: 10000,
      },
    });
    expect(eventRes.status()).toBe(200);
    const turnData = await eventRes.json();

    // Verify session response contains updated mastery from this turn write
    expect(turnData.session.mastery_estimate).toBeGreaterThanOrEqual(0.15);

    // 3. Request next practice item immediately - uses this write without waiting for hourly rollup
    const nextRes = await page.request.post('/api/sessions', {
      data: {
        student_id: studentId,
        recommended: true,
      },
    });
    expect(nextRes.status()).toBe(201);
    const nextData = await nextRes.json();
    expect(nextData.session.question_id).toBeTruthy();

    // 4. Verify server dashboard reflects the immediate write
    const dashRes = await page.request.get(`/api/me/dashboard?student_id=${studentId}`);
    expect(dashRes.status()).toBe(200);
    const serverDashboard = await dashRes.json();
    const serverSkill = serverDashboard.current_skills.find(
      (s) => s.skill_id === 'ratio_sharing' || s.skill_id === 'ratio.sharing'
    );
    expect(serverSkill).toBeDefined();
    expect(serverSkill.mastery_estimate).toBeGreaterThanOrEqual(0.15);

    // 5. In-process validation: rollup timestamp behavior (can stay up to one hour old)
    const localStudent = `local_${studentId}`;
    updateLearnerModel(localStudent, 'ratio_sharing', {
      is_correct: true,
      hint_level: 0,
      is_counted: true,
    });
    const pastOneHour = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const rollupTime = runLearnerRollup(localStudent, [], { rollup_at: pastOneHour });
    expect(rollupTime).toBe(pastOneHour);

    const localDashboard = buildStudentDashboard(localStudent, [], { rollup_at: pastOneHour });
    expect(localDashboard.rollup_at).toBe(pastOneHour);
  });

  test('Language and Invariant: Progress language is encouraging and non-shaming', () => {
    const testDashboard = {
      skills: [
        { name: 'Ratio', status: 'Practising', summary: 'Good effort and active participation' },
        { name: 'Fractions', status: 'Exploring', summary: 'Building foundational steps' },
      ],
      next_focus: [
        { summary: 'Continue practising ratio problems to build fluency' },
      ],
    };

    const check = validateDashboardLanguage(testDashboard);
    expect(check.valid).toBe(true);

    // Verify forbidden words trigger detection
    for (const forbidden of FORBIDDEN_WORDS) {
      const badDashboard = { text: `The student is ${forbidden}` };
      const badCheck = validateDashboardLanguage(badDashboard);
      expect(badCheck.valid).toBe(false);
      expect(badCheck.violations.some((v) => v.type === 'forbidden_word')).toBe(true);
    }

    // Verify forbidden comparisons trigger detection
    for (const comp of FORBIDDEN_COMPARISONS) {
      const badDashboard = { text: `Student is ${comp}` };
      const badCheck = validateDashboardLanguage(badDashboard);
      expect(badCheck.valid).toBe(false);
      expect(badCheck.violations.some((v) => v.type === 'forbidden_comparison')).toBe(true);
    }
  });
});
