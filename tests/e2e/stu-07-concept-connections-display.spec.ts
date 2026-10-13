import { test, expect } from '@playwright/test';
import {
  updateLearnerModel,
  runLearnerRollup,
  buildStudentDashboard,
  validateDashboardLanguage,
  FORBIDDEN_WORDS,
  FORBIDDEN_COMPARISONS,
} from '../../lib/learner-model';
import { createSession, processSessionEvent, getStudentDashboard } from '../../lib/session-store';

test.describe('STU-07: See my progress (Student Dashboard)', () => {

  test('Criterion 4: Empty state offers first published question when no completed sessions exist', async ({ page }) => {
    // Given no completed sessions for a brand new student
    const uniqueNewStudent = `student_new_${Date.now()}`;
    await page.goto(`/dashboard?student_id=${uniqueNewStudent}`);

    // Then empty state card is displayed
    const emptyState = page.getByTestId('dashboard-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Welcome to Your Learning Journey!');

    // Offers a first published question (ratio_share_001)
    const firstQCard = page.getByTestId('first-question-card');
    await expect(firstQCard).toBeVisible();
    await expect(firstQCard).toContainText('Share $60 between Leo and Maya in the ratio 2 : 3');

    // And provides button to start first question
    const startFirstBtn = page.getByTestId('start-first-question-btn');
    await expect(startFirstBtn).toBeVisible();
    await expect(startFirstBtn).toContainText('Start First Question');
  });

  test('Criterion 1: Dashboard shows recent sessions, current skills, strengths, next focus, independent success, hint trend, transfer results, and next practice item', async ({ page }) => {
    // Given completed practice session for student_eva on the server
    const studentId = `student_eva_${Date.now()}`;

    // Create session on server
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    const { session } = await createRes.json();
    const sessionId = session.id;

    // Submit correct answer at level 0 (independent success)
    await page.request.post(`/api/sessions/${sessionId}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
        response_duration_ms: 12000,
      },
    });

    // Skip reflection to move to transfer_offered
    await page.request.post(`/api/sessions/${sessionId}/events`, {
      data: { event: 'skip' },
    });

    // Accept transfer
    const acceptRes = await page.request.post(`/api/sessions/${sessionId}/events`, {
      data: { event: 'accept' },
    });
    const acceptData = await acceptRes.json();

    // Submit correct answer to transfer question
    const transferSessionId = acceptData.linked_session_id || acceptData.session?.linked_session_id;
    if (transferSessionId) {
      await page.request.post(`/api/sessions/${transferSessionId}/events`, {
        data: {
          event: 'submit',
          answer_text: '50',
          response_duration_ms: 15000,
        },
      });
    }

    // Run hourly rollup on server
    await page.request.get(`/api/jobs/learner-rollup?student_id=${studentId}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || 'development-cron-secret-change-me'}` },
    });

    // When the student opens the dashboard
    await page.goto(`/dashboard?student_id=${studentId}`);

    // Then it shows next practice item
    const nextPracticeCard = page.getByTestId('next-practice-card');
    await expect(nextPracticeCard).toBeVisible();
    await expect(page.getByTestId('next-practice-title')).toBeVisible();
    await expect(page.getByTestId('start-next-practice-btn')).toBeVisible();

    // Then it shows independent success rate
    const independentSuccessCard = page.getByTestId('independent-success-card');
    await expect(independentSuccessCard).toBeVisible();
    await expect(page.getByTestId('independent-success-value')).toBeVisible();

    // Then it shows transfer results
    const transferCard = page.getByTestId('transfer-results-card');
    await expect(transferCard).toBeVisible();

    // Then it shows hint trend
    const hintTrendCard = page.getByTestId('hint-trend-card');
    await expect(hintTrendCard).toBeVisible();

    // Then it shows current strengths
    const strengthsSection = page.getByTestId('strengths-section');
    await expect(strengthsSection).toBeVisible();
    await expect(page.getByTestId('strengths-list')).toBeVisible();

    // Then it shows next focus areas
    const nextFocusSection = page.getByTestId('next-focus-section');
    await expect(nextFocusSection).toBeVisible();
    await expect(page.getByTestId('next-focus-list')).toBeVisible();

    // Then it shows current skills
    const skillsSection = page.getByTestId('current-skills-section');
    await expect(skillsSection).toBeVisible();
    await expect(page.getByTestId('current-skills-list')).toBeVisible();

    // Then it shows recent sessions
    const recentSessionsSection = page.getByTestId('recent-sessions-section');
    await expect(recentSessionsSection).toBeVisible();
    await expect(page.getByTestId('recent-sessions-list')).toBeVisible();
  });

  test('Criterion 2: Newly saved session is listed immediately even when hourly rollup has not run since the session', async ({ page }) => {
    const studentId = `student_rollup_${Date.now()}`;

    // 1. Rollup ran 50 minutes ago
    const fiftyMinutesAgo = new Date(Date.now() - 50 * 60 * 1000).toISOString();
    await page.request.get(`/api/jobs/learner-rollup?student_id=${studentId}&rollup_at=${fiftyMinutesAgo}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || 'development-cron-secret-change-me'}` },
    });

    // 2. Student completes a session NOW (after the rollup)
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    const { session } = await createRes.json();

    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '36',
      },
    });

    // 3. When student opens dashboard
    await page.goto(`/dashboard?student_id=${studentId}`);

    // Then the screen displays the rollup time
    const rollupTimestamp = page.getByTestId('rollup-timestamp');
    await expect(rollupTimestamp).toBeVisible();
    await expect(rollupTimestamp).toContainText('Hourly Rollup:');

    // And the saved session is still listed in recent sessions without waiting for next rollup
    const recentSessionsList = page.getByTestId('recent-sessions-list');
    await expect(recentSessionsList).toBeVisible();
    await expect(page.getByTestId('session-row')).toHaveCount(1);
    await expect(page.getByTestId('session-row')).toContainText('ratio_share_001');
  });

  test('Criterion 3: Dashboard text never says "weak", "failing", or "low ability", and never compares the student with others', async ({ page }) => {
    const studentId = `student_lang_${Date.now()}`;

    // Create session with an error and a success on the server
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    const { session } = await createRes.json();

    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '20' }, // incorrect
    });
    await page.request.post(`/api/sessions/${session.id}/events`, {
      data: { event: 'submit', answer_text: '36' }, // correct
    });

    await page.request.get(`/api/jobs/learner-rollup?student_id=${studentId}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || 'development-cron-secret-change-me'}` },
    });

    // Verify programmatically via API payload validator
    const dashboardRes = await page.request.get(`/api/me/dashboard?student_id=${studentId}`);
    const dashboardData = await dashboardRes.json();
    const validationResult = validateDashboardLanguage(dashboardData);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.violations).toHaveLength(0);

    // Verify DOM text on rendered page
    await page.goto(`/dashboard?student_id=${studentId}`);
    const bodyText = await page.innerText('body');
    const lowerBody = bodyText.toLowerCase();

    for (const forbiddenWord of FORBIDDEN_WORDS) {
      const regex = new RegExp(`\\b${forbiddenWord}\\b`, 'i');
      expect(regex.test(lowerBody)).toBe(false);
    }

    for (const comparison of FORBIDDEN_COMPARISONS) {
      expect(lowerBody.includes(comparison)).toBe(false);
    }
  });

  test('Criterion 5: Caller isolation — only that student\'s data is returned, and mastery numbers follow STU-16 rules', async () => {
    const aliceId = `alice_${Date.now()}`;
    const bobId = `bob_${Date.now()}`;

    // Student Alice completes at Level 0 (+0.15 mastery)
    const aliceSession = createSession('ratio_share_001', { student_id: aliceId });
    processSessionEvent(aliceSession.session.id, {
      event: 'submit',
      answer_text: '36', // correct at Level 0
    });

    // Student Bob makes wrong attempt first, gets hint Level 1, then succeeds (+0.05 mastery)
    const bobSession = createSession('ratio_share_001', { student_id: bobId });
    processSessionEvent(bobSession.session.id, {
      event: 'submit',
      answer_text: '20', // incorrect, level becomes 1
    });
    processSessionEvent(bobSession.session.id, {
      event: 'submit',
      answer_text: '36', // correct after hint
    });

    // 1. Verify Alice's dashboard: contains ONLY Alice's sessions
    const aliceDashboard = getStudentDashboard(aliceId);
    expect(aliceDashboard.student_id).toBe(aliceId);
    expect(aliceDashboard.recent_sessions).toHaveLength(1);
    expect(aliceDashboard.recent_sessions[0].session_id).toBe(aliceSession.session.id);
    expect(aliceDashboard.recent_sessions.some((s) => s.session_id === bobSession.session.id)).toBe(false);

    // Alice's mastery estimate increased by 0.15
    const aliceSkill = aliceDashboard.current_skills.find((s) => s.skill_id === 'ratio_sharing' || s.skill_id === 'ratio.sharing');
    expect(aliceSkill?.mastery_estimate).toBe(0.15);

    // 2. Verify Bob's dashboard: contains ONLY Bob's sessions
    const bobDashboard = getStudentDashboard(bobId);
    expect(bobDashboard.student_id).toBe(bobId);
    expect(bobDashboard.recent_sessions).toHaveLength(1);
    expect(bobDashboard.recent_sessions[0].session_id).toBe(bobSession.session.id);
    expect(bobDashboard.recent_sessions.some((s) => s.session_id === aliceSession.session.id)).toBe(false);

    // Bob's mastery estimate increased by 0.05
    const bobSkill = bobDashboard.current_skills.find((s) => s.skill_id === 'ratio_sharing' || s.skill_id === 'ratio.sharing');
    expect(bobSkill?.mastery_estimate).toBe(0.05);
  });

  test('STU-16 Mastery & Confidence rules: Transfer raises confidence (+0.20), conflict reduces confidence (-0.10)', async () => {
    const studentId = `student_mastery_rules_${Date.now()}`;

    // Turn 1: Level 0 correct -> mastery +0.15
    const s1 = updateLearnerModel(studentId, 'ratio_sharing', {
      is_correct: true,
      hint_level: 0,
      is_transfer: false,
    });
    expect(s1.mastery_estimate).toBe(0.15);
    expect(s1.mastery_confidence).toBe(0.0);

    // Turn 2: Transfer question correct -> confidence +0.20
    const s2 = updateLearnerModel(studentId, 'ratio_sharing', {
      is_correct: true,
      hint_level: 0,
      is_transfer: true,
      transfer_outcome: 'correct',
    });
    expect(s2.mastery_estimate).toBe(0.30);
    expect(s2.mastery_confidence).toBe(0.20);

    // Turn 3: Incorrect attempt on skill -> Conflict rule triggers among last 3 attempts -> confidence -0.10
    const s3 = updateLearnerModel(studentId, 'ratio_sharing', {
      is_correct: false,
      hint_level: 1,
      is_transfer: false,
    });
    expect(s3.mastery_confidence).toBe(0.10);
  });

});
