import { test, expect } from '@playwright/test';

test.describe('EDU-06: Review content quality', () => {
  const reviewerToken = JSON.stringify({
    sub: 'user_2test_con_001',
    role: 'content_reviewer',
  });

  const teacherToken = JSON.stringify({
    sub: 'user_2test_tch_001',
    role: 'teacher',
  });

  const studentToken = JSON.stringify({
    sub: 'user_2test_stu_001',
    role: 'student',
  });

  const reviewerHeader = {
    Authorization: `Bearer ${reviewerToken}`,
    'Content-Type': 'application/json',
  };

  const teacherHeader = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  const studentHeader = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  test('Criterion 1: Flagged items in review queue display reason and supporting evidence', async ({ page }) => {
    // 1. Flag an item with quality scan reasons (e.g. answer_key_inconsistency, ambiguous_wording, verifier_failure)
    const flagPayload = {
      reason: 'answer-key inconsistency',
      evidence: {
        detected_discrepancy: 'Answer key states 18 but step-by-step ratio solution yields 24',
        verifier_trace: 'SymPy expression comparison failed on step 3',
        reported_at: '2026-10-13T20:00:00Z',
      },
    };

    const flagRes = await page.request.post('/api/content/review-items/ratio_share_001/flag', {
      headers: reviewerHeader,
      data: flagPayload,
    });
    expect(flagRes.status()).toBe(200);

    // 2. Fetch the review queue and check item details
    const queueRes = await page.request.get('/api/content/review-items', {
      headers: reviewerHeader,
    });
    expect(queueRes.status()).toBe(200);
    const { items } = await queueRes.json();

    const flaggedItem = items.find((it) => it.id === 'ratio_share_001');
    expect(flaggedItem).toBeTruthy();
    expect(flaggedItem.flagged).toBe(true);
    expect(flaggedItem.flag_reason).toBe('answer-key inconsistency');
    expect(flaggedItem.evidence.detected_discrepancy).toContain('Answer key states 18');
  });

  test('Criterion 2: Teacher can read review items but cannot approve, reject, or deprecate', async ({ page }) => {
    // 1. Teacher can GET review items (read-only)
    const readRes = await page.request.get('/api/content/review-items', {
      headers: teacherHeader,
    });
    expect(readRes.status()).toBe(200);
    const { items } = await readRes.json();
    expect(Array.isArray(items)).toBe(true);

    // 2. Teacher cannot make review decision (403 forbidden)
    const decisionRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: teacherHeader,
      data: {
        decision: 'approved',
        note: 'Teacher attempting to approve content',
      },
    });
    expect(decisionRes.status()).toBe(403);
    const errBody = await decisionRes.json();
    expect(errBody.error).toBe('forbidden');

    // 3. Teacher cannot edit item (403 forbidden)
    const editRes = await page.request.put('/api/content/review-items/ratio_share_001', {
      headers: teacherHeader,
      data: {
        title: 'Teacher edited title',
      },
    });
    expect(editRes.status()).toBe(403);
  });

  test('Criterion 3: Content reviewer approves, rejects, or deprecates item; decision & publication status stored', async ({ page }) => {
    // 1. Content reviewer rejects item
    const rejectRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: {
        decision: 'rejected',
        note: 'Ambiguous question stem needs clarification before release',
      },
    });
    expect(rejectRes.status()).toBe(200);
    const rejectedBody = await rejectRes.json();
    expect(rejectedBody.item.validation_status).toBe('rejected');
    expect(rejectedBody.item.publication_status).toBe('draft');

    // 2. Content reviewer deprecates item
    const deprecateRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: {
        decision: 'deprecated',
        note: 'Superseded by updated ratio problem bank',
      },
    });
    expect(deprecateRes.status()).toBe(200);
    const depBody = await deprecateRes.json();
    expect(depBody.item.validation_status).toBe('deprecated');
    expect(depBody.item.publication_status).toBe('archived');

    // 3. Re-approve validated item
    const approveRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: {
        decision: 'approved',
        note: 'Offline validation passed; approved for practice',
      },
    });
    expect(approveRes.status()).toBe(200);
    const approvedBody = await approveRes.json();
    expect(approvedBody.item.validation_status).toBe('approved');
    expect(approvedBody.item.publication_status).toBe('published');
  });

  test('Criterion 4: Flagged items are never served to students', async ({ page }) => {
    // 1. Ensure item is flagged
    await page.request.post('/api/content/review-items/ratio_share_001/flag', {
      headers: reviewerHeader,
      data: {
        reason: 'excessive student confusion',
        evidence: {
          repeated_hint_escalation_rate: 0.85,
          sample_size: 20,
        },
      },
    });

    // 2. Student attempts to start session on the flagged item
    const studentSessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
      },
    });
    // Withheld / not served
    expect(studentSessionRes.status()).toBe(404);
    const err = await studentSessionRes.json();
    const errorMsg = err.error?.message || err.message || JSON.stringify(err);
    expect(errorMsg).toContain('not approved and published');

    // 3. Unflag/approve item again
    const restoreRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: {
        decision: 'approved',
        note: 'Issue reviewed and confirmed sound',
      },
    });
    expect(restoreRes.status()).toBe(200);

    // 4. Student can now access the approved question
    const successSessionRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
      },
    });
    expect([200, 201]).toContain(successSessionRes.status());
  });

  test('Criterion 5: Edited items reset to draft and cannot be published without new approval', async ({ page }) => {
    // 1. Ensure item is approved and published
    await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: { decision: 'approved', note: 'Baseline approved' },
    });

    // 2. Edit the question (e.g. updating stem or title)
    const editRes = await page.request.put('/api/content/review-items/ratio_share_001', {
      headers: reviewerHeader,
      data: {
        title: 'Ratio Sharing: Revised Problem Formulation',
      },
    });
    expect(editRes.status()).toBe(200);
    const { item: editedItem } = await editRes.json();

    // Invariant: status is reset to draft
    expect(editedItem.publication_status).toBe('draft');
    expect(editedItem.validation_status).toBe('draft');

    // 3. Student cannot access edited unapproved item
    const studentRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
      },
    });
    expect(studentRes.status()).toBe(404);

    // 4. Must receive new approval to be published again
    const reapproveRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: reviewerHeader,
      data: {
        decision: 'approved',
        note: 'Reviewed edits; re-approving for student delivery',
      },
    });
    expect(reapproveRes.status()).toBe(200);
    const reapproved = await reapproveRes.json();
    expect(reapproved.item.publication_status).toBe('published');
    expect(reapproved.item.validation_status).toBe('approved');

    // 5. Student can now access it again
    const restoredRes = await page.request.post('/api/sessions', {
      headers: studentHeader,
      data: {
        question_id: 'ratio_share_001',
        student_id: 'user_internal_stu_001',
      },
    });
    expect([200, 201]).toContain(restoredRes.status());
  });
});
