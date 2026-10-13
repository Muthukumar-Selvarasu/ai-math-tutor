import { test, expect } from '@playwright/test';
import {
  registerAppUser,
  getAppUserById,
  getAppUserByClerkId,
  resetAuthStore,
  authenticateRequest,
} from '../../lib/auth';
import {
  createCohort,
  getCohort,
  getAllCohorts,
  assignMemberToCohort,
  setCohortSupportContact,
  getCohortSurface,
  resetCohortStore,
} from '../../lib/cohort-store';
import { queryAuditEvents, resetAuditStore } from '../../lib/audit-trail';

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key_primary' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock_signature_bytes';
  return `${header}.${body}.${signature}`;
}

test.describe('ADM-13: Create a cohort and assign people', () => {
  let adminToken;

  test.beforeEach(() => {
    resetAuthStore();
    resetCohortStore();
    resetAuditStore();

    adminToken = makeMockJwt({
      sub: 'user_2test_adm_001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  test('Criterion 1: Cohort creation initializes curriculum scope, starting set, default allow_level_5=false, and at most one support contact', async ({ page }) => {
    // 1. Non-admin request rejected
    const unauthRes = await page.request.post('/api/admin/cohorts', {
      data: { name: 'Unauthorized Cohort' },
    });
    expect(unauthRes.status()).toBe(401);

    // 2. Administrator creates cohort via API
    const createRes = await page.request.post('/api/admin/cohorts', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        id: 'cohort_y7_ratio_autumn',
        name: 'Year 7 Ratio Autumn 2026',
        curriculum_scope: ['ratio_and_proportion_y6_y7'],
        starting_set: ['ratio_simplifying', 'ratio.simplify'],
        allow_level_5: false, // Default opt-in
      },
    });

    expect(createRes.status()).toBe(201);
    const body = await createRes.json();
    const cohort = body.cohort;

    expect(cohort.id).toBe('cohort_y7_ratio_autumn');
    expect(cohort.name).toBe('Year 7 Ratio Autumn 2026');
    expect(cohort.curriculum_scope).toContain('ratio_and_proportion_y6_y7');
    expect(cohort.starting_set).toContain('ratio_simplifying');
    expect(cohort.allow_level_5).toBe(false); // opt-in invariant
    expect(cohort.support_contact_user_id).toBeNull();

    // 3. Verify in cohort store API
    const getRes = await page.request.get('/api/admin/cohorts/cohort_y7_ratio_autumn', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.cohort.name).toBe('Year 7 Ratio Autumn 2026');
    expect(getBody.cohort.allow_level_5).toBe(false);
  });

  test('Support Contact: Cohort has at most one support contact; replacing one audits both changes', async ({ page }) => {
    // Create initial cohort via admin API
    await page.request.post('/api/admin/cohorts', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        id: 'cohort_test_support',
        name: 'Support Contact Cohort',
        curriculum_scope: ['ratio_and_proportion_y6_y7'],
        starting_set: ['ratio_simplifying'],
      },
    });

    // Create staff 1 and staff 2 via admin users API
    const u1Res = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_staff_1',
        role: 'teacher',
        display_label: 'Staff Member 1',
      },
    });
    expect(u1Res.status()).toBe(201);
    const staff1 = (await u1Res.json()).user;

    const u2Res = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_staff_2',
        role: 'coordinator',
        display_label: 'Staff Member 2',
      },
    });
    expect(u2Res.status()).toBe(201);
    const staff2 = (await u2Res.json()).user;

    // 1. Assign staff1 as initial support contact
    const setRes1 = await page.request.put('/api/admin/cohorts/cohort_test_support/support-contact', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: staff1.id },
    });
    expect(setRes1.status()).toBe(200);
    const body1 = await setRes1.json();
    expect(body1.cohort.support_contact_user_id).toBe(staff1.id);

    // 2. Replace support contact with staff2 (replaces existing, audits both)
    const setRes2 = await page.request.put('/api/admin/cohorts/cohort_test_support/support-contact', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: staff2.id },
    });
    expect(setRes2.status()).toBe(200);
    const body2 = await setRes2.json();
    expect(body2.cohort.support_contact_user_id).toBe(staff2.id); // strictly 1 support contact

    // In-engine audit trail verification
    const inEngineCohort = createCohort({
      id: 'cohort_in_engine',
      name: 'Engine Cohort',
      actor_user_id: 'admin_test',
    });
    setCohortSupportContact(inEngineCohort.id, { user_id: 'staff_id_1' }, 'admin_test');
    setCohortSupportContact(inEngineCohort.id, { user_id: 'staff_id_2' }, 'admin_test');

    const removeAudits = queryAuditEvents({ event_type: 'support_contact_removed' });
    const assignAudits = queryAuditEvents({ event_type: 'support_contact_assigned' });
    expect(removeAudits.events.length).toBeGreaterThanOrEqual(1);
    expect(removeAudits.events[0].previous_value).toBe('staff_id_1');
    expect(assignAudits.events.some((e) => e.new_value === 'staff_id_2')).toBe(true);
  });

  test('Criterion 2: Enrolling student and assigning staff scopes each person strictly to that cohort allowed surface', async ({ page }) => {
    // 1. Create cohort
    await page.request.post('/api/admin/cohorts', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        id: 'cohort_scope_test',
        name: 'Scoped Surface Cohort',
        curriculum_scope: ['ratio_and_proportion_y6_y7'],
        starting_set: ['ratio_simplifying', 'ratio.simplify'],
      },
    });

    // 2. Create users for student, teacher, tutor, and coordinator
    const sRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { clerk_user_id: 'user_clerk_stu_scoped', role: 'student', display_label: 'Student Alpha' },
    });
    const studentUser = (await sRes.json()).user;

    const tRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { clerk_user_id: 'user_clerk_tch_scoped', role: 'teacher', display_label: 'Teacher Beta' },
    });
    const teacherUser = (await tRes.json()).user;

    const tuRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { clerk_user_id: 'user_clerk_tut_scoped', role: 'tutor', display_label: 'Tutor Gamma' },
    });
    const tutorUser = (await tuRes.json()).user;

    const cRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { clerk_user_id: 'user_clerk_crd_scoped', role: 'coordinator', display_label: 'Coordinator Delta' },
    });
    const coordUser = (await cRes.json()).user;

    // 3. Assign members to cohort
    await page.request.post('/api/admin/cohorts/cohort_scope_test/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: studentUser.id, member_role: 'student' },
    });
    await page.request.post('/api/admin/cohorts/cohort_scope_test/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: teacherUser.id, member_role: 'teacher' },
    });
    await page.request.post('/api/admin/cohorts/cohort_scope_test/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: tutorUser.id, member_role: 'tutor' },
    });
    await page.request.post('/api/admin/cohorts/cohort_scope_test/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { user_id: coordUser.id, member_role: 'coordinator' },
    });

    // 4. Verify student surface
    const studentToken = makeMockJwt({ sub: studentUser.clerk_user_id });
    const studentSurfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentSurfaceRes.status()).toBe(200);
    const stuBody = await studentSurfaceRes.json();
    expect(stuBody.surface.role).toBe('student');
    expect(stuBody.surface.surfaces).toContain('practice');
    expect(stuBody.surface.surfaces).toContain('sessions');
    expect(stuBody.surface.curriculum_scope).toContain('ratio_and_proportion_y6_y7');

    // 5. Verify teacher surface
    const teacherToken = makeMockJwt({ sub: teacherUser.clerk_user_id });
    const teacherSurfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(teacherSurfaceRes.status()).toBe(200);
    const tchBody = await teacherSurfaceRes.json();
    expect(tchBody.surface.role).toBe('teacher');
    expect(tchBody.surface.surfaces).toContain('replays');
    expect(tchBody.surface.surfaces).toContain('comments');
    expect(tchBody.surface.surfaces).toContain('recommendations');
    expect(tchBody.surface.surfaces).toContain('flags');

    // 6. Verify tutor surface (OP-12: metadata only, no responses/tutor output)
    const tutorToken = makeMockJwt({ sub: tutorUser.clerk_user_id });
    const tutorSurfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${tutorToken}` },
    });
    expect(tutorSurfaceRes.status()).toBe(200);
    const tutBody = await tutorSurfaceRes.json();
    expect(tutBody.surface.role).toBe('tutor');
    expect(tutBody.surface.surfaces).toContain('sessions_metadata');
    expect(tutBody.surface.surfaces).toContain('notes');

    // 7. Verify coordinator surface (OP-14, OP-15: summary and settings)
    const coordToken = makeMockJwt({ sub: coordUser.clerk_user_id });
    const coordSurfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    expect(coordSurfaceRes.status()).toBe(200);
    const crdBody = await coordSurfaceRes.json();
    expect(crdBody.surface.role).toBe('coordinator');
    expect(crdBody.surface.surfaces).toContain('summary');
    expect(crdBody.surface.surfaces).toContain('settings');

    // 8. Unassigned user receives 403 forbidden
    const unassignedRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { clerk_user_id: 'user_clerk_unassigned', role: 'student', display_label: 'Unassigned Student' },
    });
    const unassignedUser = (await unassignedRes.json()).user;
    const unassignedToken = makeMockJwt({ sub: unassignedUser.clerk_user_id });

    const surfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${unassignedToken}` },
    });
    expect(surfaceRes.status()).toBe(403);

    // 9. Parent user receives 403 forbidden
    const parentToken = makeMockJwt({ sub: 'user_2test_par_001' });
    const parentSurfaceRes = await page.request.get('/api/cohorts/cohort_scope_test/surface', {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    expect(parentSurfaceRes.status()).toBe(403);
  });

  test('Criterion 3: Administrator creates user for Clerk ID without storing name/email; unknown Clerk ID rejected with 403 auth_unknown_subject', async ({ page }) => {
    // 1. Administrator creates user via POST /api/admin/users
    const createRes = await page.request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        clerk_user_id: 'user_clerk_new_provisioned',
        role: 'student',
        display_label: 'Synthetic Student 99',
        cohort_ids: ['cohort_ratio_foundation'],
        name: 'Real Name Leaked',
        email: 'leaked@example.com',
      },
    });

    expect(createRes.status()).toBe(201);
    const body = await createRes.json();
    const createdUser = body.user;

    // Verify internal pseudonymous ID generated
    expect(createdUser.id).toBeDefined();
    expect(typeof createdUser.id).toBe('string');
    expect(createdUser.role).toBe('student');
    expect(createdUser.display_label).toBe('Synthetic Student 99');

    // Invariant: No name and no email stored
    expect(createdUser.name).toBeUndefined();
    expect(createdUser.email).toBeUndefined();

    // 2. Newly provisioned user signs in successfully
    const userToken = makeMockJwt({
      sub: 'user_clerk_new_provisioned',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const httpRes = await page.request.get('/api/me/profile', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(httpRes.status()).toBe(200);
    const httpProfile = await httpRes.json();
    expect(httpProfile.user.id).toBe(createdUser.id);
    expect(httpProfile.user.name).toBeUndefined();
    expect(httpProfile.user.email).toBeUndefined();

    // 3. Unknown Clerk user (not in app_user) is rejected at sign-in with 403 forbidden and code auth_unknown_subject
    const unknownToken = makeMockJwt({
      sub: 'user_clerk_unknown_rogue',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const unknownRes = await page.request.get('/api/me/profile', {
      headers: { Authorization: `Bearer ${unknownToken}` },
    });
    expect(unknownRes.status()).toBe(403);
    const unknownBody = await unknownRes.json();
    expect(unknownBody.code).toBe('auth_unknown_subject');
  });
});
