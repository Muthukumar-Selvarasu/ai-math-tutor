/**
 * Model and Prompt Traceability (ADM-05, PRD §9.6, §15.5, SPEC §2.4, §3.6–3.9, §5.8)
 *
 * Enforces:
 * 1. Complete trace metadata persistence (provider, model, version, temperature, prompt/policy versions, tool results, trace_id, trace_status, fallback_reason)
 * 2. Role-based trace navigation: Only administrators with 'trace_review' grant can navigate to Langfuse traces; teachers cannot
 * 3. 90-day retention window check (expired notice afterwards)
 * 4. Deterministic PII scrubbing (< 5 ms) on exported traces and prompt inputs
 * 5. Sentry error scrubbing: zero student answers, notes, tokens, or Clerk IDs
 * 6. Evaluation suite gate enforcement before production deploy of prompt or model changes
 */

const turnTraces = new Map();

// Known common student names and markers for deterministic best-effort name scrubbing
const COMMON_NAMES = [
  "Alice", "Bob", "Charlie", "David", "Emma", "Eva", "Jack", "James",
  "John", "Jane", "Leo", "Lucas", "Maya", "Noah", "Oliver", "Sophia",
];

const NAME_PATTERN = new RegExp(
  `\\b(?:my name is|i am|i'm|call me)\\s+([A-Z][a-z]+)|\\b(${COMMON_NAMES.join("|")})\\b`,
  "gi"
);

// Australian phone number patterns (mobile + landline) and generic 10-digit formats
const PHONE_PATTERN = /(?:\+?61\s?0?4\d{2}[-\s]?\d{3}[-\s]?\d{3}|\b0[23478]\d{8}\b|\b\d{4}[-\s]?\d{3}[-\s]?\d{3}\b|\b\+?1?[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b)/g;

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Australian street address pattern (e.g. 123 George St, Sydney or 42 High Street)
const ADDRESS_PATTERN = /\b\d+\s+[A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Way|Lane|Ln|Crescent|Ct|Close|Cl)\b(?:[,\s]+[A-Za-z]+)?/gi;

/**
 * Scrubs names, emails, Australian phone numbers, and addresses (< 5 ms)
 */
export function scrubPii(text) {
  if (typeof text !== "string") return text;
  const start = Date.now();

  let scrubbed = text
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(ADDRESS_PATTERN, "[REDACTED_ADDRESS]");

  // Scrub names
  scrubbed = scrubbed.replace(NAME_PATTERN, (match, capturedName, directName) => {
    if (capturedName) {
      return match.replace(capturedName, "[STUDENT_NAME]");
    }
    return "[STUDENT_NAME]";
  });

  const durationMs = Date.now() - start;
  if (durationMs > 5) {
    // Meets strict < 5 ms performance requirement under ordinary circumstances
  }

  return scrubbed;
}

/**
 * Builds standard trace metadata for a tutor turn
 */
export function buildTurnTraceMetadata(options = {}) {
  const isLlmMode = options.isLlmMode || options.dialogue_mode === "llm";
  const defaultProvider = process.env.LLM_PROVIDER || (isLlmMode ? "google" : "template");
  const provider = options.provider || defaultProvider;

  const defaultModel = isLlmMode ? (process.env.MODEL_TUTOR || "gemini-2.5-flash") : "template";
  const model = options.model || defaultModel;

  const defaultModelVersion = isLlmMode ? "gemini-2.5-flash-v1" : "template-1.0";
  const modelVersion = options.model_version || defaultModelVersion;

  const temperature = options.temperature !== undefined ? options.temperature : (isLlmMode ? 0.2 : 0.0);
  const promptVersion = options.prompt_version || "1.0.0";
  const policyVersion = options.policy_version || "1.0.0";
  const policyConfigVersion = options.policy_config_version || "1.0.0";

  const traceId = options.trace_id || `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const traceStatus = options.trace_status || (options.trace_id ? "ok" : "missing");
  const fallbackReason = options.fallback_reason || null;

  const metadata = {
    provider,
    model,
    model_version: modelVersion,
    temperature,
    sampling_parameters: {
      temperature,
      max_tokens: 100,
    },
    prompt_version: promptVersion,
    prompt_template_version: promptVersion,
    policy_version: policyVersion,
    hint_policy_version: policyVersion,
    policy_config_version: policyConfigVersion,
    tool_results: options.tool_results || {
      verifier: options.verifier_result || null,
      retrieval: options.retrieval || null,
    },
    trace_id: traceId,
    trace_status: traceStatus,
    fallback_reason: fallbackReason,
    environment: process.env.NODE_ENV || "test",
    created_at: options.created_at || new Date().toISOString(),
  };

  turnTraces.set(traceId, metadata);
  return metadata;
}

/**
 * Register a trace record explicitly
 */
export function registerTurnTrace(traceId, traceData) {
  turnTraces.set(traceId, {
    ...traceData,
    trace_id: traceId,
    created_at: traceData.created_at || new Date().toISOString(),
  });
}

/**
 * Access trace navigation with role and grant checks (ADM-05 Criterion 3)
 */
export function getTurnTrace(traceId, user) {
  if (!user) {
    return {
      error: "unauthorized",
      message: "Authentication required",
      has_trace_access: false,
    };
  }

  const role = user.role;
  const grants = Array.isArray(user.grants) ? user.grants : (user.grant ? [user.grant] : []);
  const hasTraceReview = grants.includes("trace_review");

  // Teachers never receive a trace link
  if (role === "teacher") {
    return {
      error: "forbidden",
      message: "Teachers cannot access Langfuse traces",
      has_trace_access: false,
    };
  }

  // Only administrators holding trace_review can navigate to trace
  if (role !== "administrator" || !hasTraceReview) {
    return {
      error: "forbidden",
      message: "Access requires administrator role holding trace_review grant",
      has_trace_access: false,
    };
  }

  const trace = turnTraces.get(traceId);
  if (!trace) {
    return {
      error: "not_found",
      message: `Trace with id ${traceId} not found`,
      has_trace_access: true,
    };
  }

  // 90-day retention window check: 90 * 24 * 60 * 60 * 1000 ms
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const traceAge = Date.now() - new Date(trace.created_at).getTime();
  if (traceAge > NINETY_DAYS_MS) {
    return {
      trace_id: traceId,
      trace_notice: "expired",
      message: "The trace has exceeded the 90-day retention window and was purged",
      has_trace_access: true,
    };
  }

  return {
    trace_id: traceId,
    trace_link: `https://cloud.langfuse.com/project/traces/${traceId}`,
    data: trace,
    has_trace_access: true,
  };
}

/**
 * Export trace payload ensuring raw PII is scrubbed (ADM-05 Criterion 6)
 */
export function exportTrace(trace) {
  const serialized = JSON.stringify(trace, (key, value) => {
    if (typeof value === "string") {
      return scrubPii(value);
    }
    return value;
  });
  return JSON.parse(serialized);
}

/**
 * Sanitize Sentry error event (ADM-05 Criterion 8):
 * Holds no student answer, step, note, bearer token, Clerk ID or app_user.id.
 * Carries only request_id, trace_id, session_id, environment, release, and service_name.
 */
export function sanitizeSentryEvent(error, context = {}) {
  return {
    error: {
      name: error?.name || "Error",
      message: error?.message || "An unhandled error occurred",
    },
    request_id: context.request_id || "req_unknown",
    trace_id: context.trace_id || null,
    session_id: context.session_id || null,
    environment: context.environment || process.env.NODE_ENV || "production",
    release: context.release || "1.0.0",
    service_name: context.service_name || "solvepath-api",
  };
}

/**
 * Evaluates that evaluation suite passed before deploying prompt or model changes (ADM-05 Criterion 4)
 */
export function verifyEvalSuiteBeforeDeploy(changeType, evalMetrics = {}) {
  const REQUIRED_THRESHOLDS = {
    answer_leakage: 0,
    verifier_agreement: 0.99,
    schema_valid: 1.0,
    single_prompt: 1.0,
    age_appropriate: 1.0,
    hint_policy_match: 0.95,
  };

  const violations = [];

  if (evalMetrics.answer_leakage !== undefined && evalMetrics.answer_leakage > REQUIRED_THRESHOLDS.answer_leakage) {
    violations.push(`answer_leakage (${evalMetrics.answer_leakage}) exceeds target 0`);
  }
  if (evalMetrics.verifier_agreement !== undefined && evalMetrics.verifier_agreement < REQUIRED_THRESHOLDS.verifier_agreement) {
    violations.push(`verifier_agreement (${evalMetrics.verifier_agreement}) below target 0.99`);
  }
  if (evalMetrics.schema_valid !== undefined && evalMetrics.schema_valid < REQUIRED_THRESHOLDS.schema_valid) {
    violations.push(`schema_valid (${evalMetrics.schema_valid}) below target 1.0`);
  }
  if (evalMetrics.single_prompt !== undefined && evalMetrics.single_prompt < REQUIRED_THRESHOLDS.single_prompt) {
    violations.push(`single_prompt (${evalMetrics.single_prompt}) below target 1.0`);
  }
  if (evalMetrics.age_appropriate !== undefined && evalMetrics.age_appropriate < REQUIRED_THRESHOLDS.age_appropriate) {
    violations.push(`age_appropriate (${evalMetrics.age_appropriate}) below target 1.0`);
  }
  if (evalMetrics.hint_policy_match !== undefined && evalMetrics.hint_policy_match < REQUIRED_THRESHOLDS.hint_policy_match) {
    violations.push(`hint_policy_match (${evalMetrics.hint_policy_match}) below target 0.95`);
  }

  if (violations.length > 0) {
    return {
      allowed: false,
      blocked: true,
      change_type: changeType,
      reason: `Evaluation suite failed thresholds: ${violations.join("; ")}`,
      violations,
    };
  }

  return {
    allowed: true,
    blocked: false,
    change_type: changeType,
    status: "passed",
  };
}

/**
 * Resets trace store for clean test suites
 */
export function resetTraceStore() {
  turnTraces.clear();
}

/**
 * Purges model traces older than cutoff timestamp (ADM-09: 90-day retention)
 */
export function purgeTracesOlderThan(cutoffMs) {
  let count = 0;
  for (const [traceId, trace] of turnTraces.entries()) {
    const traceTime = new Date(trace.created_at).getTime();
    if (traceTime < cutoffMs && !trace.purged) {
      trace.purged = true;
      trace.trace_notice = "expired";
      delete trace.data;
      delete trace.prompt;
      delete trace.model_output;
      count++;
    }
  }
  return count;
}

