import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  registerAppUser,
  getAppUserByClerkId,
  updateAppUserRole,
  authenticateRequest,
  authorizeRoute,
  setCachedJwksKeys,
  setSimulateJwksUnreachable,
  getAuthAuditEvents,
  resetAuthStore,
} from '../../lib/auth';

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key_primary' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock_signature_bytes';
  return `${header}.${body}.${signature}`;
}

test.describe('ADM-06: Sign in', () => {

  test.beforeEach(() => {
    resetAuthStore();
  });

  test('Criterion 1: Requesting student data without valid session returns 401 and data is not returned', async ({ page }) => {
    // 1. HTTP request to protected route without Authorization header
    const unauthRes = await page.request.get('/api/me/profile');
    expect(unauthRes.status()).toBe(401);
    const body = await unauthRes.json();
    expect(body.error).toBe('unauthorized');
    expect(body.user).toBeUndefined();

    // 2. Direct engine verification: missing token returns 401 and logs auth_failed
    const authResult = authenticateRequest({});
    expect(authResult.status).toBe(401);
    expect(authResult.error).toBe('unauthorized');

    const auditEvents = getAuthAuditEvents();
    expect(auditEvents.some((e) => e.event_type === 'auth_failed')).toBe(true);
  });

  test('Criterion 2: Role and cohort are read from database; stale role claim in Clerk JWT does NOT apply', async () => {
    const clerkId = 'user_clerk_student_123';
    // Provision student in DB
    const studentUser = registerAppUser({
      clerk_user_id: clerkId,
      role: 'student',
      cohort_ids: ['cohort_ratio_foundation'],
      display_label: 'Student 123',
    });
    expect(studentUser.role).toBe('student');

    // Create token where the JWT claims role is "administrator" (e.g. stale or tampered token)
    const token = makeMockJwt({
      sub: clerkId,
      role: 'administrator', // STALE / TAMPERED CLAIM
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Authenticate request
    const authResult = authenticateRequest({
      authorization: `Bearer ${token}`,
    });

    expect(authResult.status).toBe(200);
    // Role MUST be 'student' from DB, NOT 'administrator' from JWT
    expect(authResult.user.role).toBe('student');
    expect(authResult.user.cohort_ids).toContain('cohort_ratio_foundation');

    // Change role in DB to teacher
    updateAppUserRole(studentUser.id, 'teacher');
    const reAuthResult = authenticateRequest({
      authorization: `Bearer ${token}`,
    });
    expect(reAuthResult.user.role).toBe('teacher');
  });

  test('Criterion 3: Parent role sign-in succeeds but grants NO product route in the MVP', async () => {
    const parentClerkId = 'user_clerk_parent_456';
    registerAppUser({
      clerk_user_id: parentClerkId,
      role: 'parent',
      display_label: 'Parent 456',
    });

    const parentToken = makeMockJwt({
      sub: parentClerkId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Sign-in succeeds
    const authResult = authenticateRequest({
      authorization: `Bearer ${parentToken}`,
    });
    expect(authResult.status).toBe(200);
    expect(authResult.user.role).toBe('parent');

    // But grants NO product routes in the MVP
    const studentRouteAuth = authorizeRoute(authResult.user, 'student');
    expect(studentRouteAuth.allowed).toBe(false);
    expect(studentRouteAuth.status).toBe(403);
    expect(studentRouteAuth.message).toContain('Parent role grants no product routes in MVP');

    const teacherRouteAuth = authorizeRoute(authResult.user, 'teacher');
    expect(teacherRouteAuth.allowed).toBe(false);
    expect(teacherRouteAuth.status).toBe(403);

    const adminRouteAuth = authorizeRoute(authResult.user, 'admin');
    expect(adminRouteAuth.allowed).toBe(false);
    expect(adminRouteAuth.status).toBe(403);
  });

  test('Criterion 4: Authentication audit event is written on sign-in and failed sign-in', async () => {
    const clerkId = 'user_clerk_audit_test';
    registerAppUser({
      clerk_user_id: clerkId,
      role: 'student',
      display_label: 'Student Audit',
    });

    // 1. Successful sign-in
    const validToken = makeMockJwt({
      sub: clerkId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    authenticateRequest({ authorization: `Bearer ${validToken}` });

    // 2. Failed sign-in (expired token)
    const expiredToken = makeMockJwt({
      sub: clerkId,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired
    });
    authenticateRequest({ authorization: `Bearer ${expiredToken}` });

    const auditEvents = getAuthAuditEvents();
    expect(auditEvents.length).toBeGreaterThanOrEqual(2);

    const successEvent = auditEvents.find((e) => e.event_type === 'auth_success');
    expect(successEvent).toBeDefined();
    expect(successEvent.actor_user_id).toBeTruthy();
    // Audit row must NOT contain raw Clerk ID
    expect('clerk_user_id' in successEvent).toBe(false);

    const failEvent = auditEvents.find((e) => e.event_type === 'auth_failed');
    expect(failEvent).toBeDefined();
    expect(failEvent.reason).toBe('token_expired');
  });

  test('Criterion 5: Clerk JWKS unreachable uses cached keys up to 1 hour; with no cache returns 503 service_unavailable (never fails open)', async () => {
    const clerkId = 'user_clerk_jwks_test';
    registerAppUser({
      clerk_user_id: clerkId,
      role: 'student',
      display_label: 'Student JWKS',
    });
    const token = makeMockJwt({
      sub: clerkId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Case A: JWKS unreachable, but cached keys exist and are <= 1 hour old -> succeeds using cache
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    setCachedJwksKeys([{ kid: 'key_primary', kty: 'RSA' }], thirtyMinutesAgo);
    setSimulateJwksUnreachable(true);

    const cachedAuth = authenticateRequest({ authorization: `Bearer ${token}` });
    expect(cachedAuth.status).toBe(200);

    // Case B: JWKS unreachable and NO cache exists (or cache expired > 1h) -> returns 503 service_unavailable
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    setCachedJwksKeys([{ kid: 'key_primary', kty: 'RSA' }], twoHoursAgo); // Expired cache

    const expiredCacheAuth = authenticateRequest({ authorization: `Bearer ${token}` });
    expect(expiredCacheAuth.status).toBe(503);
    expect(expiredCacheAuth.error).toBe('service_unavailable');
    expect(expiredCacheAuth.message).toContain('Clerk JWKS endpoint unreachable and no usable cache');
  });

  test('Criterion 6: Valid token whose sub is not in app_user returns 403 forbidden and writes auth_unknown_subject without auto-provisioning', async () => {
    const unknownClerkId = 'user_clerk_stranger_danger_999';
    expect(getAppUserByClerkId(unknownClerkId)).toBeNull();

    const strangerToken = makeMockJwt({
      sub: unknownClerkId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = authenticateRequest({
      authorization: `Bearer ${strangerToken}`,
    });

    // Must return 403 forbidden with code auth_unknown_subject
    expect(result.status).toBe(403);
    expect(result.error).toBe('forbidden');
    expect(result.code).toBe('auth_unknown_subject');

    // Must NOT auto-provision!
    expect(getAppUserByClerkId(unknownClerkId)).toBeNull();

    // Audit event auth_unknown_subject must be written without raw Clerk ID
    const auditEvents = getAuthAuditEvents();
    const unknownEvent = auditEvents.find((e) => e.event_type === 'auth_unknown_subject');
    expect(unknownEvent).toBeDefined();
    expect('clerk_user_id' in unknownEvent).toBe(false);
  });

  test('Criterion 7: scripts/seed_synthetic.py contract verification', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/seed_synthetic.py');
    expect(fs.existsSync(scriptPath)).toBe(true);

    // 1. Run seed script for test environment
    const testOutputPath = path.resolve(process.cwd(), 'content/seed/seeded_test_temp.json');
    if (fs.existsSync(testOutputPath)) fs.unlinkSync(testOutputPath);

    const runOutput = execSync(`python3 ${scriptPath} test user_2bootstrap_admin_test`, {
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(runOutput);
    expect(parsed.status).toBe('success');
    expect(parsed.total_users).toBeGreaterThanOrEqual(5);

    // 2. Idempotency check: run second time creates 0 new rows
    const secondRun = execSync(`python3 ${scriptPath} test user_2bootstrap_admin_test`, {
      encoding: 'utf-8',
    });
    const parsedSecond = JSON.parse(secondRun);
    expect(parsedSecond.created_this_run).toBe(0);

    // Clean up temporary generated file
    if (fs.existsSync(parsed.output_path)) {
      fs.unlinkSync(parsed.output_path);
    }
  });
});
