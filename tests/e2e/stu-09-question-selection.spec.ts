import { test, expect } from '@playwright/test';
import {
  recommendNextQuestion,
  listApprovedPublishedQuestions,
  getApprovedPublishedQuestion,
  isQuestionApprovedAndPublished,
  SKILL_GRAPH_EDGES,
} from '../../lib/practice-planner';
import { getAuditEvents, resetSessionStore } from '../../lib/session-store';

test.describe('STU-09: Select or receive a recommended question', () => {

  test.beforeEach(() => {
    // Reset session store between tests for clean test isolation
    resetSessionStore();
  });

  test('Criterion 1: Given signed in, when opening practice, can choose a published question or start the recommended next item', async ({
    page,
    request,
  }) => {
    // 1. Practice screen loads with Question Selection & Recommendation bar
    await page.goto('/practice');

    const selectionBar = page.getByTestId('question-selection-bar');
    await expect(selectionBar).toBeVisible();

    const questionSelect = page.getByTestId('question-select');
    await expect(questionSelect).toBeVisible();

    // Verify published questions are in the dropdown
    const selectOptions = await questionSelect.locator('option').allTextContents();
    expect(selectOptions.some((opt) => opt.includes('Simplifying 18:24'))).toBe(true);
    expect(selectOptions.some((opt) => opt.includes('Sharing $60 in 2:3'))).toBe(true);

    // 2. Choose a published question (ratio_simp_001)
    await questionSelect.selectOption('ratio_simp_001');
    const startSelectedBtn = page.getByTestId('start-selected-btn');
    await startSelectedBtn.click();

    // Verify selected question loads properly
    const stemCard = page.getByTestId('problem-stem');
    await expect(stemCard).toContainText('Simplify the ratio 18 : 24 to its simplest form.');

    // 3. Start recommended next item
    const startRecommendedBtn = page.getByTestId('start-recommended-btn');
    await expect(startRecommendedBtn).toBeVisible();
    await startRecommendedBtn.click();

    // Verify session started with recommended badge
    const recommendedBadge = page.getByTestId('recommended-badge');
    await expect(recommendedBadge).toBeVisible();
    await expect(recommendedBadge).toContainText('Recommended Next');
  });

  test('Criterion 2: Given a question is not approved and published, when requested, then it is not delivered (404 and filtered out)', async ({
    page,
    request,
  }) => {
    // 1. Question bank filter: GET /api/questions excludes unapproved draft questions and unapproved diagram questions
    const listRes = await request.get('/api/questions');
    expect(listRes.status()).toBe(200);
    const publishedList = await listRes.json();

    const ids = publishedList.map((q: any) => q.question_id);
    expect(ids).not.toContain('ratio_draft_001'); // Draft question excluded
    expect(ids).not.toContain('ratio_diagram_withheld_001'); // Unapproved diagram variant excluded
    expect(ids).toContain('ratio_share_001');
    expect(ids).toContain('ratio_simp_001');

    // 2. GET /api/questions/:id returns 404 for unapproved draft question
    const getDraftRes = await request.get('/api/questions/ratio_draft_001');
    expect(getDraftRes.status()).toBe(404);

    // 3. POST /api/sessions with unapproved question returns 404 (zero unapproved questions delivered)
    const postDraftRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_draft_001', student_id: 'stu_unapproved_test' },
    });
    expect(postDraftRes.status()).toBe(404);

    // 4. POST /api/sessions with non-existent question returns 404
    const postUnknownRes = await request.post('/api/sessions', {
      data: { question_id: 'non_existent_question_999', student_id: 'stu_unapproved_test' },
    });
    expect(postUnknownRes.status()).toBe(404);

    // 5. In the UI, requesting an unapproved question shows not-delivered alert and does NOT deliver stem
    await page.goto('/practice?question_id=ratio_draft_001');
    const notDeliveredAlert = page.getByTestId('question-not-delivered-alert');
    await expect(notDeliveredAlert).toBeVisible();
    await expect(notDeliveredAlert).toContainText('Question Not Delivered');
    await expect(page.getByTestId('question-error')).toContainText('not approved and published');

    // Stem and input must NOT be delivered
    await expect(page.getByTestId('question-card')).not.toBeVisible();
    await expect(page.getByTestId('answer-input')).not.toBeVisible();
  });

  test('Criterion 3: Given no history, when a recommendation is made, then it is an approved starting item and does not require an untaught skill', async ({
    request,
  }) => {
    const studentNew = `student_fresh_${Date.now()}`;

    // POST /api/sessions with recommended: true and no history
    const res = await request.post('/api/sessions', {
      data: { recommended: true, student_id: studentNew },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();

    // Verify session attributes
    expect(data.session.recommended).toBe(true);
    expect(data.session.state).toBe('awaiting_first_attempt');
    expect(data.session.hint_level).toBe(0);

    // Starting item must belong to foundational starting skill with 0 prerequisites (ratio_simplifying)
    expect(data.question.question_id).toBe('ratio_simp_001');
    expect(data.session.recommendation?.edge_type).toBe('starting_item');

    // Verify question_selection audit event is logged in response (SPEC WF-02)
    expect(data.audit_event).toBeDefined();
    expect(data.audit_event.event_type).toBe('question_selection');
    expect(data.audit_event.recommended).toBe(true);
    expect(data.audit_event.edge_type).toBe('starting_item');
  });

  test('Criterion 4: Given history, when a recommendation is made, then the Practice Planner chooses along a skill-graph remediates or prerequisite edge', async ({
    request,
  }) => {
    // -------------------------------------------------------------
    // Test 4A: Remediates Edge (Student exhibits a misconception)
    // -------------------------------------------------------------
    const studentRemediation = `student_remed_${Date.now()}`;

    // Create session on ratio_share_001
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentRemediation },
    });
    const { session } = await createRes.json();

    // Submit answer 57 -> triggers misconception 'ratio_additive_interpretation'
    const submitRes = await request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '57',
        response_duration_ms: 10000,
      },
    });

    // Request recommendation for this student
    const recRes = await request.post('/api/sessions', {
      data: { recommended: true, student_id: studentRemediation },
    });
    expect(recRes.status()).toBe(201);
    const recData = await recRes.json();

    // Practice Planner follows the 'remediates' edge from ratio_additive_interpretation to ratio_simp_001
    expect(recData.session.recommended).toBe(true);
    expect(recData.question.question_id).toBe('ratio_simp_001');
    expect(recData.session.recommendation?.edge_type).toBe('remediates');
    expect(recData.session.recommendation?.misconception_code).toBe('ratio_additive_interpretation');

    // -------------------------------------------------------------
    // Test 4B: Prerequisite Edge (Backward - Student struggles on current skill)
    // -------------------------------------------------------------
    const studentStruggling = `student_struggle_${Date.now()}`;

    // Create session on ratio_share_001
    const struggleSessRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentStruggling },
    });
    const struggleSession = (await struggleSessRes.json()).session;

    // Struggle with consecutive unsuccessful attempts
    await request.post(`/api/sessions/${struggleSession.id}/events`, {
      data: { event: 'submit', answer_text: '10' },
    });
    await request.post(`/api/sessions/${struggleSession.id}/events`, {
      data: { event: 'submit', answer_text: '13' },
    });

    // Request recommendation for struggling student
    const recStruggleRes = await request.post('/api/sessions', {
      data: { recommended: true, student_id: studentStruggling },
    });
    expect(recStruggleRes.status()).toBe(201);
    const recStruggleData = await recStruggleRes.json();

    // Practice Planner follows prerequisite edge BACKWARD from ratio_sharing to ratio_simplifying
    expect(recStruggleData.session.recommendation?.edge_type).toBe('prerequisite_backward');
    expect(recStruggleData.question.skill_id).toBe('ratio_simplifying');

    // -------------------------------------------------------------
    // Test 4C: Prerequisite Edge (Forward - Student masters foundational skill)
    // -------------------------------------------------------------
    const studentMastered = `student_master_${Date.now()}`;

    // Create and complete ratio_simp_001 successfully
    const simpSessRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_simp_001', student_id: studentMastered },
    });
    const simpSession = (await simpSessRes.json()).session;

    // Submit correct answer '3:4' at level 0
    await request.post(`/api/sessions/${simpSession.id}/events`, {
      data: { event: 'submit', answer_text: '3:4' },
    });

    // Request recommendation for mastered student
    const recMasterRes = await request.post('/api/sessions', {
      data: { recommended: true, student_id: studentMastered },
    });
    expect(recMasterRes.status()).toBe(201);
    const recMasterData = await recMasterRes.json();

    // Practice Planner advances along prerequisite edge FORWARD to ratio_sharing
    expect(recMasterData.session.recommendation?.edge_type).toBe('prerequisite_forward');
    expect(recMasterData.question.skill_id).toBe('ratio_sharing');

    // -------------------------------------------------------------
    // Test 4D: Deterministic Guarantee (Repeatability without vector similarity)
    // -------------------------------------------------------------
    const mockSessions = [
      {
        student_id: 'stu_det_test',
        state: 'completed',
        question_id: 'ratio_simp_001',
        attempts: [{ verdict: 'correct', hint_level: 0 }],
      },
    ];
    const rec1 = recommendNextQuestion('stu_det_test', { sessions: mockSessions });
    const rec2 = recommendNextQuestion('stu_det_test', { sessions: mockSessions });
    expect(rec1?.question_id).toBe('ratio_share_001');
    expect(rec1?.edge_type).toBe('prerequisite_forward');
    expect(rec1?.question_id).toBe(rec2?.question_id);
    expect(rec1?.edge_type).toBe(rec2?.edge_type);
  });
});
