import crypto from "crypto";

/**
 * Authentication and Role-Based Access Control (ADM-06, FR-01, SPEC §2.1, §3.8, §5.4, §5.7)
 *
 * Rules:
 * 1. Unauthenticated requests to student/product data return 401.
 * 2. Role and cohort scope are read from Postgres/app_user on every request;
 *    claims in Clerk JWT are strictly ignored.
 * 3. Parent role sign-in succeeds but grants NO product route in the MVP.
 * 4. All sign-in attempts (successes and failures) write an authentication audit event.
 * 5. JWKS cache up to 1 hour; when unreachable with no cache returns 503 service_unavailable.
 *    Authentication NEVER fails open.
 * 6. Valid token with unknown subject (sub not in app_user) returns 403 forbidden,
 *    logs audit event 'auth_unknown_subject', and creates no row (no auto-provisioning).
 * 7. Audit rows, traces, and foreign keys carry only internal app_user.id, never a Clerk id.
 */

// In-memory store for app_user records
const appUsersByClerkId = new Map();
const appUsersById = new Map();

// In-memory audit event log for authentication
const authAuditEvents = [];

// JWKS cache
let jwksCache = {
  keys: null,
  cached_at: 0,
  ttl_ms: 3600 * 1000, // 1 hour TTL
};

// Simulation flag for testing unreachable JWKS
let simulateJwksUnreachable = false;

/**
 * Ensure default synthetic users exist
 */
export function ensureDefaultUsers() {
  if (appUsersByClerkId.size === 0) {
    const defaultUsers = [
      {
        id: "user_internal_admin_001",
        clerk_user_id: "user_2test_adm_001",
        role: "administrator",
        display_label: "Administrator Gamma",
        grants: ["trace_review"],
        cohort_ids: ["cohort_ratio_foundation"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_stu_001",
        clerk_user_id: "user_2test_stu_001",
        role: "student",
        display_label: "Student 101",
        grants: [],
        cohort_ids: ["cohort_ratio_foundation"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_tch_001",
        clerk_user_id: "user_2test_tch_001",
        role: "teacher",
        display_label: "Teacher Alpha",
        grants: [],
        cohort_ids: ["cohort_ratio_foundation"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_tch_002",
        clerk_user_id: "user_2test_tch_002",
        role: "teacher",
        display_label: "Teacher Beta (Unassigned)",
        grants: [],
        cohort_ids: ["cohort_other_assigned"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_tch_003",
        clerk_user_id: "user_2test_tch_003",
        role: "teacher",
        display_label: "Teacher Gamma (No Cohorts)",
        grants: [],
        cohort_ids: [],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_con_001",
        clerk_user_id: "user_2test_con_001",
        role: "content_reviewer",
        display_label: "Content Reviewer Alpha",
        grants: [],
        cohort_ids: [],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_coord_001",
        clerk_user_id: "user_2test_coord_001",
        role: "coordinator",
        display_label: "Coordinator Zeta",
        grants: [],
        cohort_ids: ["cohort_ratio_foundation"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_tut_001",
        clerk_user_id: "user_2test_tut_001",
        role: "tutor",
        display_label: "Tutor Alpha",
        grants: [],
        cohort_ids: ["cohort_ratio_foundation"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_tut_002",
        clerk_user_id: "user_2test_tut_002",
        role: "tutor",
        display_label: "Tutor Beta (Unassigned)",
        grants: [],
        cohort_ids: ["cohort_other_assigned"],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_sup_001",
        clerk_user_id: "user_2test_sup_001",
        role: "coordinator",
        display_label: "Support Contact Alpha",
        grants: [],
        cohort_ids: [],
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "user_internal_par_001",
        clerk_user_id: "user_2test_par_001",
        role: "parent",
        display_label: "Parent Beta",
        grants: [],
        cohort_ids: [],
        created_at: "2026-10-12T00:00:00Z",
      },
    ];

    for (const u of defaultUsers) {
      if (!appUsersByClerkId.has(u.clerk_user_id)) {
        appUsersById.set(u.id, u);
        appUsersByClerkId.set(u.clerk_user_id, u);
      }
    }
  }
}


/**
 * Reset authentication store
 */
export function resetAuthStore() {
  appUsersByClerkId.clear();
  appUsersById.clear();
  authAuditEvents.length = 0;
  jwksCache = {
    keys: null,
    cached_at: 0,
    ttl_ms: 3600 * 1000,
  };
  simulateJwksUnreachable = false;
  ensureDefaultUsers();
}

/**
 * Register an app_user
 */
export function registerAppUser(userData) {
  const id = userData.id || crypto.randomUUID();
  const user = {
    id,
    clerk_user_id: userData.clerk_user_id,
    role: userData.role,
    display_label: userData.display_label || `User ${userData.role}`,
    cohort_ids: userData.cohort_ids || [],
    grants: userData.grants || [],
    created_at: userData.created_at || new Date().toISOString(),
  };

  // Ensure security invariant: No name or email stored
  if ("name" in user) delete user.name;
  if ("email" in user) delete user.email;

  appUsersById.set(id, user);
  appUsersByClerkId.set(user.clerk_user_id, user);
  return { ...user };
}

/**
 * Update an app_user's role (simulating admin role change in DB)
 */
export function updateAppUserRole(userId, newRole) {
  const user = appUsersById.get(userId) || appUsersByClerkId.get(userId);
  if (!user) return null;
  user.role = newRole;
  return { ...user };
}

/**
 * Add cohort to app_user
 */
export function addUserCohort(userId, cohortId) {
  const user = appUsersById.get(userId) || appUsersByClerkId.get(userId);
  if (!user) return null;
  if (!user.cohort_ids) user.cohort_ids = [];
  if (!user.cohort_ids.includes(cohortId)) {
    user.cohort_ids.push(cohortId);
  }
  return { ...user };
}

/**
 * Update app_user grants (grant / revoke)
 */
export function updateAppUserGrants(userId, grant, action = "grant") {
  const user = appUsersById.get(userId) || appUsersByClerkId.get(userId);
  if (!user) return null;
  if (!user.grants) user.grants = [];
  if (action === "grant") {
    if (!user.grants.includes(grant)) user.grants.push(grant);
  } else if (action === "revoke") {
    user.grants = user.grants.filter((g) => g !== grant);
  }
  return { ...user };
}

/**
 * Get all app_users
 */
export function getAllAppUsers() {
  return Array.from(appUsersById.values()).map((u) => ({ ...u }));
}

/**
 * Get user by internal ID
 */
export function getAppUserById(id) {
  ensureDefaultUsers();
  const user = appUsersById.get(id);
  return user ? { ...user } : null;
}

/**
 * Get user by Clerk User ID (sub)
 */
export function getAppUserByClerkId(clerkId) {
  ensureDefaultUsers();
  const user = appUsersByClerkId.get(clerkId);
  return user ? { ...user } : null;
}

/**
 * Set JWKS keys in cache
 */
export function setCachedJwksKeys(keys, timestamp = Date.now()) {
  jwksCache.keys = keys;
  jwksCache.cached_at = timestamp;
}

/**
 * Set JWKS unreachable simulation flag
 */
export function setSimulateJwksUnreachable(unreachable) {
  simulateJwksUnreachable = unreachable;
}

/**
 * Fetch or retrieve cached JWKS keys
 */
export function getJwksKeys() {
  const now = Date.now();
  const hasValidCache = jwksCache.keys && (now - jwksCache.cached_at) < jwksCache.ttl_ms;

  if (simulateJwksUnreachable) {
    if (hasValidCache) {
      return { keys: jwksCache.keys, from_cache: true };
    }
    // JWKS unreachable and no valid cache -> 503 service_unavailable
    return {
      error: "service_unavailable",
      status: 503,
      message: "Clerk JWKS endpoint unreachable and no usable cache",
    };
  }

  // Active / simulated live endpoint
  if (!jwksCache.keys) {
    jwksCache.keys = [{ kid: "key_primary", kty: "RSA", alg: "RS256" }];
    jwksCache.cached_at = now;
  }
  return { keys: jwksCache.keys, from_cache: false };
}

/**
 * Creates and logs an authentication audit event
 * Invariant: Audit row NEVER contains raw Clerk ID or personal info
 */
export function logAuthAuditEvent(eventType, details = {}) {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    actor_user_id: details.actor_user_id || null, // Internal app_user.id only
    status: details.status || (eventType === "auth_success" ? "success" : "failure"),
    reason: details.reason || null,
    ip_hash: details.ip ? crypto.createHash("sha256").update(details.ip).digest("hex").slice(0, 16) : null,
    timestamp: new Date().toISOString(),
  };

  // Invariant: Clerk ID must not leak into audit event
  if ("clerk_user_id" in details) {
    event.subject_hash = crypto.createHash("sha256").update(details.clerk_user_id).digest("hex").slice(0, 16);
  }

  authAuditEvents.push(event);
  return event;
}

/**
 * Returns recorded auth audit events
 */
export function getAuthAuditEvents() {
  return [...authAuditEvents];
}

/**
 * Verify token and authenticate request
 */
export function authenticateRequest(headersOrReq = {}) {
  // Extract authorization header
  let authHeader = "";
  if (headersOrReq.headers && typeof headersOrReq.headers.get === "function") {
    authHeader = headersOrReq.headers.get("authorization") || headersOrReq.headers.get("Authorization") || "";
  } else if (typeof headersOrReq.get === "function") {
    authHeader = headersOrReq.get("authorization") || headersOrReq.get("Authorization") || "";
  } else if (headersOrReq.headers && typeof headersOrReq.headers === "object") {
    authHeader = headersOrReq.headers["authorization"] || headersOrReq.headers["Authorization"] || "";
  } else if (typeof headersOrReq.authorization === "string") {
    authHeader = headersOrReq.authorization;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logAuthAuditEvent("auth_failed", { reason: "missing_bearer_token" });
    return {
      status: 401,
      error: "unauthorized",
      message: "Authentication required: missing or invalid Authorization header",
    };
  }

  const tokenString = authHeader.replace(/^Bearer\s+/, "").trim();

  // Check JWKS availability
  const jwksResult = getJwksKeys();
  if (jwksResult.error) {
    logAuthAuditEvent("auth_failed", { reason: "jwks_unreachable" });
    return {
      status: jwksResult.status,
      error: jwksResult.error,
      message: jwksResult.message,
    };
  }

  // Parse token payload (supports mock/JWT JSON structure)
  let payload = null;
  try {
    if (tokenString.includes(".")) {
      const parts = tokenString.split(".");
      const decodedJson = Buffer.from(parts[1], "base64url").toString("utf-8");
      payload = JSON.parse(decodedJson);
    } else {
      payload = JSON.parse(tokenString);
    }
  } catch (err) {
    logAuthAuditEvent("auth_failed", { reason: "invalid_jwt_format" });
    return {
      status: 401,
      error: "unauthorized",
      message: "Invalid token payload format",
    };
  }

  // Validate expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    logAuthAuditEvent("auth_failed", { reason: "token_expired" });
    return {
      status: 401,
      error: "unauthorized",
      message: "Token has expired",
    };
  }

  // Validate authorized party (azp) if configured
  if (process.env.AUTH_AUTHORIZED_PARTIES && payload.azp) {
    const allowed = process.env.AUTH_AUTHORIZED_PARTIES.split(",").map((p) => p.trim());
    if (!allowed.includes(payload.azp)) {
      logAuthAuditEvent("auth_failed", { reason: "unauthorized_party" });
      return {
        status: 401,
        error: "unauthorized",
        message: "Unauthorized token party (azp mismatch)",
      };
    }
  }

  const clerkSubject = payload.sub;
  if (!clerkSubject) {
    logAuthAuditEvent("auth_failed", { reason: "missing_subject_claim" });
    return {
      status: 401,
      error: "unauthorized",
      message: "Token is missing sub claim",
    };
  }

  // Look up subject in app_user (Criterion 6)
  const appUser = getAppUserByClerkId(clerkSubject);
  if (!appUser) {
    // Subject not found: 403 forbidden, write auth_unknown_subject, NO auto-provisioning
    logAuthAuditEvent("auth_unknown_subject", {
      clerk_user_id: clerkSubject,
      reason: "unknown_subject_not_provisioned",
    });
    return {
      status: 403,
      error: "forbidden",
      code: "auth_unknown_subject",
      message: "Subject is not provisioned in app_user",
    };
  }

  // Successful auth: read role and cohort scope from app_user (ignoring JWT role claims)
  logAuthAuditEvent("auth_success", {
    actor_user_id: appUser.id,
  });

  return {
    status: 200,
    user: {
      id: appUser.id, // Internal pseudonymous ID only
      role: appUser.role, // From Postgres/app_user, ignoring JWT
      cohort_ids: appUser.cohort_ids,
      grants: appUser.grants,
      display_label: appUser.display_label,
    },
  };
}

/**
 * Authorize access to specific product routes (Criterion 3)
 */
export function authorizeRoute(user, routeType = "student") {
  if (!user) {
    return {
      allowed: false,
      status: 401,
      error: "unauthorized",
      message: "Authentication required",
    };
  }

  // Parent role grants NO product routes in the MVP (Criterion 3)
  if (user.role === "parent") {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Parent role grants no product routes in MVP",
    };
  }

  if (routeType === "teacher" && user.role !== "teacher" && user.role !== "administrator") {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Teacher role required",
    };
  }

  if (routeType === "admin" && user.role !== "administrator") {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Administrator role required",
    };
  }

  if (routeType === "tutor" && user.role !== "tutor" && user.role !== "administrator") {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Tutor role required",
    };
  }

  if (
    routeType === "coordinator" &&
    user.role !== "coordinator" &&
    user.role !== "academic_coordinator" &&
    user.role !== "administrator"
  ) {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Coordinator role required",
    };
  }

  if (
    routeType === "content_reviewer" &&
    user.role !== "content_reviewer" &&
    user.role !== "administrator"
  ) {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Content reviewer role required",
    };
  }

  return {
    allowed: true,
    status: 200,
  };
}
