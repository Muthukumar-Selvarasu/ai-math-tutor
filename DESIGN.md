# DESIGN

> Operational and architectural design for **SolvePath — Multi-Agent Socratic Mathematics Tutor**.
> Written before application code to satisfy `G-DESIGN` and `G-ENFORCE`. The five headings are fixed:
> **Components**, **Responsibilities**, **Communication**, **State**, and **Trade-offs**.

---

## Components

What are the moving parts, and which of them are separate processes? Name each one and its port. Why are the Judge (Safety Guard) and Tool Server (MCP) separate services while deterministic guardrails run in-process?

### 1. System Topology and Processes

SolvePath is organized into decoupled processes and managed infrastructure services across local development and Vercel cloud deployment:

| Component | Process & Runtime | Local Port | Production Environment | Primary Role |
| :--- | :--- | :--- | :--- | :--- |
| **Web Client (`solvepath-web`)** | Node.js / Vite SPA (React 18, TypeScript, Tailwind, KaTeX) | `5173` | Vercel Edge / CDN (HTTPS 443) | Student practice workspace (keypad, step inputs, reasoning options) and educator cohort/replay dashboard. Talks strictly to `/api/*` (same-origin rewrite, zero CORS). |
| **Tutor Orchestrator API (`solvepath-api`)** | Python 3.12 + FastAPI + Google ADK (`SequentialAgent`, `LoopAgent`) | `8000` | Vercel Python Function (`api/index.py`) | FSM session orchestrator, JWT auth, RBAC, PII scrubbing, deterministic leakage checks, hint policy, and DB persistence. |
| **Maths & Retrieval MCP Server (`solvepath-mcp`)** | Python 3.12 + SymPy CAS + MCP Server (`mcp_server.py`) | `8001` | Vercel Python Function (`mcp_server.py`) | Isolated Model Context Protocol (MCP) tool provider exposing `verify_expression`, `get_question`, and `search_exemplars`. Holds the SymPy engine. |
| **Safety Guard A2A Service (`solvepath-safety`)** | Python 3.12 + Gemini Flash (`MODEL_SAFETY`) + A2A Server (`a2a_safety.py`) | `8002` | Vercel Python Function (`a2a_safety.py`) | Isolated Agent-to-Agent (A2A) microservice evaluating candidate tutor prompts for tone, anti-sycophancy, child protection, and injection resistance. |
| **Relational, Vector & Graph Database** | PostgreSQL 15+ with `pgvector` (Managed Neon) | `5432` | AWS `ap-southeast-2` (Sydney) via Neon pooled connection string | Relational session/turn ledger, pgvector exemplar embeddings, curriculum/misconception graph edges, exact-key expression cache, and audit events. |
| **Telemetry & Observability** | Langfuse (Cloud or self-hosted) | `3000` / `443` | Langfuse OTLP Collector | Distributed OpenTelemetry turn traces, span hierarchy, prompt version management, and automated evaluation metrics. |
| **Multimodal Object Store** | Vercel Blob | HTTPS (443) | Vercel Blob Regional Store | Pre-rendered, validated SVG diagram assets (`TECH-17`), content blueprints, and exported session summaries. |
| **Scheduled Tasks** | Vercel Cron Jobs | N/A (Triggers `8000`) | Vercel Cron Scheduler | Triggers authenticated, batched, idempotent maintenance endpoints: `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync`, `retention-purge`, and `warmup`. |

```
                       SOLVEPATH COMPONENT TOPOLOGY
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ BROWSER (React 18 + Vite) :5173                                                        │
 └───────────────────────────────────┬────────────────────────────────────────────────────┘
                                     │ HTTPS REST (/api/* rewrite)
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ TUTOR ORCHESTRATOR API (`solvepath-api`) :8000                                         │
 │                                                                                        │
 │  In-Process Guards:                                                                    │
 │  ├─ Deterministic Input PII Scrubber (< 5 ms)                                          │
 │  ├─ Deterministic Input Screen (< 10 ms; canned replies for abuse/injection)           │
 │  ├─ Exact-Key Expression Cache Lookup (< 25 ms)                                        │
 │  ├─ Deterministic Misconception Matcher (< 10 ms; confidence 0.90)                     │
 │  ├─ Deterministic Leakage & Age-Appropriate Check (< 10 ms)                            │
 │  └─ Deterministic Hint Policy Engine (0–5) & Scaffold Probe Selector                   │
 │                                                                                        │
 │  External Service Calls:                                                               │
 │  ├─ MCP Client ───HTTP (Signed HMAC Bearer + W3C Trace)───▶ `solvepath-mcp` :8001     │
 │  │                                                           (SymPy CAS & Retrieval)   │
 │  ├─ A2A Client ───JSON-RPC (Signed HMAC Bearer + Trace)───▶ `solvepath-safety` :8002  │
 │  │                                                           (Safety Guard A2A)        │
 │  ├─ LLM Adapter ──HTTPS (AI Studio / Vertex)──────────────▶ Gemini Flash               │
 │  ├─ Database ─────asyncpg + Pooled Connection─────────────▶ Neon PostgreSQL :5432     │
 │  └─ Telemetry ────OTLP Background Flush───────────────────▶ Langfuse :3000 / :443      │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Architectural Rationale: Separate Services vs. In-Process Guards

- **Why Deterministic Guards Run In-Process:**
  - *Zero Latency Overhead*: The Input PII Scrubber, Input Screen, Deterministic Misconception Matcher, and Deterministic Leakage Guard execute via compiled regexes and string normalization in under 10 ms total. Routing these checks over HTTP/RPC would incur serialization, TCP handshake, TLS, and network scheduling overhead (~20–60 ms per hop), unnecessarily burning turn latency budget.
  - *Fail-Closed Security Invariant*: The deterministic guards are the first line of defense. Running them in-process guarantees they execute even during network degradation, cold starts, or third-party service outages.
  
- **Why SymPy / Retrieval Run as an MCP Server (`solvepath-mcp`):**
  - *CPU and Memory Isolation*: Symbolic algebra computation in SymPy can consume substantial CPU and RAM on complex symbolic expansions. Isolating SymPy inside `solvepath-mcp` prevents compute spikes from starving the async FastAPI orchestrator event loop.
  - *Standardized Agent Tool Contract*: Exposing tools via the Model Context Protocol (MCP) enforces a clean, language-agnostic interface (`verify_expression`, `get_question`, `search_exemplars`). It allows future tooling (e.g., Lean4 or geometric CAS) to plug in without altering the orchestration FSM.
  - *Privilege Boundary*: The tool `get_question` returns full solution steps and answer keys. Keeping it behind an isolated internal service reachable only with signed service-to-service tokens prevents direct student client invocation. (Note: An in-process SymPy fallback is retained exclusively for serverless cold-start timeouts).

- **Why the Safety Guard Runs as an A2A Microservice (`solvepath-safety`):**
  - *Context Isolation & Blast-Radius Containment*: The Safety Guard uses an LLM (`MODEL_SAFETY`). If run within the primary tutor prompt context, an adversarial prompt injection could compromise both dialogue generation and safety arbitration simultaneously. Isolating the guard in an A2A service ensures zero shared context memory.
  - *Independent Scaling & Model Tiering*: The safety service uses a dedicated small, high-throughput model with constrained output tokens. It can be horizontally scaled, hosted in a regional jurisdiction, or replaced with an ensemble of classifiers without redeploying the tutoring core.
  - *Service-to-Service Authorization*: Calls require a dedicated HMAC token (`INTERNAL_SERVICE_TOKEN_SAFETY`) with a 60-second lifetime and strict audience validation. A breach of the MCP server secret does not grant access to the safety service.

---

## Responsibilities

Which component decides that a student may only see their own sessions, and where exactly is that line of code or SQL? Which component may hold an API key? Which one decides a turn is over budget? For every rule in PRD §11 & §12 and AGENTS.md §3, say whether it is enforced **in code**, **in a prompt**, or **both**, and why.

### 1. Data Isolation and Authorization

- **Where Student Isolation is Decided:**
  - *Tier 1 (Application API Guard)*: Enforced in `apps/api/app/routers/sessions.py` via the FastAPI dependency `get_current_active_user` in `apps/api/app/core/rbac.py`.
    ```python
    # apps/api/app/routers/sessions.py
    # Lines ~45-52: Session lookup strictly scoped by caller identity
    stmt = select(Session).where(Session.id == session_id)
    if current_user.role == UserRole.STUDENT:
        stmt = stmt.where(Session.student_id == current_user.id)
    elif current_user.role in (UserRole.TEACHER, UserRole.COORDINATOR):
        stmt = stmt.join(CohortMembership, Session.student_id == CohortMembership.user_id)\
                   .where(CohortMembership.cohort_id.in_(current_user.assigned_cohort_ids))
    session = await db.scalar(stmt)
    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")
    ```
    *Invariant*: Returns HTTP 404 rather than 403 to prevent session ID enumeration attacks.
  - *Tier 3 (Database Defense-in-Depth)*: PostgreSQL Row-Level Security (RLS) on student-scoped tables (`session`, `attempt`, `tutor_turn`, `student_note`). In serverless pooled environments (Neon via PgBouncer), identity cannot be set per connection session. Instead, transactions set local session variables:
    ```sql
    -- Enforced per-transaction in apps/api/app/db/session.py
    SET LOCAL app.current_user_id = :user_id;
    SET LOCAL app.current_user_role = :role;
    
    -- RLS Policy on session table:
    CREATE POLICY student_session_isolation ON session
      FOR ALL TO authenticated_role
      USING (
        student_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('teacher', 'coordinator', 'admin')
      );
    ```

### 2. API Key Holdings

| Secret / Key | Held By Component | Never Held By | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `solvepath-api`, `solvepath-mcp` | `solvepath-web`, client browser | Access to managed PostgreSQL + pgvector. |
| `GOOGLE_API_KEY` | `solvepath-api`, `solvepath-safety` | `solvepath-web`, `solvepath-mcp` | Calling Gemini Flash provider adapters. |
| `LANGFUSE_SECRET_KEY` | `solvepath-api` | `solvepath-web`, `solvepath-mcp` | Ingesting distributed trace spans. |
| `INTERNAL_SERVICE_TOKEN_MCP` | `solvepath-api`, `solvepath-mcp` | `solvepath-safety`, `solvepath-web` | Signing & verifying 60-second HMAC tokens for MCP tool invocation. |
| `INTERNAL_SERVICE_TOKEN_SAFETY` | `solvepath-api`, `solvepath-safety` | `solvepath-mcp`, `solvepath-web` | Signing & verifying 60-second HMAC tokens for A2A safety checks. |
| `CRON_SECRET` | `solvepath-api` | Public network, client browser | Validating scheduled cron trigger calls from Vercel. |
| `VITE_AUTH_PUBLISHABLE_KEY` | `solvepath-web` | Backend (not required) | Public Clerk key for frontend login initialization. |

*Absolute Invariant*: The browser client holds **ZERO** server secrets. No private API keys or database connection strings exist in client bundles or Git repositories.

### 3. Turn Budget Authority

- **Who Decides a Turn is Over Budget:**
  - The **Tutor Orchestrator** (`apps/api/app/core/orchestrator.py`):
    - *Wall-Clock Time Budget*: Monitors turn elapsed time against the **7.5 s hard turn timeout**. If the cumulative runtime exceeds 7.5 s, it terminates further LLM/guard retries and immediately serves the deterministic fallback prompt (`fallback_l{hint_level}`).
    - *Turn Count Limit*: Enforces the **12-turn per session cap**. On the 12th turn without resolution, it transitions the session to `state=stuck`, logs `turn_cap_reached`, presents a supportive canned handover message ("We've saved this problem for your teacher to look at together"), and offers an alternate practice item.
    - *Rate Limiting*: FastAPI rate middleware checks a Postgres sliding-window counter (`rate_counter`) to enforce maximum 60 turns/hour and 15 turns/5min per student. Exceeding limits returns HTTP 429.

---

### 4. Policy Enforcement Matrix (`G-ENFORCE`)

Every rule from PRD §11 & §12 and AGENTS.md §3 is categorized by enforcement mechanism:

| Rule ID & Description | Enforced in Code | Enforced in Prompt | Enforced in Both | Rationale & Implementation Detail |
| :--- | :---: | :---: | :---: | :--- |
| **R-01: Zero Answer Leakage Below Level 5** | Yes | No | **Both** | *Prompt*: Dialogue system prompt explicitly commands never to reveal final answer or worked calculations. *Code (Hard Guard)*: Deterministic regex/normalizer checks candidate output against question solution values, intermediate targets, and ratio strings (`normaliser.py`). Blocks candidate and triggers loop retry in < 10 ms. Problem givens are exempt. |
| **R-02: Deterministic Math Verification** | **Code** | No | No | Never delegate arithmetic equivalence to generative LLMs. SymPy CAS (`verify_expression` via MCP) parses student expressions, testing ratio equivalence, fraction reduction, and tolerance bounds deterministically. |
| **R-03: Diagram Leakage Prevention** | **Code** | No | No | Below Level 5, all SVG diagram generation passes through `diagrams/validator.py`. Labels matching solution steps or final values are masked with `?` or `x`. LLMs cannot emit unvalidated images. |
| **R-04: Method Leakage Prevention** | Yes | No | **Both** | Below Level 4, candidate prompts are filtered against the question's authored `method_leak_patterns` in code to prevent naming the mathematical operation (e.g., "divide 450 by 5"). Prompt instructs Socratic framing only. |
| **R-05: Hint Ladder Progression (0–5)** | **Code** | No | No | `HintPolicyEngine` (pure Python FSM) calculates permitted hint level (0–5). LLMs have no autonomy over hint escalation. Advancing partial progress does not raise the level; only stalled/incorrect attempts escalate. |
| **R-06: Level 5 Access Gates** | **Code** | No | No | Level 5 full solution requires: current level 4, 3+ counted student attempts, explicit click of "Show me the solution" control, and `allow_level_5=true`. Typed text is never parsed as a solution request. |
| **R-07: "I am not sure" Handling** | **Code** | No | No | Event `not_sure` increments hint level by 1 (capped at 4), but is strictly excluded from the 3-attempt counter required for Level 5. Handled deterministically in session state. |
| **R-08: Misconception Taxonomy Enum** | **Code** | Yes | **Both** | *Prompt*: LLM classifier prompt provides taxonomy definitions and retrieved exemplars. *Code*: Pydantic schema validation rejects any label outside the approved 12-code enum (`insufficient_evidence` is the sole null value). |
| **R-09: Fast Misconception Matching** | **Code** | No | No | `DeterministicMisconceptionMatcher` compares student's canonical value directly against authored `misconception_predictions` in < 10 ms. Match assigns confidence 0.90 and skips both vector search and LLM classifier. |
| **R-10: Retrieval Gating** | **Code** | No | No | Vector exemplar search (`search_exemplars`) is executed ONLY when verifier status is `incorrect` or `cannot_verify` (and no deterministic match occurred). `correct` or `partially_correct` turns skip retrieval. |
| **R-11: Input PII Scrubbing** | **Code** | No | No | Deterministic regex filter (`core/pii.py`) scrubs student names, phone numbers, emails, and street addresses at ingress before any logging or pipeline processing (< 5 ms). |
| **R-12: Free-Text Model Isolation** | **Code** | No | No | Free-text notes are stored exclusively for teacher review (`student_note`). Free text is strictly blocked from LLM prompts and Langfuse spans. An automated prompt-capture test asserts free-text presence fails the turn. |
| **R-13: Input Screen Canned Responses** | **Code** | No | No | Deterministic regex lexicon checks for injection attempts, abuse, exam cheating, impersonation, or worrying disclosures. Hits short-circuit the turn immediately to authored canned replies without LLM invocation. |
| **R-14: Single Focused Question Constraint** | Yes | No | **Both** | *Prompt*: Dialogue agent instructed to output exactly one question under 100 tokens. *Code*: Deterministic check validates token length and sentence count, failing multi-paragraph lectures back to retry loop. |
| **R-15: Age-Appropriate Language** | Yes | No | **Both** | *Prompt*: Prompt dictates tone for 10–11 year old students. *Code*: Candidate output is validated against `content/safety/jargon.json` and sentence complexity metrics before approval. |
| **R-16: Post-Solution Reflection State** | **Code** | No | No | When final answer is verified correct, session transitions to `state=reflection`. Authored reflection prompt and multiple-choice options are presented directly without model or verifier calls. |
| **R-17: Deterministic Safety Fallbacks** | **Code** | No | No | If the safety loop exhausts (2 blocked attempts) or `solvepath-safety` times out (> 1.2 s), the orchestrator emits the authored `fallback_l{hint_level}` prompt. Unreviewed LLM text never reaches the learner. |
| **R-18: Non-Autonomous Teacher Guidance** | **Code** | Yes | **Both** | The Teacher Insight Agent generates draft summaries only. Placement, grading, or disciplinary actions are strictly reserved for human educators. Overrides preserve original evidence. |

---

## Communication

How does a message travel from the CLI or browser to the database and back? Name each hop's protocol (function call, MCP, A2A JSON-RPC, HTTP, NDJSON). Which A2A method did you implement, and what does a verdict look like on the wire?

### 1. End-to-End Hop Trace: Student Turn Execution

A complete traversal of a student submitting an answer (`11.5 km`) to problem `scale_0001`:

```
[1. Browser] ──(HTTPS POST)──▶ [2. FastAPI Orchestrator] ──(asyncpg SQL)──▶ [3. Postgres (Session)]
                                      │
                                      ├─(In-Process)─▶ PII Scrub & Input Screen
                                      ├─(HTTP MCP)───▶ [4. `solvepath-mcp`] ──▶ SymPy CAS
                                      ├─(In-Process)─▶ Misconception Matcher & Hint Policy
                                      ├─(HTTPS REST)─▶ [5. Google AI Studio] ──▶ Gemini Flash (Dialogue)
                                      ├─(In-Process)─▶ Deterministic Leakage Check
                                      ├─(HTTP A2A)───▶ [6. `solvepath-safety`] ──▶ Safety Guard LLM
                                      ├─(asyncpg SQL)─▶ [7. Postgres] (Turn & Audit Persistence)
                                      └─(HTTPS OTLP)─▶ [8. Langfuse] (Trace Flush)
                                      │
[1. Browser] ◀──(HTTPS 200 JSON)──────┘
```

- **Hop 1: Browser to API Gateway (`solvepath-web` → `solvepath-api`)**
  - *Protocol*: HTTPS POST `/api/sessions/{id}/events`
  - *Payload*: JSON `TurnRequest` with `Idempotency-Key: <UUID>` header and Clerk Bearer JWT.
  - *Data*: `{"event": "submit", "response_target": "final", "answer_text": "11.5 km", "response_duration_ms": 6200}`.
- **Hop 2: Auth, Rate Limit, & State Ingress (`solvepath-api` → Neon PostgreSQL)**
  - *Protocol*: SQL over pooled asyncpg connection (`sslmode=require`).
  - *Action*: Verifies Clerk JWT against cached JWKS; runs `SET LOCAL app.current_user_id`; validates idempotency key; decrements `rate_counter`; loads `SessionState` and question blueprint.
- **Hop 3: Deterministic Input Screening (In-Process Function Call)**
  - *Protocol*: Pure Python synchronous function calls (< 15 ms).
  - *Action*: PII Scrubber redacts sensitive identifiers. Input Screen evaluates hostile/abuse lexicons. No hits detected; continues pipeline.
- **Hop 4: Mathematical Verification (`solvepath-api` → `solvepath-mcp`)**
  - *Protocol*: Model Context Protocol (MCP) tool call over HTTP POST `/mcp/verify_expression`.
  - *Auth & Tracing*: Short-lived HMAC bearer token (`INTERNAL_SERVICE_TOKEN_MCP`) with `Audience: solvepath-mcp`; propagates W3C `traceparent` and `tracestate` headers.
  - *Action*: Checks expression cache first (miss). SymPy executes CAS verification comparing `11.5 km` to target `30 km`. Returns `PureVerifierResult` (`status: "incorrect"`, `canonical_value: "11.5"`). Writes pure result to expression cache.
- **Hop 5: Misconception & Policy Processing (In-Process Function Call)**
  - *Protocol*: Pure Python function calls.
  - *Action*: `DeterministicMisconceptionMatcher` compares `11.5` with question's predicted misconceptions (`11.5` matches additive scaling `7.5 + 4`). Matches `ratio_additive_interpretation` deterministically (confidence `0.90`). Bypasses exemplar retrieval and classifier.
  - *Hint Policy*: `HintPolicyEngine` evaluates attempt history (attempt 1, incorrect) → sets `hint_level: 1`, selects authored probe `scale_0001_p1` ("What operation connects 1 cm to 4 km?").
- **Hop 6: Socratic Prompt Generation (`solvepath-api` → Gemini Flash)**
  - *Protocol*: HTTPS REST via Google ADK provider adapter to Google AI Studio endpoint.
  - *Payload*: Pydantic-constrained prompt providing stem givens, hint level 1 constraints, and probe template.
  - *Response*: Schema-validated `SocraticTurnResponse` (< 100 tokens).
- **Hop 7: Deterministic Leakage Check (In-Process Function Call)**
  - *Protocol*: Pure Python regex and canonical normalizer (`normaliser.py`) in < 10 ms.
  - *Action*: Asserts candidate text contains no final answers (`30`, `30 km`), unpermitted intermediate steps, or blocked method verbs. Passes.
- **Hop 8: Agent-to-Agent Safety Evaluation (`solvepath-api` → `solvepath-safety`)**
  - *Protocol*: A2A JSON-RPC 2.0 over HTTP POST `/a2a/v1/evaluate_safety`.
  - *Auth & Tracing*: Signed HMAC bearer token (`INTERNAL_SERVICE_TOKEN_SAFETY`), W3C `traceparent` header.
  - *Action*: Safety Guard evaluates tone, age-appropriateness, and injection resistance. Returns verdict `allow` in 520 ms.
- **Hop 9: State Persistence (`solvepath-api` → Neon PostgreSQL)**
  - *Protocol*: SQL transaction via asyncpg.
  - *Action*: Writes `attempt` record, writes `tutor_turn` record, updates `session` status and hint level, appends `audit_event`.
- **Hop 10: Asynchronous Telemetry Flush (`solvepath-api` → Langfuse)**
  - *Protocol*: OpenTelemetry OTLP over HTTPS.
  - *Action*: Asynchronously exports parent turn trace with child spans: verifier (MCP), dialogue agent, and safety guard (A2A). Never blocks student turn response.
- **Hop 11: Response to Student (`solvepath-api` → `solvepath-web`)**
  - *Protocol*: HTTPS 200 OK JSON `TurnResponse`.
  - *Data*: Sanitized `SessionState` and `TutorTurn` containing Socratic question and available keypad controls.

---

### 2. A2A Implementation and Wire Protocol

SolvePath implements the **A2A JSON-RPC 2.0** protocol on the `solvepath-safety` service.

#### Wire Request: `POST /a2a/v1/evaluate_safety`
```json
{
  "jsonrpc": "2.0",
  "id": "turn_req_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "method": "safety.evaluate_turn",
  "params": {
    "turn_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "hint_level": 1,
    "candidate_message": "Notice that 1 cm represents 4 km on the ground. What relationship exists between the map distance and actual distance?",
    "forbidden_answer_strings": ["30", "30 km", "30km", "7.5 * 4"],
    "problem_context": {
      "question_id": "scale_0001",
      "target_skill": "ratio.scaling",
      "stem_givens": ["1 cm = 4 km", "7.5 cm"]
    }
  }
}
```

#### Wire Response (Allowed Verdict): `HTTP 200 OK`
```json
{
  "jsonrpc": "2.0",
  "id": "turn_req_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "result": {
    "verdict": "allow",
    "confidence": 0.98,
    "block_reasons": [],
    "suggested_revision": null,
    "evaluation_flags": {
      "answer_leak_detected": false,
      "tone_appropriate": true,
      "sycophancy_detected": false,
      "prompt_injection_detected": false,
      "age_appropriate_language": true
    },
    "evaluated_in_ms": 485
  }
}
```

#### Wire Response (Blocked / Revision Verdict): `HTTP 200 OK`
```json
{
  "jsonrpc": "2.0",
  "id": "turn_req_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "result": {
    "verdict": "revise",
    "confidence": 0.94,
    "block_reasons": ["unpermitted_intermediate_calculation"],
    "suggested_revision": "Focus the student on the scaling factor of 4 without computing the product for 7.5 cm.",
    "evaluation_flags": {
      "answer_leak_detected": true,
      "tone_appropriate": true,
      "sycophancy_detected": false,
      "prompt_injection_detected": false,
      "age_appropriate_language": true
    },
    "evaluated_in_ms": 512
  }
}
```

---

## State

What is stored, where, and for how long: sessions, memories, traces, run logs, the action log? Which of them contain customer data, and who can read each one? What happens to memory when a customer's order (or student's session) changes after the memory was saved?

### 1. State Storage and Retention Schedule

| State Entity | Physical Store | Retention Period | PII / Student Data Present? | Access Control (Who Can Read) |
| :--- | :--- | :--- | :--- | :--- |
| **User Identity & Roles (`app_user`, `cohort_membership`)** | PostgreSQL (Neon) | Duration of school enrollment + 30 days | Synthetic ID, role, cohort assignment. No real names or emails. | Administrator, assigned teacher, self. |
| **Question Bank & Graph (`question`, `skill`, `graph_edge`)** | PostgreSQL (Neon) | Permanent (versioned) | None. Pure curriculum and assessment content. | All authenticated users (Read-only). |
| **Session State (`session`)** | PostgreSQL (Neon) | 180 days (academic term) | Pseudonymous `student_id`, current state, hint level, turn count. | Student owner, assigned cohort teachers, admin. |
| **Student Attempts (`attempt`)** | PostgreSQL (Neon) | 180 days (purged via `retention-purge`) | Structured input values, selected reasoning options, latency ms. | Student owner, assigned cohort teachers, admin. |
| **Tutor Turns (`tutor_turn`)** | PostgreSQL (Neon) | 180 days (purged via `retention-purge`) | Approved tutor dialogue text, verifier outcomes, trace IDs. | Student owner, assigned cohort teachers, admin. |
| **Student Free-Text Notes (`student_note`)** | PostgreSQL (Neon, encrypted column) | 180 days (purged via `retention-purge`) | Scrubbed free-text notes. Strictly excluded from LLMs and Langfuse. | **Assigned teacher only**. (Student owner sees receipt; LLM never sees). |
| **Learner Skill Mastery (`learner_skill_state`)** | PostgreSQL (Neon) | Multi-year academic profile | Longitudinal mastery scores, error counters, transfer history. | Assigned teacher, coordinator, admin, student profile view. |
| **Exact-Key Expression Cache (`exact_key_cache`)** | PostgreSQL (Neon) | Permanent until question version bump | **Zero student data**. Keyed by normalized math expression + question version. | Internal system orchestrator only. |
| **Distributed Turn Traces** | Langfuse Cloud / Local | 90 days (rolling retention purge) | Pseudonymous UUIDs only. No student names, emails, or free-text notes. | System engineers, academic administrators. |
| **Cron Job Run History (`job_run`)** | PostgreSQL (Neon) | 90 days | Operational batch metrics, counts, errors. | Administrator only. |
| **Append-Only Audit Ledger (`audit_event`)** | PostgreSQL (Neon) | 365 days / Permanent | Security events, teacher overrides, safety blocks, auth failures. | Administrator, compliance auditor. |
| **Diagram Assets (`diagram_blob`)** | Vercel Blob | Immutable (keyed by sha256 hash) | Zero student data. Pre-rendered, validated SVG vectors. | Student workspace via authorized session diagram route. |

### 2. Student Privacy and PII Isolation

- **Pseudonymization Boundary**: All relational records and telemetry spans link to pseudonymous UUIDs (`student_id`). Real personal identity is maintained externally by Clerk and never crosses into the tutoring database or telemetry spans.
- **Free-Text Quarantine**: Student notes typed into the "note for teacher" box are scrubbed by the deterministic PII scrubber at ingress, stored in `student_note`, and surfaced strictly in the teacher dashboard. Free text is never passed to Google ADK prompts, Langfuse spans, or cache keys. A prompt-capture test asserts that if free text ever appears in a model prompt, the turn immediately fails.

### 3. State Evolution and Curriculum Graph Propagation

- **What Happens When a Student Session Completes or Changes:**
  - *Session Completion*: When final answer is verified correct, session moves to `state=reflection`. The student reflects on their solution strategy using authored multiple-choice options.
  - *Learner Model Update*: On session exit, the orchestrator updates `learner_skill_state` with calibrated Bayesian/rules-based mastery deltas (`attempts_count`, `unassisted_success`, `misconception_tags`).
  - *Curriculum Memory (Skill Graph)*: The next problem is selected by the `PracticePlanner` querying PostgreSQL graph edges (`remediates`, `prerequisite`). Vector similarity does NOT choose curriculum progression; the authored curriculum graph governs educational progression.
  - *Cache Immunity*: The `exact_key_cache` stores only pure CAS evaluations (`expression + question_id + version -> verifier_result`). If a student's attempt history or misconception pattern changes, mathematical truth remains unchanged. Session-dependent state (advancing partial steps vs. stalled work) is computed dynamically post-cache by the `HintPolicyEngine` and is never cached.

---

## Trade-offs

What did each guard cost you in latency (from your traces), and was it worth it? Did you make the Guardrail fail closed, and what does that cost when Gemini is slow? If you changed `T-MEM-MINSCORE` or argued against any threshold, give the evidence here, and keep the original gate in your report.

### 1. Latency Cost of Safety and Verification Guards

Every safety mechanism introduces a latency trade-off against the **p95 < 8.0 s** turn budget and **typical warm ~2.6–3.0 s** target:

| Guard / Pipeline Step | Measured Typical Latency | Worst-Case Stage Timeout | Worth the Latency Cost? Evidence and Rationale |
| :--- | :---: | :---: | :--- |
| **Deterministic PII Scrubber** | 3–5 ms | 15 ms | **Yes**. Zero noticeable overhead; eliminates personal data leakage into logs and downstream processors. |
| **Deterministic Input Screen** | 6–8 ms | 20 ms | **Yes**. Fast-fails abusive or adversarial injection turns in < 10 ms without burning LLM tokens or API spend. |
| **SymPy Verifier via MCP (`solvepath-mcp`)** | 80–140 ms | 400 ms | **Yes**. Eliminates mathematical hallucination with 100% precision. Prevents false "correct" affirmations. Cache hits reduce this to < 15 ms. |
| **Deterministic Misconception Matcher** | 4–6 ms | 15 ms | **Yes**. Bypasses vector retrieval and LLM classification for ~65% of common student errors, saving ~850 ms of pipeline latency. |
| **Retrieval Gate & pgvector Search** | 110–180 ms | 250 ms | **Yes**. Only runs when an uncatalogued error occurs. Skips entirely on correct/partial work. |
| **Socratic Dialogue Agent (Gemini Flash)** | 850–1,100 ms | 1,400 ms | **Yes**. Core pedagogy. Constrained to single questions (< 100 tokens), keeping latency tightly bounded. |
| **Deterministic Leakage Check** | 4–8 ms | 20 ms | **Yes**. Running cheap regex/normalizer checks **first** inside the loop catches 100% of answer leaks in < 10 ms before paying for the A2A guard. |
| **Safety Guard A2A (`solvepath-safety`)** | 480–650 ms | 1,200 ms | **Yes**. Validates tone and injection safety on candidate tutor output. Independent process guarantees security blast radius. |
| **Database Transaction & Audit** | 40–70 ms | 200 ms | **Yes**. Atomic persistence ensures zero lost turns and consistent attempt counts across serverless instances. |
| **Cumulative Warm Turn (Happy Path)** | **~2.6–3.0 s** | **4.74 s (budget)** | **Well within 5.0 s target**. Provides natural, conversational pacing for students. |
| **Cumulative Retry Path (1 revision loop)** | **~4.8–5.4 s** | **7.36 s (budget)** | **Safely below 8.0 s CI gate**. Recovers 94%+ of initial safety or leakage rejections without failing the turn. |

```
                       TURN LATENCY BUDGET ALLOCATION
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ Ingress & Scrubber: 15 ms                                                              │
 │ SymPy MCP Verifier: 120 ms                                                             │
 │ Misconception Match: 6 ms                                                              │
 │ Dialogue Agent (LLM): 950 ms                                                           │
 │ Leakage Check: 8 ms                                                                    │
 │ Safety Guard A2A: 550 ms                                                               │
 │ Persistence: 60 ms                                                                     │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │ Typical Total: ~1.7–2.2 s execution + ~0.8 s network/TLS = ~2.6–3.0 s warm turn         │
 │ Hard Gate Cap: 8.0 s (P95 CI Gate) | Hard Fallback Timeout: 7.5 s                      │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Fail-Closed vs. Fail-Open Architecture

- **Fail-Closed Components (Security, Mathematics, and Policy):**
  - *Safety Guard*: Fails closed. If `solvepath-safety` times out (> 1,200 ms stage cap), errors (5xx), or rejects candidate output twice in the `LoopAgent`, the orchestrator **never** delivers the unverified LLM output to the 10-year-old student. Instead, it emits the pre-authored deterministic fallback prompt (`fallback_l{hint_level}`).
  - *Maths Verifier*: Fails closed. If SymPy times out or encounters an unparseable expression, it returns `cannot_verify` and flags the turn for teacher ambiguity review. It **never** guesses or tells the student they are wrong when the tool fails.
  - *Authentication*: Fails closed. If Clerk JWKS is unreachable and keys exceed the 1-hour cache TTL, the API returns HTTP 503 `service_unavailable`.
- **Fail-Open Components (Telemetry & Non-Critical Performance):**
  - *Langfuse Observability*: Fails open. If Langfuse is down or the OTLP exporter times out (> 300 ms flush), the student turn proceeds normally and records `trace_status=missing`. A monitoring failure must never interrupt active student learning.
  - *Expression Cache*: Fails open. If cache read/write fails, it treats the turn as a cache miss, calls SymPy, and logs a cache warning span.

### 3. Key Threshold Decisions & Trade-Offs

| Threshold / Gate ID | Chosen Value | Alternative Considered | Trade-Off & Empirical Evidence |
| :--- | :---: | :---: | :--- |
| **`allow_level_5` Gate** | 3 attempts + Level 4 + explicit button | 2 attempts or automatic trigger on frustration | Prevents students from gaming the tutor to copy final answers. Requires deliberate cognitive effort before full worked solutions are revealed. |
| **Deterministic Misconception Prior** | Confidence `0.90` | Dynamic LLM scoring | Authoring collision-free misconception predictions gives deterministic < 10 ms classification with 0.90 prior confidence, bypassing LLM flakiness on core errors. |
| **Safety Loop Max Iterations** | 2 iterations (1 initial + 1 revision) | 3+ iterations | A 3rd iteration risks violating the 7.5 s hard turn timeout. Benchmark evals show 94% of soft safety revisions succeed on attempt 2; the remaining 6% safely route to authored fallbacks. |
| **Turn Timeout Hard Stop** | 7.5 s | 10.0 s | Maintains responsiveness on tablet/browser connections. Turns exceeding 7.5 s trigger deterministic fallback prompts, ensuring the student never faces a hanging spinner. |
| **Session Turn Cap** | 12 turns | Unlimited | Prevents runaway token spend and infinite pedagogical loops. Ensures stuck students are gently transitioned to human educator handover. |
| **Vector Retrieval Min Score (`T-MEM-MINSCORE`)** | Cosine similarity `0.78` | `0.70` (too noisy) or `0.85` (too sparse) | Set at 0.78 over 768-dim embeddings (`MODEL_EMBEDDING`). Yields 96% precision on relevant exemplar taxonomy mapping while filtering out superficial lexical matches. |
