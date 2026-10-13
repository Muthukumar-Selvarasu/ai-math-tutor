import { test, expect } from '@playwright/test';
import {
  getApprovedPublishedQuestion,
  listApprovedPublishedQuestions,
  isQuestionApprovedAndPublished,
  recommendNextQuestion,
} from '../../lib/practice-planner';
import {
  getReviewItems,
  makeReviewDecision,
  makeDiagramDecision,
  resetContentReviewStore,
} from '../../lib/content-review-store';
import { validateQuestion, validateContentBank } from '../../lib/content-validator';
import { getQuestion } from '../../lib/question-loader';
import { resetAuthStore, registerAppUser } from '../../lib/auth';

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key_primary' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock_signature_bytes';
  return `${header}.${body}.${signature}`;
}

test.describe('ADM-04: Content publishing controls', () => {
  let adminToken;
  let reviewerToken;
  let teacherToken;
  let studentToken;

  test.beforeEach(async ({ page }) => {
    resetAuthStore();
    resetContentReviewStore();

    adminToken = makeMockJwt({
      sub: 'user_2test_adm_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Provision content reviewer via admin API
    await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_content_reviewer_01',
        role: 'content_reviewer',
        display_label: 'Content Reviewer Alpha',
      },
    });

    reviewerToken = makeMockJwt({
      sub: 'user_clerk_content_reviewer_01',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    teacherToken = makeMockJwt({
      sub: 'user_2test_tch_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    studentToken = makeMockJwt({
      sub: 'user_2test_stu_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Ensure ratio_share_001 is approved on WebServer before each test
    await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { decision: 'approved', note: 'Pre-flight ensure approved' },
    });
  });

  test.afterAll(async ({ request }) => {
    // Safety net: Ensure ratio_share_001 is restored to approved on the web server
    const token = makeMockJwt({
      sub: 'user_2test_adm_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${token}` },
      data: { decision: 'approved', note: 'Restored by afterAll hook' },
    });
  });

  test('Criterion 1: Draft, rejected, deprecated, flagged, or pending questions are NEVER served to students', async ({ page }) => {
    // 1. Check an approved question is served
    const approvedRes = await page.request.get('/api/questions/ratio_share_001');
    expect(approvedRes.status()).toBe(200);

    // 2. Reject the question via review decision API
    const rejectRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'rejected', note: 'Found calculation flaw during audit' },
    });
    expect(rejectRes.status()).toBe(200);

    // 3. Rejected question is now blocked from student retrieval: returns 404
    const blockedRes = await page.request.get('/api/questions/ratio_share_001');
    expect(blockedRes.status()).toBe(404);

    // Starting a session on rejected question is also rejected with 404
    const sessRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    expect(sessRes.status()).toBe(404);

    // 4. Deprecate the question via review decision API
    const deprecateRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'deprecated', note: 'Replaced by newer syllabus item' },
    });
    expect(deprecateRes.status()).toBe(200);

    const deprecatedGetRes = await page.request.get('/api/questions/ratio_share_001');
    expect(deprecatedGetRes.status()).toBe(404);

    // 5. Test flagged item is never served
    const flaggedQ = {
      question_id: 'q_flagged_test',
      validation_status: 'approved',
      publication_status: 'published',
      flagged: true,
    };
    expect(isQuestionApprovedAndPublished(flaggedQ)).toBe(false);

    // 6. Test pending/draft item is never served
    const pendingQ = {
      question_id: 'q_pending_test',
      validation_status: 'pending',
      publication_status: 'draft',
      flagged: false,
    };
    expect(isQuestionApprovedAndPublished(pendingQ)).toBe(false);

    // 7. Restore ratio_share_001 to approved so subsequent practice tests are unaffected
    const restoreRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'approved', note: 'Restored approved status' },
    });
    expect(restoreRes.status()).toBe(200);
    const restoredGetRes = await page.request.get('/api/questions/ratio_share_001');
    expect(restoredGetRes.status()).toBe(200);
  });

  test('Criterion 2: Served question records have all required FR-02 fields populated and verified', async ({ page }) => {
    const res = await page.request.get('/api/questions/ratio_simp_001');
    expect(res.status()).toBe(200);
    const q = await res.json();

    // Verification of FR-02 fields
    expect(q.question_id).toBe('ratio_simp_001');
    expect(q.version).toBeDefined();
    expect(q.validation_status).toBe('approved');
    expect(q.publication_status).toBe('published');
    expect(q.skill_id).toBeDefined();
    expect(q.difficulty).toBeDefined();
    expect(q.stem).toBeDefined();
    expect(q.curriculum).toBeDefined();
    expect(q.solution_steps).toBeDefined();
    expect(q.accepted_answer_spec).toBeDefined();
    expect(q.scaffold_probes || q.probes).toBeDefined();
    expect(q.has_diagram !== undefined).toBe(true);
  });

  test('Criterion 3: Unapproved diagrams are not served; reviewer can approve or reject diagram', async ({ page }) => {
    // 1. Initial unapproved diagram state
    const diagQ = {
      question_id: 'q_diag_test',
      has_diagram: true,
      diagram_id: 'diag_unapproved',
      validation_status: 'approved',
      publication_status: 'published',
    };
    expect(isQuestionApprovedAndPublished(diagQ)).toBe(false);

    // 2. Reviewer approves diagram via API
    const approveDiagRes = await page.request.post('/api/content/diagrams/diag_unapproved/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'approved', note: 'Diagram verified accurate and safe' },
    });
    expect(approveDiagRes.status()).toBe(200);

    // Question is now approved and eligible (in-engine check with override)
    makeDiagramDecision('diag_unapproved', { decision: 'approved' });
    expect(isQuestionApprovedAndPublished(diagQ)).toBe(true);

    // 3. Reviewer rejects diagram
    const rejectDiagRes = await page.request.post('/api/content/diagrams/diag_unapproved/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'rejected', note: 'Diagram text leaked values' },
    });
    expect(rejectDiagRes.status()).toBe(200);

    makeDiagramDecision('diag_unapproved', { decision: 'rejected' });
    expect(isQuestionApprovedAndPublished(diagQ)).toBe(false);
  });

  test('Criterion 4: Practice planner recommendations exclude unapproved and unreviewed items', () => {
    const approvedList = listApprovedPublishedQuestions();
    expect(approvedList.length).toBeGreaterThanOrEqual(10);

    // Every item in approved list must pass isQuestionApprovedAndPublished
    for (const item of approvedList) {
      const full = getQuestion(item.question_id);
      expect(isQuestionApprovedAndPublished(full)).toBe(true);
      expect(full.validation_status).toBe('approved');
      expect(full.publication_status).toBe('published');
      expect(full.flagged).toBeFalsy();
    }
  });

  test('Criterion 5: Failing offline validation blocks approval with 409 transition_not_allowed; teachers cannot make review decisions', async ({ page }) => {
    // 1. Attempting to approve an invalid question that fails offline validation returns 409
    // ratio_diagram_withheld_001 is a test item that is draft / unapproved
    const invalidDecisionRes = await page.request.post('/api/content/review-items/ratio_diagram_withheld_001/decision', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { decision: 'approved' },
    });
    // Should be rejected with 409 transition_not_allowed because it has validation errors or withheld diagram
    expect(invalidDecisionRes.status()).toBe(409);
    const errBody = await invalidDecisionRes.json();
    expect(errBody.error).toBe('transition_not_allowed');

    // 2. Teacher attempting review decision receives 403 forbidden
    const teacherDecisionRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { decision: 'rejected' },
    });
    expect(teacherDecisionRes.status()).toBe(403);

    // 3. Teacher reading review items (read-only) succeeds
    const teacherReadRes = await page.request.get('/api/content/review-items', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(teacherReadRes.status()).toBe(200);
    const readBody = await teacherReadRes.json();
    expect(readBody.items.length).toBeGreaterThanOrEqual(10);
  });

  test('Criterion 6: Approved bank has at least 10 Release 1.0 items, every approved item has a legal transfer partner', () => {
    const bankReport = validateContentBank();
    expect(bankReport.valid).toBe(true);
    expect(bankReport.approved_questions).toBeGreaterThanOrEqual(10);
  });
});
