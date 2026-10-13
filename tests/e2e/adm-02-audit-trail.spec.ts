import { test, expect } from '@playwright/test';
import {
  logAuditEvent,
  queryAuditEvents,
  getAllAuditEvents,
  updateAuditEvent,
  deleteAuditEvent,
  resetAuditStore,
} from '../../lib/audit-trail';
import { resetAuthStore } from '../../lib/auth';

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key_primary' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock_signature_bytes';
  return `${header}.${body}.${signature}`;
}

test.describe('ADM-02: Audit trail', () => {
  let adminToken;
  let teacherToken;
  let studentToken;

  test.beforeEach(async () => {
    resetAuthStore();
    resetAuditStore();

    adminToken = makeMockJwt({
      sub: 'user_2test_adm_001',
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
  });

  test('Criterion 1: Comprehensive audit events are created with IDs, hashes, and structured fields; no student free text, full prompt, or raw model output leaks; configuration changes store previous and new values', async ({ page }) => {
    // 1. In-engine verification: Configuration change stores previous and new values
    const configEvent = logAuditEvent({
      event_type: 'cohort_allow_level_5_changed',
      actor_user_id: 'user_2test_adm_001',
      cohort_id: 'cohort_year7_maths',
      previous_value: false,
      new_value: true,
      action: 'enable_level_5',
      details: {
        reason: 'Mid-term revision unlocked',
      },
    });

    expect(configEvent.event_id).toBeDefined();
    expect(configEvent.event_type).toBe('cohort_allow_level_5_changed');
    expect(configEvent.actor_user_id).toBe('user_2test_adm_001');
    expect(configEvent.previous_value).toBe(false);
    expect(configEvent.new_value).toBe(true);

    // 2. In-engine verification: student attempt with free text and full prompt has PII / free-text sanitized to hashes
    const attemptEvent = logAuditEvent({
      event_type: 'attempt_submitted',
      actor_user_id: 'user_2test_stu_001',
      student_id: 'student_789',
      session_id: 'sess_abc_123',
      action: 'submit_final_answer',
      details: {
        student_response: 'My answer is 36 dollars because Leo gets 24',
        prompt: 'You are an AI math tutor. What is Maya share?',
        model_output: 'Let us check Leo share first.',
        clerk_user_id: 'user_clerk_secret_12345',
        question_id: 'ratio_share_001',
        hint_level: 2,
      },
    });

    // Sanitization invariants (Criterion 1 & Privacy requirements):
    // MUST NOT leak raw student free text
    expect(attemptEvent.details.student_response).toBeUndefined();
    expect(attemptEvent.details.student_response_hash).toBeDefined();
    expect(typeof attemptEvent.details.student_response_hash).toBe('string');

    // MUST NOT leak full prompt
    expect(attemptEvent.details.prompt).toBeUndefined();
    expect(attemptEvent.details.prompt_hash).toBeDefined();

    // MUST NOT leak raw model output
    expect(attemptEvent.details.model_output).toBeUndefined();
    expect(attemptEvent.details.output_hash).toBeDefined();

    // MUST NOT leak Clerk ID directly in details
    expect(attemptEvent.details.clerk_user_id).toBeUndefined();
    expect(attemptEvent.details.subject_hash).toBeDefined();

    // Structured metadata preserved
    expect(attemptEvent.details.question_id).toBe('ratio_share_001');
    expect(attemptEvent.details.hint_level).toBe(2);

    // 3. WebServer end-to-end verification: Trigger events via application routes
    // Provision user on WebServer
    const userRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_audit_test_01',
        role: 'student',
        display_label: 'Audit Test Student',
      },
    });
    expect(userRes.status()).toBe(201);
    const createdUser = (await userRes.json()).user;

    // Change role on WebServer
    const roleRes = await page.request.put(`/api/admin/users/${createdUser.id}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'teacher' },
    });
    expect(roleRes.status()).toBe(200);

    // Grant trace_review on WebServer
    const grantRes = await page.request.put(`/api/admin/users/user_2test_adm_001/grants/trace_review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(grantRes.status()).toBe(200);

    // Question review decision on WebServer
    const decisionRes = await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { decision: 'approved', note: 'Standard approved verification' },
    });
    expect(decisionRes.status()).toBe(200);

    // Create session on WebServer
    const sessionRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'student_e2e_audit' },
    });
    expect(sessionRes.status()).toBe(201);

    // Verify all generated events via OP-21 query API
    const queryRes = await page.request.get('/api/admin/audit-events', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(queryRes.status()).toBe(200);
    const body = await queryRes.json();
    expect(body.events.length).toBeGreaterThanOrEqual(4);

    const eventTypes = body.events.map((e) => e.event_type);
    expect(eventTypes).toContain('user_role_changed');
    expect(eventTypes).toContain('trace_review_granted');
    expect(eventTypes).toContain('content_review_decision');
    expect(eventTypes).toContain('session_created');
  });

  test('Criterion 2: Append-only invariants reject updates and deletes through application and API routes', async ({ page }) => {
    // 1. In-engine rejection: updateAuditEvent and deleteAuditEvent throw descriptive errors
    expect(() => updateAuditEvent()).toThrow(/append-only: updates are rejected/);
    expect(() => deleteAuditEvent()).toThrow(/append-only: deletes are rejected/);

    // 2. HTTP Route rejection: PUT to /api/admin/audit-events returns 405 Method Not Allowed
    const putCollectionRes = await page.request.put('/api/admin/audit-events', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { event_id: 'some_id', status: 'tampered' },
    });
    expect(putCollectionRes.status()).toBe(405);
    const putColBody = await putCollectionRes.json();
    expect(putColBody.error).toBe('method_not_allowed');

    // 3. HTTP Route rejection: DELETE to /api/admin/audit-events returns 405 Method Not Allowed
    const deleteCollectionRes = await page.request.delete('/api/admin/audit-events', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteCollectionRes.status()).toBe(405);

    // 4. HTTP Route rejection: PUT to /api/admin/audit-events/[id] returns 405 Method Not Allowed
    const putItemRes = await page.request.put('/api/admin/audit-events/event_123', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'altered' },
    });
    expect(putItemRes.status()).toBe(405);

    // 5. HTTP Route rejection: DELETE to /api/admin/audit-events/[id] returns 405 Method Not Allowed
    const deleteItemRes = await page.request.delete('/api/admin/audit-events/event_123', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteItemRes.status()).toBe(405);
  });

  test('Criterion 3: Administrator can filter audit viewer by user, student, event type, and time; non-admin access is rejected', async ({ page }) => {
    // 1. Non-admin attempting to query audit events receives 403 Forbidden
    const teacherForbiddenRes = await page.request.get('/api/admin/audit-events', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(teacherForbiddenRes.status()).toBe(403);

    const studentForbiddenRes = await page.request.get('/api/admin/audit-events', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentForbiddenRes.status()).toBe(403);

    // 2. Seed distinct events on WebServer via HTTP
    // Session for target student A
    const sessA = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'student_target_99' },
    });
    expect(sessA.status()).toBe(201);
    const sessionAData = await sessA.json();

    // Event on session A
    await page.request.post(`/api/sessions/${sessionAData.session.id}/events`, {
      data: { event: 'not_sure' },
    });

    // Content decision
    await page.request.post('/api/content/review-items/ratio_share_001/decision', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { decision: 'approved', note: 'Filter verification decision' },
    });

    // 3. Filter by User via API (actor_user_id: user_internal_admin_001)
    const userFilteredRes = await page.request.get('/api/admin/audit-events?user=user_internal_admin_001', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(userFilteredRes.status()).toBe(200);
    const userFilteredBody = await userFilteredRes.json();
    expect(userFilteredBody.events.length).toBeGreaterThanOrEqual(1);
    expect(userFilteredBody.events.every((e) => e.actor_user_id === 'user_internal_admin_001')).toBe(true);

    // 4. Filter by Student via API (student_id: student_target_99)
    const studentFilteredRes = await page.request.get('/api/admin/audit-events?student=student_target_99', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(studentFilteredRes.status()).toBe(200);
    const studentFilteredBody = await studentFilteredRes.json();
    expect(studentFilteredBody.events.length).toBeGreaterThanOrEqual(2);
    expect(studentFilteredBody.events.every((e) => e.student_id === 'student_target_99')).toBe(true);

    // 5. Filter by Event Type via API (event_type: session_created)
    const typeFilteredRes = await page.request.get('/api/admin/audit-events?event_type=session_created', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(typeFilteredRes.status()).toBe(200);
    const typeFilteredBody = await typeFilteredRes.json();
    expect(typeFilteredBody.events.length).toBeGreaterThanOrEqual(1);
    expect(typeFilteredBody.events.every((e) => e.event_type === 'session_created')).toBe(true);

    // 6. UI Audit Viewer verification (/admin/audit)
    await page.goto(`/admin/audit?token=${adminToken}`);

    await expect(page.getByTestId('filter-user-input')).toBeVisible();
    await expect(page.getByTestId('filter-student-input')).toBeVisible();
    await expect(page.getByTestId('filter-event-type-select')).toBeVisible();
    await expect(page.getByTestId('apply-filter-btn')).toBeVisible();

    // Initial audit events render
    await expect(page.getByTestId('audit-event-row').first()).toBeVisible();

    // Filter by student in UI
    await page.getByTestId('filter-student-input').fill('student_target_99');
    await page.getByTestId('apply-filter-btn').click();

    // Verify filtered results contain only student_target_99
    const studentBadge = page.getByTestId('student-id-val').first();
    await expect(studentBadge).toHaveText('student_target_99');

    // Reset filters
    await page.getByTestId('reset-filter-btn').click();
    await expect(page.getByTestId('filter-student-input')).toHaveValue('');
  });
});
