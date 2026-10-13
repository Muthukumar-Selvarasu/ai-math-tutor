import { test, expect } from '@playwright/test';
import {
  buildTurnTraceMetadata,
  registerTurnTrace,
  getTurnTrace,
  exportTrace,
  scrubPii,
  sanitizeSentryEvent,
  verifyEvalSuiteBeforeDeploy,
  resetTraceStore,
} from '../../lib/traceability';

test.describe('ADM-05: Model and prompt traceability', () => {

  test.beforeEach(() => {
    resetTraceStore();
  });

  test('Criterion 2: Tutor turn stores model name, version, provider, sampling parameters, prompt template version, hint-policy version, tool results, trace_id, trace_status, and fallback_reason', async ({ page }) => {
    const studentId = `stu_trace_${Date.now()}`;

    // 1. Create a session via API
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    expect(createRes.status()).toBe(201);
    const { session } = await createRes.json();
    const sessionId = session.id;

    // 2. Submit an incorrect answer to generate a tutor turn with feedback
    const eventRes = await page.request.post(`/api/sessions/${sessionId}/events`, {
      data: {
        event: 'submit',
        answer_text: '40', // incorrect for 2:3 of $60 (correct is 36)
        response_duration_ms: 8000,
      },
    });
    expect(eventRes.status()).toBe(200);
    const body = await eventRes.json();
    const tutor = body.tutor;
    expect(tutor).toBeDefined();

    // Verify all required trace metadata fields
    expect(tutor.provider).toBeDefined();
    expect(tutor.model).toBeDefined();
    expect(tutor.model_version).toBeDefined();
    expect(typeof tutor.temperature).toBe('number');
    expect(tutor.sampling_parameters).toBeDefined();
    expect(typeof tutor.sampling_parameters.temperature).toBe('number');
    expect(tutor.prompt_template_version).toBeDefined();
    expect(tutor.prompt_version).toBeDefined();
    expect(tutor.hint_policy_version).toBeDefined();
    expect(tutor.policy_version).toBeDefined();
    expect(tutor.tool_results).toBeDefined();
    expect(tutor.tool_results.verifier).toBeDefined();
    expect(tutor.trace_id).toBeDefined();
    expect(tutor.trace_status).toBeDefined();
    expect('fallback_reason' in tutor).toBe(true);
  });

  test('Criterion 3: Administrator holding trace_review can navigate to trace; teacher without grant cannot', async ({ page }) => {
    // 1. Create session and turn on server to generate trace in server store
    const studentId = `stu_trace_nav_${Date.now()}`;
    const createRes = await page.request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: studentId },
    });
    expect(createRes.status()).toBe(201);
    const { session } = await createRes.json();
    const eventRes = await page.request.post(`/api/sessions/${session.id}/events`, {
      data: {
        event: 'submit',
        answer_text: '40',
        response_duration_ms: 8000,
      },
    });
    expect(eventRes.status()).toBe(200);
    const turnBody = await eventRes.json();
    const serverTraceId = turnBody.tutor.trace_id;
    expect(serverTraceId).toBeTruthy();

    // 2. Teacher request without trace_review -> 403 Forbidden
    const teacherRes = await page.request.get(`/api/admin/traces/${serverTraceId}`, {
      headers: {
        'x-user-role': 'teacher',
        'x-user-grants': '',
      },
    });
    expect(teacherRes.status()).toBe(403);
    const teacherBody = await teacherRes.json();
    expect(teacherBody.error).toBe('forbidden');

    // 3. Administrator WITHOUT trace_review -> 403 Forbidden
    const adminNoGrantRes = await page.request.get(`/api/admin/traces/${serverTraceId}`, {
      headers: {
        'x-user-role': 'administrator',
        'x-user-grants': 'user_management',
      },
    });
    expect(adminNoGrantRes.status()).toBe(403);
    const adminNoGrantBody = await adminNoGrantRes.json();
    expect(adminNoGrantBody.error).toBe('forbidden');

    // 4. Administrator WITH trace_review -> 200 OK with trace_link
    const adminWithGrantRes = await page.request.get(`/api/admin/traces/${serverTraceId}`, {
      headers: {
        'x-user-role': 'administrator',
        'x-user-grants': 'trace_review',
      },
    });
    expect(adminWithGrantRes.status()).toBe(200);
    const adminBody = await adminWithGrantRes.json();
    expect(adminBody.has_trace_access).toBe(true);
    expect(adminBody.trace_link).toContain(`https://cloud.langfuse.com/project/traces/${serverTraceId}`);
    expect(adminBody.data).toBeDefined();

    // 5. Verify 90-day retention window expiry notice via getTurnTrace
    const expiredTraceId = `trace_expired_${Date.now()}`;
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    registerTurnTrace(expiredTraceId, {
      model: 'gemini-2.5-flash',
      prompt_version: '1.0.0',
      created_at: ninetyOneDaysAgo,
    });

    const expiredResult = getTurnTrace(expiredTraceId, {
      role: 'administrator',
      grants: ['trace_review'],
    });
    expect(expiredResult.trace_notice).toBe('expired');
  });

  test('Criterion 4: Evaluation suite runs before prompt or model changes deploy to production', () => {
    // 1. Passing evaluation suite -> deployment allowed
    const passingEval = {
      answer_leakage: 0,
      verifier_agreement: 0.995,
      schema_valid: 1.0,
      single_prompt: 1.0,
      age_appropriate: 1.0,
      hint_policy_match: 0.96,
    };
    const passResult = verifyEvalSuiteBeforeDeploy('prompt_update', passingEval);
    expect(passResult.allowed).toBe(true);
    expect(passResult.blocked).toBe(false);

    // 2. Failing evaluation suite (leakage violation) -> deployment blocked
    const failingEvalLeakage = {
      ...passingEval,
      answer_leakage: 2, // Must be 0
    };
    const failResult1 = verifyEvalSuiteBeforeDeploy('model_switch', failingEvalLeakage);
    expect(failResult1.allowed).toBe(false);
    expect(failResult1.blocked).toBe(true);
    expect(failResult1.reason).toContain('answer_leakage');

    // 3. Failing evaluation suite (verifier agreement violation) -> deployment blocked
    const failingEvalVerifier = {
      ...passingEval,
      verifier_agreement: 0.95, // Must be >= 0.99
    };
    const failResult2 = verifyEvalSuiteBeforeDeploy('prompt_template_change', failingEvalVerifier);
    expect(failResult2.allowed).toBe(false);
    expect(failResult2.blocked).toBe(true);
    expect(failResult2.reason).toContain('verifier_agreement');
  });

  test('Criterion 5: Turn records LLM_PROVIDER, model name, and model version for Release 1.0 (Gemini) and alternate providers', () => {
    // Release 1.0 default: Google Gemini
    const geminiMetadata = buildTurnTraceMetadata({
      provider: 'google',
      model: 'gemini-2.5-flash',
      model_version: 'gemini-2.5-flash-v1',
      isLlmMode: true,
    });
    expect(geminiMetadata.provider).toBe('google');
    expect(geminiMetadata.model).toBe('gemini-2.5-flash');
    expect(geminiMetadata.model_version).toBe('gemini-2.5-flash-v1');

    // Release 1.1 alternate provider: Anthropic Claude
    const claudeMetadata = buildTurnTraceMetadata({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      model_version: 'claude-3-5-sonnet-20241022',
      isLlmMode: true,
    });
    expect(claudeMetadata.provider).toBe('anthropic');
    expect(claudeMetadata.model).toBe('claude-3-5-sonnet');
    expect(claudeMetadata.model_version).toBe('claude-3-5-sonnet-20241022');

    // Template dialogue mode (shipped default)
    const templateMetadata = buildTurnTraceMetadata({
      isLlmMode: false,
    });
    expect(templateMetadata.provider).toBe('template');
    expect(templateMetadata.model).toBe('template');
    expect(templateMetadata.model_version).toBe('template-1.0');
  });

  test('Criterion 6: Raw student name, email, and Australian phone number are absent from exported traces and model prompts', () => {
    const rawStudentInput = "Hi, my name is Alice Cooper. My email is alice.cooper@example.edu.au and phone is 0412 345 678. I live at 42 High Street, Melbourne.";

    // 1. Scrub PII runs in under 5 ms
    const t0 = Date.now();
    const scrubbed = scrubPii(rawStudentInput);
    const duration = Date.now() - t0;
    expect(duration).toBeLessThanOrEqual(5);

    // Verify raw values are completely absent
    expect(scrubbed).not.toContain("alice.cooper@example.edu.au");
    expect(scrubbed).not.toContain("0412 345 678");
    expect(scrubbed).not.toContain("Alice");
    expect(scrubbed).not.toContain("42 High Street");

    // Verify redaction tokens
    expect(scrubbed).toContain("[REDACTED_EMAIL]");
    expect(scrubbed).toContain("[REDACTED_PHONE]");
    expect(scrubbed).toContain("[STUDENT_NAME]");
    expect(scrubbed).toContain("[REDACTED_ADDRESS]");

    // 2. Exported trace scrubbing
    const rawTrace = {
      trace_id: 'tr_123',
      student_input: rawStudentInput,
      prompt_content: `Review work for student: ${rawStudentInput}`,
    };
    const exported = exportTrace(rawTrace);
    expect(exported.student_input).not.toContain("alice.cooper@example.edu.au");
    expect(exported.prompt_content).not.toContain("0412 345 678");
    expect(exported.student_input).toContain("[REDACTED_EMAIL]");
  });

  test('Criterion 8: Sentry error event carries zero student answer, step, note, token, Clerk ID, or app_user.id', () => {
    const sensitiveContext = {
      request_id: 'req_87654321',
      trace_id: 'trace_langfuse_999',
      session_id: 'sess_123456',
      environment: 'staging',
      release: '1.0.0-rc1',
      service_name: 'solvepath-orchestrator',

      // SENSITIVE FIELDS THAT MUST BE EXCLUDED:
      student_answer: '36 dollars',
      step_text: '60 / 5 = 12, then 12 * 3 = 36',
      student_note: 'I am feeling confused about unitary method',
      bearer_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      clerk_id: 'user_2bXyZ123456789',
      app_user_id: 'usr_uuid_9999',
    };

    const simulatedError = new Error("Database query timeout during lease check");
    const sanitizedEvent = sanitizeSentryEvent(simulatedError, sensitiveContext);

    // Verify permitted metadata is present
    expect(sanitizedEvent.request_id).toBe('req_87654321');
    expect(sanitizedEvent.trace_id).toBe('trace_langfuse_999');
    expect(sanitizedEvent.session_id).toBe('sess_123456');
    expect(sanitizedEvent.environment).toBe('staging');
    expect(sanitizedEvent.release).toBe('1.0.0-rc1');
    expect(sanitizedEvent.service_name).toBe('solvepath-orchestrator');
    expect(sanitizedEvent.error.message).toBe("Database query timeout during lease check");

    // Verify forbidden student and identity fields are STRICTLY ABSENT
    expect('student_answer' in sanitizedEvent).toBe(false);
    expect('step_text' in sanitizedEvent).toBe(false);
    expect('student_note' in sanitizedEvent).toBe(false);
    expect('bearer_token' in sanitizedEvent).toBe(false);
    expect('clerk_id' in sanitizedEvent).toBe(false);
    expect('app_user_id' in sanitizedEvent).toBe(false);
    expect(JSON.stringify(sanitizedEvent)).not.toContain('36 dollars');
    expect(JSON.stringify(sanitizedEvent)).not.toContain('confused about unitary');
    expect(JSON.stringify(sanitizedEvent)).not.toContain('eyJhbGci');
    expect(JSON.stringify(sanitizedEvent)).not.toContain('user_2bXyZ123456789');
  });
});
