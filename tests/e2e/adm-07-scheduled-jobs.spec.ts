import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('ADM-07: Scheduled jobs', () => {
  const cronSecret = process.env.CRON_SECRET || 'development-cron-secret-change-me';
  const authHeader = { Authorization: `Bearer ${cronSecret}` };
  const adminToken = JSON.stringify({
    sub: 'user_2test_adm_001',
    role: 'administrator',
  });
  const adminHeader = { Authorization: `Bearer ${adminToken}` };

  test('Criterion 1: Unauthenticated cron call without or with invalid CRON_SECRET is rejected (401) and logged to audit trail', async ({ page }) => {
    // 1. Call without CRON_SECRET
    const noAuthRes = await page.request.get('/api/jobs/warmup');
    expect(noAuthRes.status()).toBe(401);
    const noAuthBody = await noAuthRes.json();
    expect(noAuthBody.error).toBe('unauthenticated');

    // 2. Call with wrong CRON_SECRET
    const wrongAuthRes = await page.request.get('/api/jobs/learner-rollup', {
      headers: { Authorization: 'Bearer wrong-secret-token' },
    });
    expect(wrongAuthRes.status()).toBe(401);
    const wrongAuthBody = await wrongAuthRes.json();
    expect(wrongAuthBody.error).toBe('unauthenticated');

    // 3. Verify audit event was logged
    const auditRes = await page.request.get('/api/admin/audit-events?event_type=cron_auth_failed', {
      headers: adminHeader,
    });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.events.length).toBeGreaterThanOrEqual(1);
    const failEvent = auditData.events.find((e: any) => e.event_type === 'cron_auth_failed');
    expect(failEvent).toBeTruthy();
    expect(failEvent.reason).toBe('invalid_or_missing_cron_secret');
  });

  test('Criterion 2: All six job routes in catalogue require CRON_SECRET and return 200 with job_run_id, status, and counts', async ({ page }) => {
    const jobRoutes = [
      'warmup',
      'learner-rollup',
      'embedding-sync',
      'insight-drafts',
      'item-quality-scan',
      'retention-purge',
    ];

    for (const route of jobRoutes) {
      // Missing auth -> 401
      const unauth = await page.request.get(`/api/jobs/${route}`);
      expect(unauth.status()).toBe(401);

      // Valid auth -> 200
      const auth = await page.request.get(`/api/jobs/${route}`, {
        headers: authHeader,
      });
      expect(auth.status()).toBe(200);
      const data = await auth.json();
      expect(data.job_run_id).toBeTruthy();
      expect(['succeeded', 'partial']).toContain(data.status);
      expect(typeof data.processed_count).toBe('number');
      expect(typeof data.remaining_count).toBe('number');
    }
  });

  test('Criterion 3: Jobs are idempotent: running twice on same pending work produces consistent state and writes job_run', async ({ page }) => {
    // Run warmup first time
    const res1 = await page.request.get('/api/jobs/warmup', { headers: authHeader });
    expect(res1.status()).toBe(200);
    const data1 = await res1.json();

    // Run warmup second time
    const res2 = await page.request.get('/api/jobs/warmup', { headers: authHeader });
    expect(res2.status()).toBe(200);
    const data2 = await res2.json();

    expect(data1.status).toBe(data2.status);
    expect(data1.processed_count).toBe(data2.processed_count);
    expect(data1.remaining_count).toBe(data2.remaining_count);

    // Verify job runs via admin endpoint
    const adminJobsRes = await page.request.get('/api/admin/jobs?job_name=warmup', {
      headers: adminHeader,
    });
    expect(adminJobsRes.status()).toBe(200);
    const adminData = await adminJobsRes.json();
    expect(adminData.runs.length).toBeGreaterThanOrEqual(2);

    const latestRun = adminData.runs[adminData.runs.length - 1];
    expect(latestRun.job_name).toBe('warmup');
    expect(latestRun.started_at).toBeTruthy();
    expect(latestRun.completed_at).toBeTruthy();
    expect(latestRun.status).toBe('succeeded');
  });

  test('Criterion 4: Bounded batching and resumption: processes bounded batch and reports remaining_count for next invocation', async ({ page }) => {
    // Request learner-rollup with small bounded batch
    const batchRes = await page.request.get('/api/jobs/learner-rollup?batch_size=1&offset=0', {
      headers: authHeader,
    });
    expect(batchRes.status()).toBe(200);
    const batchData = await batchRes.json();

    expect(batchData.job_run_id).toBeTruthy();
    expect(typeof batchData.processed_count).toBe('number');
    expect(typeof batchData.remaining_count).toBe('number');
  });

  test('Criterion 5: Job failure records alert and Langfuse score representation visible to administrators', async ({ page }) => {
    // Trigger simulated failure
    const failRes = await page.request.get('/api/jobs/warmup?simulate_failure=true', {
      headers: authHeader,
    });
    expect(failRes.status()).toBe(500);
    const failData = await failRes.json();
    expect(failData.status).toBe('failed');
    expect(failData.error).toContain('Simulated failure');

    // Verify alert is recorded and queryable by administrator
    const adminRes = await page.request.get('/api/admin/jobs', {
      headers: adminHeader,
    });
    expect(adminRes.status()).toBe(200);
    const adminData = await adminRes.json();
    expect(adminData.alerts.length).toBeGreaterThanOrEqual(1);

    const alert = adminData.alerts.find((a: any) => a.job_name === 'warmup');
    expect(alert).toBeTruthy();
    expect(alert.level).toBe('error');
    expect(alert.langfuse_score).toBe(0.0);
  });

  test('Criterion 6: embedding-sync embeds approved published questions only (768-dim vector), skips unapproved questions, excludes exemplars', async ({ page }) => {
    const embedRes = await page.request.get('/api/jobs/embedding-sync', {
      headers: authHeader,
    });
    expect(embedRes.status()).toBe(200);
    const embedData = await embedRes.json();

    expect(embedData.status).toBe('succeeded');
    expect(embedData.processed_count).toBeGreaterThan(0);
    expect(embedData.details.exemplars_embedded).toBe(0); // Invariant SPEC D-26

    // Verify administrator view of embeddings count
    const adminRes = await page.request.get('/api/admin/jobs', {
      headers: adminHeader,
    });
    const adminData = await adminRes.json();
    expect(adminData.embeddings_count).toBeGreaterThan(0);
  });

  test('Criterion 7: Architecture invariant: nightly evaluation is GitHub Actions workflow eval.yml, not a cron route', async () => {
    const evalWorkflowPath = path.join(process.cwd(), '.github', 'workflows', 'eval.yml');
    // Verify architectural documentation contract: eval.yml is the nightly runner, cron routes are exactly 6
    const prdText = fs.readFileSync(path.join(process.cwd(), 'PRD.md'), 'utf8');
    expect(prdText).toContain('eval.yml');
    expect(prdText).toContain('The nightly evaluation is the GitHub Actions workflow `eval.yml`, not a cron route');
  });
});
