import { test, expect } from '@playwright/test';
import {
  registerAppUser,
  getAppUserById,
  getAppUserByClerkId,
  updateAppUserRole,
  updateAppUserGrants,
  authenticateRequest,
  authorizeRoute,
  resetAuthStore,
} from '../../lib/auth';
import { queryAuditEvents, resetAuditStore, logAuditEvent } from '../../lib/audit-trail';

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key_primary' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock_signature_bytes';
  return `${header}.${body}.${signature}`;
}

test.describe('ADM-01: Manage roles', () => {
  let adminToken;

  test.beforeEach(() => {
    resetAuthStore();
    resetAuditStore();

    adminToken = makeMockJwt({
      sub: 'user_2test_adm_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  test('Criterion 1: Role change takes effect on next API call; stale JWT claim does not grant old role; trace_review grant/revoke is audited', async ({ page }) => {
    // 1. Provision a user as student
    const createRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_role_test',
        role: 'student',
        display_label: 'Dynamic Role User',
      },
    });
    expect(createRes.status()).toBe(201);
    const targetUser = (await createRes.json()).user;

    // Token has claims from when user was a student
    const studentToken = makeMockJwt({
      sub: 'user_clerk_role_test',
      role: 'student',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // 2. Change role to teacher via PUT /api/admin/users/[id]/role
    const roleChangeRes = await page.request.put(`/api/admin/users/${targetUser.id}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'teacher' },
    });
    expect(roleChangeRes.status()).toBe(200);
    const updated = await roleChangeRes.json();
    expect(updated.user.role).toBe('teacher');

    // 3. User makes request with token still claiming role 'student' (or stale claims)
    // Server reads role from database/app_user on every request
    const profileRes = await page.request.get('/api/me/profile', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(profileRes.status()).toBe(200);
    const profile = await profileRes.json();
    expect(profile.user.role).toBe('teacher'); // Dynamic DB read, stale claim ignored!

    // 4. Verify role change was audited via OP-21 API
    const auditRes = await page.request.get('/api/admin/audit-events?event_type=user_role_changed', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status()).toBe(200);
    const auditBody = await auditRes.json();
    expect(auditBody.events.length).toBeGreaterThanOrEqual(1);
    expect(auditBody.events[0].previous_value).toBe('student');
    expect(auditBody.events[0].new_value).toBe('teacher');

    // 5. In-engine verification
    const testUser = registerAppUser({
      clerk_user_id: 'user_engine_role_test',
      role: 'student',
    });
    updateAppUserRole(testUser.id, 'coordinator');
    const inDb = getAppUserById(testUser.id);
    expect(inDb.role).toBe('coordinator');
  });

  test('Criterion 1b: Granting and revoking trace_review on administrator is audited; non-admin target returns 400', async ({ page }) => {
    // 1. Provision a second administrator
    const admin2Res = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_admin_two',
        role: 'administrator',
        display_label: 'Secondary Admin',
      },
    });
    expect(admin2Res.status()).toBe(201);
    const admin2 = (await admin2Res.json()).user;

    // 2. Grant trace_review
    const grantRes = await page.request.put(`/api/admin/users/${admin2.id}/grants/trace_review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(grantRes.status()).toBe(200);
    const grantBody = await grantRes.json();
    expect(grantBody.grants).toContain('trace_review');

    // 3. Revoke trace_review
    const revokeRes = await page.request.delete(`/api/admin/users/${admin2.id}/grants/trace_review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(revokeRes.status()).toBe(200);
    const revokeBody = await revokeRes.json();
    expect(revokeBody.grants).not.toContain('trace_review');

    // 4. Invariant: Granting trace_review to a non-admin returns 400 bad_request
    const stuRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_stu_grant_fail',
        role: 'student',
        display_label: 'Student Target',
      },
    });
    const stu = (await stuRes.json()).user;

    const invalidGrantRes = await page.request.put(`/api/admin/users/${stu.id}/grants/trace_review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(invalidGrantRes.status()).toBe(400);

    // 5. Verify audit events via OP-21 API
    const grantAuditRes = await page.request.get('/api/admin/audit-events?event_type=trace_review_granted', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(grantAuditRes.status()).toBe(200);
    const grantAuditData = await grantAuditRes.json();
    expect(grantAuditData.events.length).toBeGreaterThanOrEqual(1);

    const revokeAuditRes = await page.request.get('/api/admin/audit-events?event_type=trace_review_revoked', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(revokeAuditRes.status()).toBe(200);
    const revokeAuditData = await revokeAuditRes.json();
    expect(revokeAuditData.events.length).toBeGreaterThanOrEqual(1);
  });

  test('Criterion 3: Administrator without trace_review is denied replay; administrator holding trace_review is allowed; both are logged', async ({ page }) => {
    // 1. Create a session to replay via API
    const sessRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001' },
    });
    expect(sessRes.status()).toBe(201);
    const sessData = await sessRes.json();
    const sessionId = sessData.session.id;

    // 2. Administrator WITHOUT trace_review
    const noTraceAdminRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_admin_no_trace',
        role: 'administrator',
        display_label: 'Admin Without Trace Review',
        grants: [], // no trace_review
      },
    });
    const noTraceAdmin = (await noTraceAdminRes.json()).user;
    const noTraceToken = makeMockJwt({ sub: noTraceAdmin.clerk_user_id });

    const deniedRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: { Authorization: `Bearer ${noTraceToken}` },
    });
    expect(deniedRes.status()).toBe(403);
    const deniedBody = await deniedRes.json();
    expect(deniedBody.message).toContain('trace_review');

    // 3. Administrator WITH trace_review (seeded admin user_2test_adm_001 has trace_review)
    const allowedRes = await page.request.get(`/api/teacher/sessions/${sessionId}/replay`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(allowedRes.status()).toBe(200);
    const replayBody = await allowedRes.json();
    expect(replayBody.session_id).toBe(sessionId);

    // 4. Verify access attempts logged via OP-21 API
    const denyAuditRes = await page.request.get('/api/admin/audit-events?event_type=replay_access_denied', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(denyAuditRes.status()).toBe(200);
    const denyData = await denyAuditRes.json();
    expect(denyData.events.length).toBeGreaterThanOrEqual(1);

    const allowAuditRes = await page.request.get('/api/admin/audit-events?event_type=replay_access_allowed', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(allowAuditRes.status()).toBe(200);
    const allowData = await allowAuditRes.json();
    expect(allowData.events.length).toBeGreaterThanOrEqual(1);
  });

  test('Criterion 4 & 5: Parent role and unauthorized caller are rejected with 403 on protected routes', async ({ page }) => {
    // 1. Parent role sign-in token
    const parentToken = makeMockJwt({ sub: 'user_2test_par_001' });

    // Parent denied on admin route
    const parentAdminRes = await page.request.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    expect(parentAdminRes.status()).toBe(403);

    // Parent denied on profile/practice product route
    const parentProfileRes = await page.request.get('/api/me/profile', {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    expect(parentProfileRes.status()).toBe(403);

    // 2. Student attempting admin route returns 403
    const studentToken = makeMockJwt({ sub: 'user_2test_stu_001' });
    const studentAdminRes = await page.request.get('/api/admin/cohorts', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentAdminRes.status()).toBe(403);
  });
});
