# SolvePath — System Design (DESIGN.md)

---

## 1. System Architecture & Topology

### 1.1 Architectural stance

SolvePath is a **deterministic workflow harness with bounded LLM stages**, not an agent mesh. A table-driven state machine decides what may happen, a fixed pipeline decides the order, and a small number of schema-bound model calls produce wording only. No model chooses a tool, a route, a verdict, a hint level or a state transition (PRD §9.1, §15.3; SPEC SC-05, SC-06, SC-07).

Five structural rules follow from SPEC and shape every boundary below.

| # | Rule | Source |
| --- | --- | --- |
| A1 | The orchestrator is the only component that talks to the browser, and the only one that talks to MCP, A2A, the LLM provider and Blob on a student's behalf | SPEC §1.3 |
| A2 | Every dependency failure degrades to a deterministic result. None can yield a verdict, a leak or unguarded model text | SC-19, §5.5 |
| A3 | All durable state is in Postgres (plus Blob objects referenced from Postgres). Functions hold no state between requests | SPEC §5.4, PRD §15.6 |
| A4 | Authorisation is decided in Postgres on every request. Nothing in the token except `sub` is trusted | SC-01 |
| A5 | The verifier result is pure and cacheable. Session context is applied afterwards in an uncached overlay | SC-05, §2.4 |

### 1.2 Topology

*End-state (Phase B / Tier 1b) topology. Phase A / Tier 1a is two Vercel projects (`solvepath-web`, `solvepath-api`) with the verifier and safety modules in process, no MCP or A2A hop, no exact-key cache, and an empty exemplar stub behind the retrieval gate (§1.3).*

```text
                              ┌───────────────────────────┐
                              │  Clerk (identity proof)   │
                              └─────────────▲─────────────┘
                                            │ JWKS (cached ≤ 1 h)
┌──────────────────┐  same-origin /api/*  ┌─┴──────────────────────────────────────────────┐
│ solvepath-web    │ ───────────────────► │ solvepath-api   (FastAPI + ADK orchestrator)   │
│ Next.js app      │   JSON, Clerk JWT    │  middleware → routers → orchestrator → engines │
│ (untrusted)      │                      └──┬───────────┬───────────┬───────────┬─────────┘
└──────────────────┘                         │ MCP (HTTP)│ A2A (HTTP)│ adapter   │ SQL / Blob
                                             │ +svc token│ +svc token│ (HTTPS)   │
                                   ┌─────────▼───┐  ┌────▼────────┐  ┌▼─────────┐ │
                                   │solvepath-mcp│  │solvepath-   │  │ LLM      │ │
                                   │ verify_     │  │  safety     │  │ provider │ │
                                   │ expression, │  │ allow/block │  │ (Gemini/ │ │
                                   │ get_question│  │ revise/     │  │ OpenRtr/ │ │
                                   │ search_     │  │ escalate    │  │ vLLM)    │ │
                                   │ exemplars   │  └─────────────┘  └──────────┘ │
                                   └──────┬──────┘                                │
                                          │ read-only SQL                         │
                                   ┌──────▼───────────────────────────────────────▼──┐
                                   │ PostgreSQL (Neon) + pgvector                     │
                                   │ domain · skill graph · cache · audit · counters  │
                                   └──────────────────────────────────────────────────┘
                                   ┌───────────────┐   ┌───────────────────────────────┐
 Vercel Cron ──Bearer CRON_SECRET─►│ /api/jobs/*   │   │ Vercel Blob: diagram SVGs,    │
                                   │ (solvepath-api)│  │ content imports, exports      │
                                   └───────────────┘   └───────────────────────────────┘
 Langfuse ◄── OTLP spans, scores, prompt fetch (pseudonymous ids only; never blocks a turn)
 Sentry   ◄── scrubbed error events from web, api, mcp, safety (errors and crashes only; never blocks a turn)
```

### 1.3 Deployable units

| Unit | Vercel project / root | Entrypoint | Runtime dependencies | Inbound callers | Notes |
| --- | --- | --- | --- | --- | --- |
| Web app | `solvepath-web` / `apps/web` | Next.js (App Router), client-rendered | React, Next.js, TanStack Query, KaTeX, `@clerk/nextjs`, `@sentry/nextjs` | Browser | A `next.config` rewrite sends `/api/:path*` to the API project, so the browser sees one origin and there is no CORS. No server-side data fetching and no authorisation in Next.js. Renders only what `tutor.controls` lists |
| Orchestrator API | `solvepath-api` / `apps/api/deploy/api` | `api/index.py` (thin entry over the shared source tree) | FastAPI, Pydantic v2, SQLAlchemy 2, Google ADK, provider adapter, Langfuse client. Phase A: also SymPy and the in-process verifier and safety modules. Phase B: MCP and A2A clients and **no SymPy**; the stdlib-only normaliser is then the only maths the API imports | Web app, Vercel Cron | Own manifest. Unzipped bundle ≤ 250 MB (CI gate, with SymPy in Phase A). Hosts routers, orchestrator, ADK pipeline, cron routes |
| MCP server (**Phase B**) | `solvepath-mcp` / `apps/api/deploy/mcp` | `mcp_server.py` (via the deploy root's entry) | SymPy, mpmath, MCP SDK, a Postgres driver (no embedding client). **No ADK, no pandas, no torch, no transformers** | Orchestrator only (service token) | Created at Phase B. Own manifest. Bundle at most 90 MB (measured 83 MB with no bytecode shipped), MCP cold-start (first-call) p95 target under 1.2 s (design target; the p95 ≤ 5 s gate is binding at Gate B). Holds solution data. **From Phase B the only deployable that packages SymPy** |
| Safety Guard (**Phase B**) | `solvepath-safety` / `apps/api/deploy/safety` | `a2a_safety.py` (via the deploy root's entry) | HTTP client for `MODEL_SAFETY`, Pydantic | Orchestrator only (service token) | Own manifest. Verdict-only. No Postgres read access to domain data |
| Data | Neon Postgres + pgvector | — | — | API, MCP, Safety (audit insert only), migration role | Pooled string for requests, unpooled for migrations. Neon's pooler is transaction-mode, so **no session-level state** (no `SET`, no session advisory locks, no prepared-statement reliance) |
| Objects | Vercel Blob | — | — | API | Diagram variants, content imports, exports. No guessable public URL for student-specific objects |
| Telemetry (LLM and agent) | Langfuse | OTLP | — | API, MCP, Safety | Export is fire-and-forget with a ≤ 300 ms flush. LLM and agent telemetry only |
| Error monitoring | Sentry | Sentry SDK (`@sentry/nextjs`, `sentry-sdk` FastAPI integration) | — | Web, API, MCP, Safety | Errors and crashes only. Tracing and Session Replay off. Scrubbed by `before_send`. Never blocks a turn |

The three server projects share **one source tree** (`apps/api/app`) and nothing else: each has its **own deploy root** (`apps/api/deploy/{api,mcp,safety}`) holding its own dependency manifest (selecting its own extra from `apps/api/pyproject.toml`; the groups are `[project.optional-dependencies]` extras), its own `vercel.json` and a thin entrypoint. This is what keeps the dependency trees separate: a project installs only what its own manifest lists, so the MCP install cannot pull in ADK. The deploy roots reach the shared source through Vercel's "include source files outside of the Root Directory" setting or a build-time copy of the §1.5 modules (the deploy spike P0-13 picks one). From Phase B, CI resolves each manifest and fails if the MCP tree contains ADK, pandas, torch or transformers, or if the API tree contains SymPy. Before that (Phase A) these two rules are off, because only the API deploy root exists. They share code only through the dependency-light modules listed in §1.5. They do not share one prompt.

**Topology phases (B-1).** *Phase A* (Slice 0 and Tier 1a, Gate A): one deployable, `solvepath-api`, with the verifier module `apps/api/app/verifier` (SymPy) and the safety module bundled in process. No `solvepath-mcp` or `solvepath-safety` service exists yet, so the verifier call is a direct in-process call and the in-process fallback rules do not apply. Phase A therefore has **two** Vercel projects (`solvepath-web`, `solvepath-api`) and no exact-key cache. The four-project set (web, api, mcp, safety) is the Phase B end state. Phase A: manual deploy; `deploy-prod.yml` from Tier 1b. Deployment is triggered by the GitHub Actions workflow `deploy-prod.yml` (the authoritative deploy trigger, built by P2-22 in Tier 1b). Vercel Git auto-deploy is disabled on every project. *Phase B* (Tier 1b, Gate B): starts when `solvepath-mcp` is split into its own deploy root and service boundary. The change that creates `apps/api/deploy/mcp` also removes the `verifier` extra (SymPy) from the API manifest.

The CI rules "no SymPy in the API tree", "MCP bundle ≤ 90 MB with no ADK, pandas, torch or transformers" and the MCP cold-start (first-call) p95 gate take effect **only in Phase B**, in the change that creates the MCP deploy root. In Phase A the API bundle limit (≤ 250 MB) is measured with SymPy included (about 115 MB without SymPy plus about 31 MB for SymPy plus mpmath, so about 146 MB against the 250 MB limit. Sizes: SymPy about 29 MB, SymPy plus mpmath about 31 MB, measured on Linux x86_64 wheels, Python 3.12), so a Phase A build passes CI by design. The bundle size check runs on the CI build artefact, whereas the API cold-start p95 and the MCP cold-start (first-call) p95 need a deployed service and are not run at Gate A (they apply at Gate B). In Phase B the API bundle is about 115 MB and the MCP bundle 83 MB of its 90 MB limit. The P0-13 deploy spike (deferred until the first Vercel deployment, before Tier 1b) rehearses the **Phase B** topology (a SymPy-free API root, an MCP root and a Safety root). It does not change Phase A, where Slice 0 and Tier 1a bundle SymPy in the API.

### 1.4 Layered decomposition of `apps/api`

Module names beyond those SPEC names explicitly (`app/fsm`, `app/contracts.py`, `app/verifier/normaliser.py`, `app.verifier.service`, `app.safety.service`, `mcp_server.py`, `a2a_safety.py`) are logical and indicative. SPEC does not fix a source tree.

| Layer | Modules | Responsibility | May depend on |
| --- | --- | --- | --- |
| L0 Contracts | `contracts` (Pydantic v2 source of truth), enums, error payload | One definition of every schema crossing a boundary. OpenAPI and web types are generated from it | nothing |
| L1 Edge | Request-id, authentication, scope resolution, audit middleware, rate limiter, idempotency gate, error mapper | Turns an HTTP request into a resolved `(user, role, cohorts, grants)` and a validated body. Maps exceptions to the single error payload | L0, L6 (repositories), L7 (Clerk JWKS client, Sentry `before_send` scrubber) |
| L2 Routers | Student, educator, coordinator, reviewer, administrator, jobs routers | Parse, authorise (role-action matrix and scope), delegate. **No business rules** | L0, L1, L3 |
| L3 Application services | Tutor Orchestrator (`run_turn`), session service (start, resume), transfer service, dashboard service, review/recommendation service, content-review service, admin service, job runners | Own use-case transactions. Compose engines. Decide commit boundaries (§3.3) | L0, L4, L5, L6, L7 (job runners, Langfuse flush) |
| L4 Deterministic domain engines | `fsm` (`transitions.apply`), `normalise`, `scrub_pii`, `input_screen`, pure verifier, `apply_overlay`, `match_prediction`, `retrieval_gate`, `estimate_student_state`, `decide_hint`, `check_candidate`, `render_solution_turn`, `render_example_turn`, `select_transfer`, `recommend_next`, `update_learner_model`, `render_diagram`/`validate_diagram`, wording check | Pure functions of their inputs. No I/O, no clock reads other than an injected `now`, no model calls. Unit-testable without infrastructure | L0 |
| L5 Agent layer | ADK `SequentialAgent` turn pipeline, `LoopAgent` safety loop, `BaseAgent` wrappers around L4 engines, `LlmAgent`s (Socratic Dialogue, Misconception Classifier, Teacher Insight), callbacks (`before_model` prompt-capture guard, `before_tool` allow-list, `after_model`) | Run the fixed order. Hand structured results between steps through ADK state keys. Hold no tool client in LLM agents | L0, L4, L7. L6 for `BaseAgent` wrappers only (AG-01 question load through the repository, AG-02 and AG-04 cache store), never for `LlmAgent`s |
| L6 Persistence | Repositories, unit-of-work with a mandatory audit writer, exact-key cache store, rate-counter store, RLS context setter (minimal form from Tier 1a, full matrix T3) | The only code that issues SQL | L0 |
| L7 Integration adapters | MCP client (one repeat call as its fallback on the Vercel topology), A2A client (in-process `app.safety.service` fallback), provider adapter, Blob client, Clerk JWKS client, Langfuse exporter and masking function, Sentry client and `before_send` scrubber | Wrap every outbound dependency behind a narrow interface with explicit timeouts | L0 |

Dependency rules, enforced by an import-linter style check in CI:

1. Dependencies point downward only. L4 imports nothing from L5, L6 or L7. The "May depend on" column is the contract the import-linter check (task P1-16) enforces. The L5 to L6 edge is limited to the `BaseAgent` wrappers named above, and the L1 and L3 edges to L7 cover the Clerk JWKS client, the Sentry scrubber, the job runners and the Langfuse flush.
2. LLM agents (L5) receive only the ADK state keys listed in SPEC §2.4 (agent context isolation). They never receive a repository, an MCP client or the accepted answer.
3. Only L6 imports the SQL driver. Only L7 imports vendor SDKs and HTTP clients. Agents import neither (PRD §9.6).
4. Feature code obtains an audit writer only through the unit-of-work. It cannot construct a database session that bypasses it (SC-16).

### 1.5 Shared-code boundary (what MCP and Safety may import)

The MCP bundle limit makes the import graph a design constraint.

| Shared module | Used by | Constraint |
| --- | --- | --- |
| `contracts` (subset: `PureVerifierResult`, tool I/O, `SafetyVerdict`, enums) | API, MCP, Safety | Pydantic only |
| `verifier.normaliser` | API, MCP, tests | **Standard library and Pydantic only. No SymPy.** The API uses it for `normalise`, the leakage check and the overlay |
| `verifier` (pure verifier, tolerance rules, `app.verifier.service`) | Phase A: the API (in process). From Phase B: MCP only, and the API only in a container topology that packages SymPy with it (the in-process fallback) | SymPy and mpmath only. **No import of ADK, SQLAlchemy models or the provider adapter**, in every phase, so the module can be split out |
| Question and exemplar read access | MCP | Narrow read repository (approved and published only), not the full persistence layer |
| `embed` function of the provider adapter | API (`embedding-sync` only; MCP no longer embeds, D-26) | Plain HTTP call. The adapter's embedding entry point must not import ADK or any vendor SDK |
| Service-token verifier | MCP, Safety, API (signer) | One module. Signer lives only where the target secret is held (see §1.7) |
| Safety checks (`app.safety.service`) | Safety, and API for the in-process fallback | The same module in both places, so a fallback cannot behave differently. It holds no SymPy |

### 1.6 Sub-systems and ownership

| Sub-system | Components | Owns (writes) | Reads | Tier |
| --- | --- | --- | --- | --- |
| **Tutoring runtime** | Session service, Tutor Orchestrator, FSM, turn pipeline, hint policy, verifier overlay, matcher, classifier and dialogue agents, leakage checker, transfer service, canned-text registry | `tutoring_session`, `attempt`, `tutor_turn`, `student_note`, `session_flag`, `misconception_event`, `idempotency_key`, `rate_counter`, `cache_entry`, `learner_skill_state` turn-time fields | `question`, `diagram_asset`, skill graph, exemplars, cohort settings | T1 |
| **Verification & retrieval services** | MCP server (`verify_expression`, `get_question`, `search_exemplars`) | nothing (audit rows for rejected tokens only) | `question`, `misconception_exemplar` (and `question_embedding` only if `select_transfer` is later served by MCP) | T1b |
| **Safety services** | A2A Safety Guard, deterministic leakage and phrase checker | nothing (audit rows for rejected tokens only) | none | T1b |
| **Content subsystem** | Offline import and validation (V1–V9, C1–C3 at import and C4 at release (Gate B tag)), diagram renderer and validator, embedding sync, content-review workflow, item-quality scan | `question`, `diagram_asset`, `question_embedding`, `misconception_exemplar`, graph tables, `content_review_item`, Blob diagram variants | same | T1 import, T2 review |
| **Learner & educator analytics** | Learner-rollup, dashboards, review list, groups, replay assembly, Teacher Insight code path, recommendation review | `learner_skill_state` aggregates, `recommendation`, `teacher_comment`, `tutor_note`, `misconception_event.reviewer_status`, `intervention_export` | sessions, attempts, turns, events | T1c–T3 |
| **Governance** | Authentication and scope resolution, role-action matrix, audit writer and viewer, retention purge, administration (users, cohorts, grants, `allow_level_5`) | `app_user`, `user_grant`, `cohort`, `cohort_assignment`, `audit_event` | everything for authorisation | T1–T3 |
| **Background processing** | Six cron routes and their runners, `job_run` (the nightly evaluation is a GitHub Actions workflow, not a cron route) | `job_run` plus each job's target tables | per job | T1b–T3 |

Boundaries inside the tutoring runtime that must never blur:

- **Verifier vs overlay.** The verifier is session-independent and cacheable. The overlay sees the session and is never cached or sent to MCP.
- **Policy vs wording.** `decide_hint` selects level, probe, content and prompt type. The Dialogue Agent only phrases what was selected.
- **Hypothesis vs verdict.** `error_category` and the classifier produce hypotheses for teachers. No misconception code reaches the student or alters correctness.
- **Candidate vs delivered turn.** Nothing is delivered, streamed or stored as a turn until it has passed the deterministic check, the guard and the final override.

### 1.7 Security boundaries and least privilege

| Boundary | Mechanism |
| --- | --- |
| Browser → API | Clerk JWT, role and scope from Postgres, same-origin rewrite. Hiding a control is never access control |
| API → MCP / Safety | Short-lived HMAC bearer (`aud`, `iat`, `exp`, `exp − iat ≤ 60 s`). One secret per target service. The API holds both signing secrets. Each target holds only its own and verifies, never signs for the other. Missing, expired, wrong-audience or badly signed token → 401 plus an audit event, no data returned |
| Cron → API | `Authorization: Bearer CRON_SECRET`. Mismatch → 401, log and audit, nothing runs |
| API → Postgres | Pooled non-owner role without `BYPASSRLS`, with `INSERT` only on `audit_event` (no `UPDATE`/`DELETE`, plus rejecting triggers). Row-level security (`FORCE ROW LEVEL SECURITY`) on every table that holds student-scoped rows, the pre-`SET LOCAL` lookup through a narrow `SECURITY DEFINER` function keyed by the Clerk `sub` (owned by a dedicated non-login role, `search_path = pg_catalog, public`, `EXECUTE` revoked from `PUBLIC` and granted only to the API role), identity set with `SET LOCAL app.user_id` per transaction. Fails closed when absent. Minimal form (fail-closed policies on every table that holds student-scoped rows) from Tier 1a, a teacher assigned-cohort read policy added with the Tier 1c replay, full policy matrix T3 |
| MCP → Postgres | Separate role: `SELECT` on question and exemplar tables (and `question_embedding` only if `select_transfer` is later served by MCP), `INSERT` on `audit_event`. No access to student tables |
| Safety → Postgres | Separate role: `INSERT` on `audit_event` only |
| Migrations | Separate unpooled role, run only from CI |
| Telemetry | Pseudonymous `app_user.id` only. A masking function runs before export |
| Error monitoring | Sentry events carry only `request_id`, `trace_id`, `session_id`, `environment`, `release` and the service name. No `app_user.id`, Clerk id, student input or token |

---

## 2. Module Interactions & Communication

### 2.1 Communication map

| # | From → To | Mode | Protocol and contract | Timeout / budget | On failure |
| --- | --- | --- | --- | --- | --- |
| C1 | Browser → API | Sync | HTTPS JSON, Clerk bearer, `Idempotency-Key` on events | Client timeout 15 s. Wait message at 1 s, reassurance at 4 s. Timers start once the request is dispatched. One retry with the same key, 3 s after a timeout, a network error or a 409 | Deterministic fallback shown client-side after the retry fails |
| C2 | API → Clerk JWKS | Sync, cached | JWKS fetch | Cached keys ≤ 1 h | No usable cache → 503. Never fail open |
| C3 | API → Postgres | Sync | SQL over the pooled string | Persistence stage 200 ms | Before attempt stored → 503 `service_unavailable`. After pipeline → 503, retry resumes (§3.4) |
| C4 | Orchestrator → cache | Sync | `cache_entry` exact-key read/write (Phase B / Tier 1b. Tier 1a: no cache) | 25 ms is the overhead-budget line item for the lookup. The cache-hit target is < 20 ms (AGENTS §2.4, Tier 1b) | Read or write failure = miss, span recorded |
| C5 | Orchestrator → MCP `verify_expression` (Phase B / Tier 1b. Tier 1a: in-process verifier call, no MCP) | Sync | MCP streamable HTTP, stateless, service token, W3C `traceparent`/`tracestate` | 400 ms | Timeout/connect → the single per-turn fallback: a repeat MCP call inside the remaining budget (Vercel topology) or in-process `app.verifier.service` (container topology only). HTTP 4xx/5xx → `cannot_verify`, `state=tool_failure`, no retry |
| C6 | Orchestrator → MCP `search_exemplars` | Sync, conditional | Same transport, numbers-only query. Phase B / Tier 1b. Tier 1a: the gate runs against an empty exemplar stub, no MCP call | 250 ms | Empty result (treated as valid) |
| C7 | Orchestrator → MCP `get_question` | Sync | Same transport | Inside the 150 ms load budget | Question loading in the hot path uses the repository directly (§4.2 DD-05). MCP `get_question` serves tool consumers and the import tests |
| C8 | MCP → Postgres | Sync | SQL read (exact filter for exemplars) | Inside C5/C6 | Read failure → empty retrieval |
| C9 | Orchestrator → LLM (via adapter) | Sync | Provider adapter, agent output schemas | Classifier 1,000 ms. Dialogue 1,400 ms (includes one schema-repair call) | `provider_error`, `schema_invalid` → deterministic fallback. No free-form retry |
| C10 | Orchestrator → A2A Safety Guard | Sync | HTTP, service token, trace headers, `SafetyVerdict` | 1,200 ms (1.3 s cap) | Timeout/connect → one in-process retry in remaining budget. HTTP error → `guard_unreachable` fallback |
| C11 | Orchestrator → Blob | Sync | HTTPS | Inside the diagram route | Render from validated spec in process, else probe text without diagram |
| C12 | All services → Langfuse | **Async** (batched OTLP export) | OTLP spans, scores. Prompt fetch with pinned label (Tier 1b onward; Tier 1a: repo files, no fetch) | Flush ≤ 300 ms, asynchronous background work after the response, otherwise inline with the turn deadline and revision gate cut to 7.2 s | `trace_status=missing`. Turn continues |
| C13 | Vercel Cron → API `/api/jobs/*` | **Async** relative to users | HTTP GET, bearer secret | Bounded batch inside function duration | Remainder resumes on next invocation |
| C14 | Browser ↔ API progress stream | Async, optional | `text/event-stream`, stage names only | — | Client falls back to timed wait messages |
| C15 | API → in-process module `app.safety.service` (and `app.verifier.service` only in a container topology) | Sync | Direct call, same schemas | Remaining turn budget | Second fallback in one turn → deterministic fallback prompt |

**Synchronous vs asynchronous.** Everything that produces or gates a student-visible turn is synchronous and finishes before the response returns (no streaming from unreviewed drafts). Asynchrony exists only in telemetry export, cron processing, and the optional progress stream. There is no message queue and no background worker on the student path.

### 2.2 Request pipeline (applies to every `/api/*` route except cron)

```text
request ─► request-id ─► JWT verify (JWKS) ─► user lookup by sub ─► role/cohort/grant resolve
        ─► route rule (role-action matrix + scope) ─► [from Tier 1a: open tx, SET LOCAL app.user_id]
        ─► body validation (field-set matrix, size limits) ─► handler
        ─► error mapper (single payload) ─► X-Request-Id on response
Audit: success and denial both write through the unit-of-work audit writer.
Denials write in an independent transaction (§3.5) so they survive rollback.
```

A student asking for another student's session gets 404 `not_found` (ownership is part of the repository query, not a post-check), and `access_denied` is audited.

### 2.3 Turn deadline propagation

The orchestrator creates a `TurnDeadline` at ingress. It is passed to every stage.

| Rule | Behaviour |
| --- | --- |
| Stage timeout | Each outbound call uses `min(stage_timeout, remaining_to_7.5 s)` |
| Do-not-start rule | A stage whose minimum useful time would cross 7.5 s is skipped and the turn goes to the deterministic fallback with `fallback_reason=budget` |
| Revision gate | The second dialogue iteration starts only if the remaining time covers dialogue 1.4 s + guard 1.2 s + persistence 200 ms. Otherwise the turn goes to the fallback with `budget`. `loop_exhausted` is reserved for two rejected iterations, or an `escalate` verdict (§4.4 item 9). The gate is measured against the turn deadline D: 7.5 s with the background flush, 7.2 s in the inline-flush fallback (SPEC §5.1). |
| Client timing | The client request timeout is 15 s and its timers start once the request is dispatched. The server turn deadline starts at ingress, after any cold start, so the client sees at most about 5 s + 7.5 s + network. One retry 3 s after a timeout, a network error or a 409, same key (§3.3) |
| Single per-turn fallback | At most one per turn (verifier: repeat MCP call, or in-process on a container topology; guard: in-process), only on timeout or connect failure, only inside the remaining budget. A second need goes straight to the deterministic fallback prompt. The fallback costs up to 0.4 s (verifier) or 1.2 s (guard, a second model call), which the stage sums do not include. The hard stop and the revision gate bound the turn, not the sum (SPEC §5.1) |
| Flush | The Langfuse flush runs asynchronously in the background after the response (a platform background task or a non-blocking worker). If that is unavailable it runs inline and the turn deadline and revision gate use 7.2 s |
| Persistence reserve | 200 ms is reserved for transaction B, so the fallback turn itself can always be stored |

### 2.4 End-to-end sequences

Participants: **B** browser, **API** edge and routers, **ORC** Tutor Orchestrator, **PG** Postgres, **MCP**, **SAF** Safety Guard, **LLM** provider adapter, **LF** Langfuse.

#### S1 — Authenticate and authorise (WF-01)

```text
B → API: any /api/* with Bearer JWT
API: no/invalid token ─────────────────────────────► 401 unauthenticated
API → JWKS cache: verify signature, iss, exp, nbf (refresh if stale; cache ≤ 1 h)
API: verify `azp` against AUTH_AUTHORIZED_PARTIES (Clerk's default token has no `aud`; `aud` is
     checked only when a JWT template sets it). Wrong or missing azp ───────────► 401 unauthenticated
     JWKS unreachable and no usable cache ─────────► 503 service_unavailable
API → PG: resolve app_user by clerk_user_id = sub, then role, cohort assignments, active grants,
     via the SECURITY DEFINER lookup function (Tier 1a; see the RLS paragraph in §3.5)
     (token role claims ignored; no plain SELECT on app_user before SET LOCAL)
     none ──► audit auth_unknown_subject, create nothing ─► 403 forbidden
API: role-action matrix + scope; parent has no route; denied ─► audit access_denied ─► 403/404
API → handler (identity resolved; from Tier 1a: SET LOCAL app.user_id on the transaction)
```

#### S2 — Start a session (WF-02)

```text
B → API: POST /api/sessions {question_id | recommended}
API → ORC.session_service.start(student)
  explicit id ──► PG: latest version with approved ∧ published ∧ ¬flagged ∧ scope enabled ∧ FR-02 complete
                   else 404 not_found
  recommended, no history ──► starting-set item needing no untaught skill
  recommended, history ──► recommend_next: learner_skill_state (includes the student's latest turn write)
                           + graph edges (remediates/prerequisite), deterministic. Vector search is not consulted
  item has diagram ──► diagram_asset approved variant exists and validates?
                       no ──► withhold, raise content_review_item, (recommended: choose next eligible)
  PG tx: INSERT tutoring_session(state=awaiting_first_attempt, question_version pinned, level 0)
         + audit question_selection         (committed before the response)
API → B: 201 SessionView { tutor: canned level0_prompt, controls for awaiting_first_attempt }
```

`SessionView.tutor` is the last persisted `tutor_turn` or, when none exists (a new original or transfer session), the canned `level0_prompt` rendered from the registry. `controls` and `next_target` are derived at read time from state and `active_probe_id`. Nothing about them is stored.

#### S3 — Student turn, principal path: unmatched `incorrect` answer (WF-03, WF-06 to WF-09)

*Phase A / Tier 1a: no exact-key cache, no MCP and no A2A call. The verifier and the safety module run in process, and the retrieval gate runs against an empty exemplar stub (real exact-SQL exemplar query and `search_exemplars` arrive in Phase B / Tier 1b). The cache, MCP and `exemplar_query` lines below describe Phase B / Tier 1b.*

```text
B ─ POST /events (Idempotency-Key, body) ─► API
API → ORC.run_turn(session_id, request, key)

TX-A (short, no external calls)  ───────────────────────────────────────────────
  PG: replay lookup on key (done → return stored, Idempotent-Replay)
  PG: SELECT session FOR UPDATE ; lazy abandonment (30 min) committed if due
  SAVEPOINT
    idempotency INSERT in_progress   | conflict rules (§3.4)
    rate_counter upsert (hour, 5 min) | over cap → rollback to savepoint, 429
    lease check                       | other key holds live lease → 409 request_in_progress
    transitions.apply PHASE 1 (legality: any row for (state, event type)?) | not allowed → rollback to savepoint, 409, audit (independent tx)
    INSERT attempt (id derived from the key; counted unset)
    SET lease_holder = key, lease_expires_at, lease_stage = 'checking'
  COMMIT
─────────────────────────────────────────────────────────────────────────────────
ORC builds ADK state from PG rows; deadline starts counting from request ingress
ADK Runner → SequentialAgent
 1 ProblemContext: load question version (repository), scrub_pii, normalise
      unparsed → input_screen: hit → canned reply, STOP (S3-variant V3) | no hit → cannot_verify
 2 MathVerifier:
      cache lookup (exact key) ─ hit ─► PureVerifierResult         [Phase B / Tier 1b; Tier 1a: no cache]
      miss ─► MCP verify_expression (400 ms) ─► store in cache     [Tier 1a: in-process verifier call]
      apply_overlay (uncached) ─► VerifierOutcome
 3 match_prediction (incorrect ∧ value/ratio only)           deterministic, < 10 ms
 4 retrieval_gate: incorrect ∧ no match ─► gate opens
      lease_stage = 'preparing'
      MCP search_exemplars (250 ms, exemplar_query cache)    empty/failed ⇒ empty result
                                                             [Tier 1a: empty stub; Phase B / Tier 1b: real query]
 5 estimate_student_state ─► MisconceptionClassifierAgent (1,000 ms) when the gate opened.
      Advisory: timeout / provider error / invalid output ⇒ no misconception claim, prompt_type =
      diagnostic_probe, audit event, the turn CONTINUES (no fallback_l{level}, not in fallback_rate)
 6 decide_hint ─► HintDecision (level, probe, content, prompt_type, tone)       < 40 ms
 7 LoopAgent (≤ 2 iterations) — see S5
 8 fallback_l{level} if the loop yields no allowed turn
TX-B (one transaction) ──────────────────────────────────────────────────────────
  transitions.apply PHASE 2 (resolve the outcome row from the pipeline result; write next state)
  UPDATE tutoring_session … WHERE id = ? AND lease_holder = key   (0 rows ⇒ lease lost ⇒ rollback, 409)
  INSERT tutor_turn, misconception_event; UPDATE attempt.counted
  session fields: state, level, counters, asked_probe_ids, matched_step_ids, active_probe_id,
                  input_mode, consecutive_cannot_verify, flags; clear lease
  learner_skill_state turn-time write (WF-12) when the outcome requires it
  audit events (hashes only); idempotency_key → done + stored response
  COMMIT
─────────────────────────────────────────────────────────────────────────────────
ORC → API → B: 200 TurnResponse   (no verdict, no code, no `sound`, no solution value below Level 5)
LF flush (≤ 300 ms) AFTER the response where the platform allows (background work); else inline before return,
with the turn deadline and revision gate at 7.2 s (inline fallback) ─ failure ⇒ best-effort UPDATE tutor_turn.trace_status='missing'
```

The Langfuse trace id is created at ingress and stored in TX-B. A flush failure after commit cannot undo the turn. See §4.2 DD-09.

#### S3-variants — which stages run, by event (WF-03 table, WF-04, WF-05)

*MCP and cache entries in the External calls column are Phase B / Tier 1b. At Phase A / Tier 1a the verifier is an in-process call with no cache and retrieval is an empty stub.*

| Event / case | TX-A | Stages between | TX-B content | External calls |
| --- | --- | --- | --- | --- |
| `submit` value, ratio or expression | yes | S3 steps 1–8 | turn, attempt counted per outcome, learner write if success | MCP (unless cache hit), MCP retrieval (gate), LLM ×(0–3), SAF |
| `submit` answer correct on final | yes | steps 1–2, then authored reflection turn | state → `reflection`, mastery delta | MCP verify only. No model, retrieval or guard |
| `submit` with parsing failure, first in a row | yes | steps 1–2 (`cannot_verify`) | canned `rephrase_request`/`use_dot_for_decimals`/`enter_the_number`, `consecutive_cannot_verify` +1. Not a pipeline turn | none (verify may be skipped when `normalise` reports `unparsed`/`comma_ambiguous`) |
| `submit` parsing failure, second in a row | yes | same | `input_mode=structured`, canned `structured_mode_notice`, flag `ambiguity_review`. No counted attempt, but a pipeline turn (SPEC SM-1 row 6). No level change | none |
| `submit` parsed expression that matches no step | yes | steps 1–2 (`cannot_verify`, `state=ok`) | SM-1 row 5b: canned rephrase asking for the number the calculation gives. A pipeline turn, attempt not counted, no level change, `consecutive_cannot_verify` unchanged | none (MCP verify only at Phase B) |
| Input Screen hit (V3) | yes (attempt stored, `counted=false`) | step 1 only | **No `tutor_turn` row.** Audit safety event, canned reply returned, flag for `worrying_disclosure` | none |
| MCP HTTP error | yes | step 2 | canned `tool_failure_notice`, no counter change, no retrieval | MCP failed |
| `submit` reasoning option only | yes | load-only step 1, estimator, `decide_hint`, loop or authored | answerless pipeline turn, attempt `reasoning_option`, level unchanged | LLM, SAF (or canned) |
| `not_sure` | yes | load-only step 1, estimator, `decide_hint` (+1, max 4), loop | pipeline turn, attempt `not_sure`, not counted | LLM, SAF |
| `show_solution` | yes | load-only step 1, estimator, `decide_hint` (the same steps as SPEC WF-03 and AGENTS §5.2) | all four conditions → `render_solution_turn` (`kind=solution`) and state `transfer_offered`. `allow_level_5` false → `render_example_turn` (`kind=authored`). Else next probe through the loop or canned `encouragement` | none for the first two |
| `reflection_choice` | yes | WF-10 `select_transfer` | attempt `reflection_choice` with `sound`, turn with authored feedback + `transfer_offer`, state → `transfer_offered` or `completed` | none |
| `transfer_decision` | yes | WF-10 | accept: transfer session created, original completed. Decline: `declined` | none |
| `note` | yes | scrub, `input_screen` | hit: audit safety event only. No hit: `student_note` + canned `note_ack`, **no `tutor_turn` row** | none |

Persistence rule for turn rows (owner decision, recorded as DD-02): every answer-bearing event (`submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision`) writes one `tutor_turn` row, including canned replies such as `rephrase_request` and `tool_failure_notice`. Input Screen hits and note acknowledgements write none. `tutor_turn.turn_number` is a per-session ordinal over those rows. The cap counter is the separate `tutoring_session.turn_number`.

#### S4 — Verification with cold-start resilience (WF-06)

*Phase A / Tier 1a: no cache, no MCP, in-process verifier, so none of the fallback branches below exist. This sequence is the Phase B / Tier 1b behaviour.*

```text
ORC: key = SHA-256(normalised expr, question_id, question_version, tolerance rule)
 cache hit ──► PureVerifierResult  (span: cache hit)
 miss ─► MCP verify_expression ── 200 ──► validate schema ─► cache write ─► result
            │ timeout / connect failure
            ▼
          single per-turn fallback, inside the remaining budget:
            Vercel topology   ─► repeat MCP verify_expression call ── span mcp_repeat
                                 (from Phase B the API bundle holds no SymPy)
            container topology ─► app.verifier.service in process ── span protocol=in_process_fallback
            │ would cross 7.5 s, or a second fallback is needed
            ▼
          deterministic fallback prompt (fallback_reason=budget)
          ── HTTP 4xx/5xx from MCP: no retry ─► cannot_verify, state=tool_failure
overlay(response_target, active_probe_id, matched_step_ids) ─► VerifierOutcome (never cached)
```

#### S5 — Dialogue loop, leakage check and guard (WF-09)

```text
HintDecision.turn_kind
  solution / authored / canned ──► deterministic text, no model, no guard
  probe_template (DIALOGUE_MODE=template, the shipped default and emergency kill-switch) ──► authored probe text, no model
  model (DIALOGUE_MODE=llm, opt-in) ──►
    before_model callback: prompt-capture guard (free text in prompt? ⇒ audit
        prompt_capture_violation, fail turn before any model call, fallback_l{level})
    iteration i = 1, 2:
      SocraticDialogueAgent (schema; 1.4 s incl. one repair)
          provider timeout/429/5xx ─► fallback provider_error     invalid after repair ─► schema_invalid
      check_candidate(candidate_text, hint_decision, question, verifier_outcome)
                       (value, method, phrase, digit rule, age_appropriate, single_prompt, schema consistency;
                        digit rule below L4 exempts only the question stem, the selected probe template and the
                        student's value that the verifier marked correct on this attempt, read from this attempt's
                        verifier_outcome in ADK state, so no new computed value passes)
          blocked ─► i = 1: revise (agent sees only "revise") | i = 2: fallback loop_exhausted
      SafetyGuard (A2A, 1.2 s) ── allow ──► final deterministic override (leak re-check)
                              ── block/revise ─► as blocked above
                              ── escalate ─────► no second iteration, fallback loop_exhausted,
                                                 safety-incident audit event
                              ── timeout/connect ─► one in-process retry, else guard_unreachable
                              ── HTTP error ─────► guard_unreachable
    override hit ─► treated as blocked
  fallback_l{level} (authored, no mathematics); flag safety_fallback only for loop_exhausted/guard_unreachable
```

Nothing from an unreviewed candidate is stored in `tutor_turn.body`, streamed or returned.

`DIALOGUE_MODE=template` is the shipped default (SPEC D-37, which takes Cut 1a-3 at baseline): every `model` turn becomes `probe_template` and the Classifier, Dialogue and Guard calls are skipped. `llm` is an opt-in evaluation and stretch mode: the Classifier (when the gate opens), the Dialogue Agent and the Safety Guard then run on the student path. `llm` becomes the default only by a PRD change after the educator check reviews and tunes its prompts and a Gate B live calibration run (n ≥ 100) passes. The model-level ratchets are measured in `llm` mode. The Slice 0 local live smoke sets `llm` explicitly and makes one real Gemini Flash call through the provider adapter.

#### S6 — Reflection, transfer acceptance and transfer run (WF-10, SM-1 rows 13–18)

```text
verified correct final ──► TX-B: state=reflection, authored reflection turn (no model/verify/retrieval/guard),
                           mastery delta
reflection_choice ──► TX-A, then select_transfer:
   shortlist (authored graph partners; pgvector shortlist from T1b)
   legality filter (graph, never similarity): approved ∧ published ∧ ¬flagged ∧ scope enabled ∧ same learning
       objective ∧ no untaught skill ∧ different accepted value and simplified ratio
   choose by highest similarity then lowest question_id (D-19)
     (Tier 1a: graph legality then lowest question_id; the similarity tie-break arrives from Tier 1b)
   partner ─► state=transfer_offered, authored feedback + transfer_offer
   none    ─► completed, end_reason=no_legal_transfer, no_legal_transfer_notice
transfer_decision accept ──► ONE TX-B:
   INSERT transfer session (transfer_active, level 0, own cap 12), set linked_session_id on both,
   original → completed (summary written), response tutor = canned level0_prompt of the linked session
   client then GET /api/sessions/{linked_session_id}
transfer run ──► S3 pipeline with rows 4–7, 12, 19, 22; show_solution ⇒ 409 + audit
   correct ─► completed, transfer_outcome=correct, confidence +0.20, back-fill original
   Level 4 ∧ ≥ 3 counted ∧ latest incorrect/partially_correct (evaluated each persisted turn)
        ─► completed, flag stuck_after_transfer, transfer_stuck_notice, outcome=incorrect
decline ──► declined, transfer_outcome=skipped
```

The back-fill of `transfer_outcome` on the original session is the only permitted mutation of a terminal session row. It happens in the same transaction that ends the linked session.

#### S7 — Turn cap, abandonment, resume and retry (WF-11, WF-14)

```text
12th pipeline turn without correct ─► TX-B: state=stuck, flag turn_cap_reached, turn_cap_notice,
                                      next item offered via recommend_next, no worked solution
any read/write after 30 min idle ─► under the row lock in TX-A (or a short read tx):
                                      state=abandoned, ended_at = last_activity_at + 30 min, summary
                                      committed, then the request is handled against the terminal state
                                      (a submit ⇒ 409; a note ⇒ stored)
GET /api/sessions/{id} within window ─► same question, attempts, level
Retry (§3.4):
  key done ─► stored response, Idempotent-Replay: true
  attempt stored, no turn, lease expired or same holder ─► resume from the attempt, no second attempt
  key still running ─► 409 request_in_progress, retry_after_s=3
```

#### S8 — Diagram retrieval (WF-13)

```text
GET /api/sessions/{id}/diagram
  ownership check (404 otherwise); item has_diagram; current level ≥ diagram min_level (404 otherwise)
  choose variant by band (below_4 / level_4 / level_5)
  Blob read ─ ok ─► stream SVG with CSP default-src 'none', Cache-Control: private
            ─ fail ─► render_diagram(spec, level) in process ─ fail ─► no diagram, `diagram_unavailable` on turn
```

Variants are produced and leakage-validated offline at import. The route never validates or renders model output.

#### S9 — Educator read paths, replay, recommendations (WF-16 to WF-18)

```text
Review list (OP-01): computed per request from attempts of assigned students (not from the rollup)
Groups/trends/profile (OP-02..04): read job-written aggregates; evidence_refs resolved with the caller's scope
Replay (OP-05): authorise (assigned teacher | administrator with trace_review) ─► assemble turns + notes + comments
                (time-merged); purged body ⇒ metadata + retention notice; Langfuse link only for the grant
                holder and only inside 90 days ─► audit `access` on every open
Draft (OP-11 on demand; insight-drafts daily):
   aggregated events ─► TeacherInsightAgent (schema) ─► deterministic wording check
   rejected wording ⇒ stored rejected, never returned    accepted ⇒ stored `pending` with evidence
Decision (OP-10): TX: lock recommendation, apply SM-2, audit who/when/what; identical retry ⇒ stored result,
                  different second decision ⇒ 409 transition_not_allowed
```

#### S10 — Content import, review and publication (WF-19, SM-3, SM-4)

```text
Offline import (CLI/CI, not a student path):
  parse item JSON ─► Problem Parser ─► V1–V9 ─► C1–C3 (C4 at release, Gate B tag) ─► answer-key vs solution-plan check
  diagram spec ─► render variants ─► validate_diagram (leakage over every text surface) ─► Blob + diagram_asset
  write question as validation_status=pending, publication_status=draft (immutable per version)
  embeddings for approved items (not exemplars) written by the import / embedding-sync job
Review (OP-17): approve only if offline validation has passed (else 409) ─► publish ─► audit every status change
Flag (item-quality-scan / verifier mismatch): flagged=true ⇒ immediately unservable
Edit ⇒ new version in imported state (new approval required)
```

#### S11 — Scheduled jobs and retention purge (WF-22, WF-23)

```text
Cron → GET /api/jobs/{name}  Bearer CRON_SECRET (else 401, log + audit, nothing runs)
  job_run INSERT running ─► select bounded batch of pending work ─► process with SKIP LOCKED
  ─► job_run: succeeded | partial (work remains) | failed (Langfuse score or log alert)
  200 { job_run_id, status, processed_count, remaining_count }
retention-purge: per table, rows past their window ─► null/delete bodies only (§3.8);
                 audit rows and approved question diagrams are never touched
```

### 2.5 Failure propagation summary

| Failing module | First observer | Result | Student-visible | Flag / record |
| --- | --- | --- | --- | --- |
| Postgres before attempt stored | TX-A | 503, no pipeline, no counters | `save_failed_notice`, answer kept | log, error span |
| Postgres at TX-B | TX-B | 503, retry resumes from stored attempt (or reruns if none) | same | log |
| MCP timeout (Phase B / Tier 1b) | MCP client | one repeat MCP call (Vercel) or in-process verifier (container topology) | nothing | span `mcp_repeat` or `in_process_fallback` |
| MCP HTTP error | MCP client | `cannot_verify` + `tool_failure` | `tool_failure_notice` | audit |
| Exemplar read | MCP | empty retrieval. The classifier records that it used no exemplars and may return any code or `insufficient_evidence` | nothing | span |
| Classifier invalid or timeout | classifier agent | no misconception claim, `prompt_type=diagnostic_probe`, the turn continues | the normal tutor turn | audit |
| Provider error / invalid schema | dialogue agent | `provider_error` / `schema_invalid` fallback | `fallback_l{level}` | audit, no session flag |
| Guard unreachable or loop exhausted | safety loop | `guard_unreachable` / `loop_exhausted` fallback | `fallback_l{level}` | audit, `safety_fallback` |
| Prompt-capture guard | `before_model` | turn fails before model call | `fallback_l{level}` | P0 audit `prompt_capture_violation` |
| 7.5 s exceeded | deadline | `budget` fallback. With no verifier result the outcome is `unverified` (SM-1 row 23): state unchanged, attempt not counted, `tutor_turn` ordinal + 1 but the cap counter unchanged, level unchanged, `consecutive_unverified` + 1 (third in a row: canned `tool_failure_notice`, flag `verification_unavailable`) | `fallback_l{level}` | audit |
| Blob / SVG | diagram route | in-process render, else probe text | probe text | audit |
| Sentry | error reporter | event dropped, no retry on the request path | nothing | none |
| Langfuse | exporter | `trace_status=missing` | nothing | `trace_missing` counter |
| Cache (Phase B / Tier 1b) | cache store | treated as miss | nothing | span |
| Clerk JWKS | authentication | cached ≤ 1 h, else 503 | sign-in error | audit |

---

## 3. State Management & Data Flow

### 3.1 State inventory and ownership

| State | Authoritative store | Lifetime | Written by | Cached anywhere? |
| --- | --- | --- | --- | --- |
| Identity, role, cohort assignment, grants | Postgres | Until changed | Administration (and seed) | No. Re-read each request so a change applies on the next call |
| Session (state, level, counters, probes, matched steps, input mode, flags, lease) | `tutoring_session` | Session life, then immutable summary | Orchestrator TX-A / TX-B | No |
| Attempts, turns, notes, misconception events | Postgres | Per retention windows | Orchestrator | No |
| Idempotency record and stored response | `idempotency_key` | 24 h | TX-A (`in_progress`), TX-B (`done`) | No |
| Rate counters | `rate_counter` | Window length | TX-A | No |
| ADK session state (per turn) | In memory for one request | One turn | Hydrated from Postgres rows | Discarded after the turn |
| Question content | `question` (immutable per version) | Forever | Import, review | Read per turn. Version pinned in the session |
| Pure verifier result, exemplar query, prompt template (Phase B / Tier 1b. Tier 1a: no cache) | `cache_entry` | TTL | Orchestrator, MCP-side values returned to the orchestrator | This is the cache |
| Learner turn-time mastery and confidence | `learner_skill_state` | Forever | TX-B | No |
| Learner aggregates | `learner_skill_state` (rollup fields) | ≤ 1 h stale | `learner-rollup` | `rollup_at` shown |
| Diagram variants | Blob + `diagram_asset` | Approved: forever. Student-specific: 90 days | Import | Private `Cache-Control` only |
| Recommendations, comments, notes | Postgres | Per retention | Educator services | No |
| Client UI state | Browser (TanStack Query) | Tab life | — | Server-derived. The server is never trusted to the client's copy |
| Traces and scores | Langfuse | 90 days | Exporters | Not authoritative. Postgres audit is |

### 3.2 Session state model

**Ownership.** The tutoring session is persisted in application tables, not inside ADK. Per turn, the orchestrator builds the ADK state from `tutoring_session`, `attempt`, the pinned `question` version and the cohort settings. The ADK `Runner` executes against an ephemeral, in-memory session. Results leave through ADK `output_key` entries that the orchestrator copies into TX-B. Nothing in the ADK state is read on the next request. The ADK state is therefore a pure function of Postgres rows (§4.2 DD-04).

**State keys** handed between pipeline steps (each written by exactly one step):

| Key | Written by | Read by |
| --- | --- | --- |
| `problem_context` (includes `problem_context.question`) | ProblemContext | Verifier, matcher, estimator, `decide_hint`, Dialogue Agent (question stem only), `check_candidate` (takes the question) |
| `verifier_result` (pure), `verifier_outcome` (post-overlay) | MathVerifier | Matcher, gate, estimator, Classifier, `decide_hint`, `check_candidate` (`verifier_outcome` only, for the student's-own-value exemption), persistence |
| `misconception_match`, `retrieval` | Matcher, gate | Classifier, `decide_hint`, Dialogue Agent (misconception code only) |
| `exemplars` | Gate (MCP result) | Classifier only |
| `classification` | Classifier | `decide_hint`, Dialogue Agent (misconception code only) |
| `student_state` | Estimator | `decide_hint`, persistence |
| `hint_decision` | `decide_hint` | Dialogue agent (allow-listed subset), `check_candidate`, persistence |
| `candidate`, `guard_verdict`, `turn` | Loop steps | Final override, persistence |

LLM agents see only the SPEC §2.4 allow-list of keys, which is the same table as AGENTS §4.2. The Dialogue Agent never reads `exemplars` or the accepted answer. The Classifier never reads the tutor draft or the accepted answer. The prompt-capture guard fails the turn if student free text appears in any prompt.

**Session lifecycle** is SM-1. The legal (state, event) pairs live in `apps/api/app/fsm/transitions.yaml`, loaded at runtime. `transitions.apply` is the single place a state changes, applied in **two phases** (SPEC SM-1, D-22): phase 1 in TX-A checks that the (state, event type) pair is legal and writes no state, phase 2 in TX-B resolves the outcome-guarded row from the finished pipeline and writes the next state. Unlisted pairs return 409 `transition_not_allowed`. Parity with the SPEC table covers both phases and is a CI check.

**Session aggregate invariants** (enforced in the application layer, backed by constraints where expressible):

- Pinned `question_version` never changes.
- `current_hint_level` changes only through `decide_hint` output and never exceeds 4 except when the granted Level 5 turn is written.
- `attempt_count` counts only attempts with `counted=true`. `turn_number` counts only pipeline turns (cap 12). A turn that ends `unverified` (SM-1 row 23) is not a cap turn. `consecutive_unverified` is reset by any outcome that has a verifier result.
- `consecutive_cannot_verify` resets on any outcome other than `cannot_verify` (unparsed or `comma_ambiguous`) or SM-1 row 5b, on the same question version. Row 5b leaves it unchanged.
- A terminal session row accepts no mutation except the `transfer_outcome` back-fill. `student_note`, `session_flag` (for example `worrying_disclosure`) and audit events are separate tables, are written without touching the session row, and are permitted in every state.
- At most one `session_flag` per `(session_id, kind)`.

### 3.3 Turn concurrency and transaction lifecycle

The SPEC requires attempts to be stored **before** the pipeline (so a retry resumes) and also requires concurrent events on one session to be serialised (D-14). A row lock (the "per-session row lock" of SPEC D-14 as originally worded, now replaced in SPEC by the lease) cannot span the intervening commit, so a `SELECT … FOR UPDATE` is held only inside TX-A and TX-B, and a transaction-mode pooler must not hold a connection for the 7.5 s pipeline. The design therefore uses two short transactions around an unlocked pipeline, protected by a **lease on the session row** (§4.2 DD-01).

```text
              TX-A (≤ tens of ms)                     pipeline (≤ 7.5 s, no DB lock)           TX-B
 ┌──────────────────────────────────────────┐   ┌────────────────────────────────────┐   ┌────────────────────┐
 │ lock session FOR UPDATE                  │   │ lease_holder = key; lease_expires_at│  │ UPDATE … WHERE     │
 │ lazy abandonment (committed)             │   │ lease_stage: checking → preparing   │  │  lease_holder = key│
 │ SAVEPOINT                                │   │ (best-effort, non-transactional)    │  │ persist all turn   │
 │  idempotency, rate counter, lease check, │   │ MCP / LLM / A2A calls               │  │ outputs, clear     │
 │  transitions.apply, INSERT attempt,      │   │ deadline: 7.5 s                     │  │ lease, key → done  │
 │  take lease                              │   │                                     │  │ + stored response  │
 │ COMMIT                                   │   │                                     │  │ COMMIT             │
 └──────────────────────────────────────────┘   └────────────────────────────────────┘   └────────────────────┘
```

**Lease fields** (added to `tutoring_session`, §4.2 DD-01): `lease_holder` (the `Idempotency-Key`), `lease_expires_at`, `lease_stage` (`checking`, `preparing`, `done` for the progress stream). The lease duration is **12 s** (`SESSION_LEASE_SECONDS`). It exceeds the 7.5 s hard stop plus the 200 ms persistence reserve (7.7 s) with 4.3 s of margin and is far below the function `maxDuration` of 60 s. If a function dies mid-turn, the student is blocked for at most 12 s after TX-A. **Client timing and retry policy (single standard).** The client sets a request timeout of **15 s** (up to 5 s API cold start at the p95 gate, plus the 7.5 s server hard stop, plus a 2.5 s network buffer). All client timers (the 1 s wait message, the 4 s reassurance and the 15 s timeout) start on the frontend **only once the request has been dispatched** (the connection is established and the request is sent), not at the button press. The client never retries before its timeout. On a timeout or a network error, or on HTTP 409 `request_in_progress` (a live 12 s lease), the client waits 3 s (`retry_after_s=3`) and retries **once** with the same `Idempotency-Key`. It never sends a different key for the same answer and never races the running turn. The retry has its own 15 s timeout. A retry returns the stored response (replay), resumes from the stored attempt, or, if the lease is somehow still live, a second 409. A second failure shows the client-side deterministic fallback, ends the loading state and keeps the answer in the field. **Why this cannot race the lease.** TX-A, which takes the lease, runs at most about 5.3 s after dispatch (cold start). The lease therefore ends at most about 17.3 s after dispatch. A first-request timeout at 15 s plus the 3 s wait puts the retry at 18 s or later, after the lease has expired, so a crashed turn is resumed. A 409 on a healthy turn is retried at the 3 s mark, and the turn finishes by 7.5 s after TX-A, so a second 409 only occurs when the first request is still genuinely running. That case is real: the single client retry fires 3 s after the first 409, a healthy turn can still be running (up to 7.5 s after TX-A), and the retry can then meet a second 409. The client does not retry a third time. The child-friendly "still working" reassurance message keeps the wait calm and the answer stays in the field, and the client-side deterministic fallback above applies if the second retry also fails.

| Situation at TX-A | Result |
| --- | --- |
| No live lease | Take the lease, proceed |
| Live lease held by a different key | Roll back to the savepoint. 409 `request_in_progress`, `retry_after_s=3`. The rate counter and idempotency record are unwound with it |
| Live lease held by the same key | 409 `request_in_progress` (the first request is still running) |
| Expired lease (crash or time-out) | Reclaimable. If an `attempt` already exists for this key, resume (§3.4). Otherwise proceed as new |
| TX-B finds `lease_holder ≠ key` | Lease was reclaimed. Roll back, 409 `request_in_progress`. Another request owns the session |

**Per-transaction contents.**

| Transaction | Writes (all or nothing) |
| --- | --- |
| TX-A | Lazy abandonment (kept even if the event is then rejected), idempotency `in_progress`, rate counter upsert, attempt row, lease. Everything after the savepoint rolls back on a rejected event |
| TX-B | `tutor_turn` (including `trace_id`, versions, tool results), `attempt.counted`, all `tutoring_session` fields, `misconception_event`, learner-model write (WF-12), `session_flag` rows, audit events for the turn (hashes only), `idempotency_key.status=done` plus the exact `TurnResponse`, lease cleared. For `transfer_decision` accept: the new transfer session and both link fields. For terminal entry: the `summary` and, if the session is a transfer session, the back-fill on the original |
| Post-commit | Langfuse flush, optional `trace_status='missing'` update, progress stream ends |

**Writes outside the two transactions:**

- Audit events for rejections (403, 404, 409, 429, token failures) are written in an **independent transaction** so a rollback cannot erase evidence. Audit rows for successful turns ride in TX-B.
- The `lease_stage` updates and the corrective `trace_status` update are best-effort and never affect turn validity.

**Why this satisfies SPEC:** the answer row exists before any external call (retry can resume), concurrent events never interleave (lease), a turn is visible only after TX-B (persisted before the response), and no connection is held across MCP, A2A or LLM calls.

### 3.4 Idempotency and resume

The attempt row's primary key is derived deterministically from `(session_id, Idempotency-Key)` (UUIDv5), so "does an attempt exist for this key" is a primary-key lookup with no new column (§4.2 DD-03). `student_note` uses the same technique.

| Observed at TX-A | Action |
| --- | --- |
| Key `done`, same body hash | Return stored `TurnResponse`, header `Idempotent-Replay: true`. No counter, attempt or turn change. Not counted for the rate limit |
| Key exists, different body hash | 409 `idempotency_conflict`, audit |
| Key exists on a different session | 409 `idempotency_conflict`, audit |
| Key `in_progress`, lease live | 409 `request_in_progress` |
| Key `in_progress`, lease expired, attempt exists, no turn | Re-take the lease and **resume the pipeline from the stored attempt**. No second attempt, `attempt_count` untouched until TX-B |
| Missing or non-UUID key | 400 `invalid_request` |
| Record older than 24 h | Expired, key reusable |

Because `idempotency_key.status=in_progress` and the attempt row commit together in TX-A, "key present, attempt absent" does not occur. The 24 h expiry is applied lazily on lookup and physically by the same write path as the other expiry sweeps.

A resumed pipeline may produce different model wording from the abandoned run. Only one run ever reaches TX-B, so the student never sees two tutor questions for one request.

### 3.5 Other transaction lifecycles

| Operation | Transaction shape | Notes |
| --- | --- | --- |
| Authentication and scope resolution | Read-only, repeated per request | From Tier 1a: the transaction opens with `SET LOCAL app.user_id` |
| Denial / rejection audit | Independent single-insert transaction | Survives the caller's rollback |
| Session start (WF-02) | One transaction: select, insert, audit | Diagram availability checked before insert |
| Session read / resume | Short transaction with the row lock **only if** lazy abandonment is due, else read-only | Abandonment write is idempotent |
| Transfer accept | Part of TX-B (S6) | Creates the second session and both links atomically |
| Back-fill of `transfer_outcome` | Part of the TX-B that ends the linked session | Only permitted terminal-session write |
| Recommendation decision | One transaction with row lock and SM-2 check | Identical retry returns the stored decision |
| Content decision | One transaction: review item, question status, audit | Rejects `approved` when offline validation has not passed |
| Grant / `allow_level_5` / support-contact change | One transaction with previous and new value in the audit row | Replacing a support contact audits both changes |
| Cron batch | Per work item or small chunk: a short claim-and-read transaction using `FOR UPDATE SKIP LOCKED`, the external call with no transaction open, then a short write transaction with a pending re-check, plus a `job_run` row | A failed chunk rolls back only its write |
| Retention purge | One transaction per chunk | Nulls or deletes bodies only |

**Audit writer.** The unit-of-work exposes `audit()` and commits the buffered events with the business writes. A unit-of-work cannot be committed with domain writes and an unflushed audit buffer. Database permissions and triggers reject `UPDATE`/`DELETE` on `audit_event`. Rows hold ids, hashes and structured fields, never free text, full prompts or raw model output.

**Row-level security (minimal form from Tier 1a, full matrix T3).** Each transaction begins with `SET LOCAL app.user_id`. Pooled connections therefore never carry identity between requests. The API database role is a non-owner without `BYPASSRLS`, every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`, and the lookup of `app_user.id`, role and cohort ids that precedes `SET LOCAL` uses a narrow `SECURITY DEFINER` function keyed by the Clerk `sub` that returns only that user's `app_user.id`, role and cohort ids. The lookup function is owned by a dedicated non-login role, sets `search_path = pg_catalog, public`, has `EXECUTE` revoked from `PUBLIC` and granted only to the API role, and reads `app_user`, `user_grant` and `cohort_assignment` under an explicit policy for that owner role only (BUILD_LOG ADR-013). Tier 1a ships fail-closed policies on every table that holds student-scoped rows (no identity set means no rows), a pooled-connection leak test (mandatory) and `tests/authz` cases for both layers (application checks and RLS), including the non-owner role, `BYPASSRLS` false, `FORCE ROW LEVEL SECURITY` on and a lookup that returns only the caller's rows. The minimal RLS covers every table that holds student-scoped rows. The Tier 1c teacher replay adds a teacher assigned-cohort read policy when it is built. The full per-role policy matrix stays in Tier 3 (SPEC D-30).

### 3.6 Caching

Three exact-key kinds in `cache_entry`; no fuzzy matching. The exact-key cache is Tier 1b only (Tier 1a runs without it).

| Kind | Key (SHA-256 of canonical inputs) | Value | Written | Read | Shared |
| --- | --- | --- | --- | --- | --- |
| `verifier_result` | normalised expression, `question_id`, `question_version`, tolerance rule | `PureVerifierResult` only | After an MCP or in-process verify | Before MCP | Across students |
| `exemplar_query` | `error_category`, `skill_id`, taxonomy version, canonical numeric value, `relation_tags` | Exemplar result list | After `search_exemplars` | Before MCP | Across students |
| `prompt_template` (Tier 1b onward; no cache at Tier 1a) | prompt id, Langfuse version label | Prompt text | After fetch | Before fetch | Across students |

Rules:

1. The value never holds `progress`, hint level, retry count, `response_target` or any session field. The overlay always runs after the lookup.
2. No student free text, name or transcript is ever a key or a value. Keys come from the **normalised** expression, so an unparsed input is never cached.
3. Every entry has `expires_at`. TTL values are open parameters (SPEC §1.5). A rule, taxonomy or prompt-version change expires entries by TTL, and the key already includes the question version and prompt label.
4. A hit or miss always writes a span. A read or write failure is a miss. `hit_count` updates are best-effort and off the critical path.
5. There is no browser or CDN caching of tutor content. The diagram route sends `Cache-Control: private`.

### 3.7 Data flow pipelines

**Turn pipeline (data-minimal by construction).**

```text
raw input ─► scrub_pii ─► normalise ─► {value | ratio | expression | unparsed}
   │                         │                    │
   │                         └ unparsed text ─► input_screen (hit ⇒ short-circuit)
   │ free text (notes) ─► student_note (scrubbed) ────────────► teacher views only
   ▼
numbers-only features ─► verifier ─► overlay ─► matcher ─► gate ─► exemplar query (numbers only)
                                                              └──► classifier (no free text, no answer)
                                  HintDecision ─► dialogue (probe template + code + stem) ─► checks ─► guard
                                                                                 │
                                                                    TX-B ◄───────┘
```

Free text terminates at `student_note` or in the Input Screen. It reaches no model prompt, no Langfuse span and no cache in Release 1.0. A prompt-capture test proves it, and `before_model` enforces it at runtime.

**Learner-model flow.**

```text
TX-B (turn-time) ─► learner_skill_state.mastery_estimate / mastery_confidence
        │                 (counted success: +0.15 at L0, +0.05 after L1–3, none at L4/5;
        │                  transfer success: confidence +0.20; conflict rule −0.10; caps and floor)
        └─► next WF-02 selection reads this write (read-your-writes within the same student)
learner-rollup (hourly) ─► recent_accuracy, median_response_seconds, independent_success_rate,
                           hint_dependency_profile, misconception_distribution, transfer_success_rate,
                           cohort aggregates, rollup_at   (≤ 1 h behind; dashboard shows rollup_at)
```

The conflict rule is evaluated once per persisted counted attempt, so a replayed or resumed turn cannot apply it twice (TX-B is the single write point and is guarded by the lease).

**Educator pipeline.**

```text
attempts / turns / misconception_events ─► (request time) review list
                                         └► (hourly/daily jobs) groups, trends, profile aggregates
aggregated events ─► insight-drafts ─► TeacherInsightAgent ─► wording check ─► recommendation(pending)
                                                                   └ rejected drafts stored, never shown
teacher decision ─► recommendation + audit ─► later transfer outcomes feed coordinator summary
```

**Content pipeline.**

```text
authored JSON ─► import validation (V1–V9, C1–C3; C4 at release, Gate B tag) ─► question(pending, draft)
diagram spec ─► render ─► validate_diagram ─► Blob variants + diagram_asset(pending)
reviewer approval ─► approved ─► publish ─► embedding-sync (768-d) ─► question_embedding (transfer tie-break, near-duplicate scan)
serve filter (everywhere, including vectors and planner): approved ∧ published ∧ ¬flagged ∧ scope enabled ∧ FR-02 complete
```

**Observability pipeline.** Spans are created in the orchestrator, MCP and Safety with W3C trace context propagated on every HTTP hop. A masking function runs before export. The trace id is stored on the turn. Scores attach to traces. Postgres audit is authoritative and Langfuse is supplementary. Sentry is separate: it receives only scrubbed application errors and crashes (unhandled exceptions, unhandled 5xx, failed browser network calls, error boundaries), never LLM, agent, verifier or safety spans, and a handled fallback is not a Sentry event. Langfuse receives no application crashes.

**Retention pipeline.** `retention-purge` removes bodies, not rows (§3.8). Replay and evidence links continue to open on purged rows with a notice.

### 3.8 Persistence boundaries, retention and freshness

| Data | Store | Boundary rule | Retention (`RETENTION_POLICY_VERSION`) |
| --- | --- | --- | --- |
| Chat bodies | `tutor_turn.body` | Nullable | 90 days → body null, row kept |
| Attempts | `attempt` | `response_value`, `step_expressions`, `free_text` purgeable | 365 days → those fields deleted, status, level, skill, timestamps kept |
| Notes, comments | `student_note`, `teacher_comment`, `tutor_note` | `body` purgeable | 365 days → body deleted, row kept |
| Model traces | Langfuse | Link in replay | 90 days → link replaced by expiry notice |
| Student-specific diagram blobs | Blob | Controlled routes | 90 days → blob deleted |
| Audit rows, approved question diagrams | Postgres, Blob | Append-only / immutable | Never deleted |

**Freshness contract.**

| Read | Source | Staleness |
| --- | --- | --- |
| Session, controls, next target, turns | Postgres row | Strongly consistent |
| Practice Planner choice | `learner_skill_state` turn-time fields | Includes the student's own last write |
| Review list | Attempts at request time | Strongly consistent |
| Student dashboard, profile, groups, trends, coordinator summary | Rollup output | ≤ 1 h. `rollup_at` shown. A saved session is listed from persisted turns without waiting |
| Recommendations | Stored drafts | Daily, or on demand |
| Cache | `cache_entry` | Up to TTL (value pure, so staleness is bounded to rule changes, covered by key components) |

**Connection policy.** Request handlers use the pooled string. Because each serverless instance pools separately, the per-instance pool is small (or none) so that instances times pool size stays under the pooler's client limit, and prepared-statement caching is disabled on the driver (transaction-mode pooler). Migrations use the unpooled string. No handler relies on session-level connection state. A cron job never holds a transaction open across an LLM or embedding call: it selects its batch with `FOR UPDATE SKIP LOCKED` and reads the inputs in one short transaction, makes the external call with no transaction open, then writes the result in a second short transaction that re-checks the work is still pending. Two overlapping runs may repeat an external call but never store a duplicate result. The database may autosuspend on lower plans, so the first request after idle can pay a wake-up delay that the 150 ms load budget does not cover. The warmup job pings the database as well as the services.

**Cross-component synchronisation.**

| Between | Mechanism |
| --- | --- |
| Orchestrator ↔ MCP data | Both read the same approved question version. The orchestrator passes `question_version`, so a verifier call can never use a different version than the session pinned |
| Orchestrator ↔ in-process fallback | Same module, same schemas, same tolerance rules |
| API ↔ web types | Generated from `contracts`. Contract drift fails CI |
| Cron jobs ↔ request path | Jobs write only aggregates and drafts. They never touch the live session or turn rows, except retention purge, which nulls bodies on rows already outside the window |
| Cohort `allow_level_5` ↔ policy | Read from Postgres at `decide_hint` each turn. A change applies from the next decision |

---

## 4. Design Patterns & Architectural Decisions

### 4.1 Pattern catalogue

| Pattern | Where applied | Requirement it solves | Rationale |
| --- | --- | --- | --- |
| **Workflow harness (fixed pipeline), not ReAct** | ADK `SequentialAgent` turn pipeline | SC-05, SC-06, SC-19 | The model must not choose tools, verdicts or reveal timing. A fixed order is testable, traceable and cost-bounded |
| **Table-driven finite-state machine** | `transitions.yaml` + `transitions.apply` | FR-05 | Legal moves are data, diffed against SPEC in CI. Unlisted pairs fail closed with 409 |
| **Functional core, imperative shell** | L4 engines (pure) vs L3/L5/L6/L7 | FR-04, FR-06, testability | Every correctness rule is a pure function that can be exercised without a database or a model |
| **Pure result + uncached overlay** | Verifier and `apply_overlay` | FR-04 | Maximises cache sharing across students while keeping session context out of the cache |
| **Bounded loop with deterministic gate first** | `LoopAgent` (≤ 2): dialogue → `check_candidate` → Safety Guard → final override | SC-18 | Cheap deterministic checks run before the model guard. A deterministic hit always wins. Two attempts cap cost and latency |
| **Fail-closed fallback ladder (degradation chain)** | Cached → MCP → repeat MCP (or in-process on a container topology); guard → in-process → `fallback_l{level}` | SC-19 | Every failure terminates in an authored, mathematics-free prompt. Never a verdict or unguarded text |
| **Ports and adapters** | Provider adapter, MCP client, A2A client, Blob client, Langfuse exporter | PRD §9.6, §15.6 | Vendors and transports are swappable (Gemini/OpenRouter/vLLM, Vercel/container). Agents import none of them |
| **Proxy with a single transparent fallback** | MCP and A2A clients | Cold-start resilience | A2A: the same module serves HTTP and in-process calls. MCP: a repeat call on the Vercel topology, the same module in process on a container topology. Spans record the protocol used |
| **Policy as versioned data** | `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION`, prompts in Langfuse (Tier 1b onward; Tier 1a repo files), `canned_responses.json`, `input_lexicon.json`, `jargon.json` | FR-06, ADM-05 | Behaviour changes are versioned, stamped on each turn and replayable |
| **Authored content over generated content** | Levels 4–5, canned registry, reflection, diagrams | FR-06, FR-09, SC-10 | Anything that could leak or mislead is rendered by template from reviewed data, not generated |
| **Closed enum + schema validation** | Taxonomy, `error_category`, `SocraticDialogueOutput`, `SafetyVerdict` | SC-08, §9.5 | An out-of-set model output is rejected, never repaired by guessing |
| **Idempotent receiver with lease** | `Idempotency-Key` + `idempotency_key` + session lease | FR-05, STU-12 | Safe client retries and non-interleaved concurrent events without holding a connection across external calls |
| **Unit of work with mandatory audit** | L6 | SC-16 | Feature code cannot commit without the audit buffer. Rejections audit in an independent transaction |
| **Cache-aside, exact key** | `cache_entry` | §5.5 | Deterministic, auditable, no fuzzy matching, no free text |
| **Repository with built-in scoping** | L6 queries embed student/cohort scope and the serve filter | SC-01, SC-02 | Ownership and "approved ∧ published ∧ ¬flagged" cannot be forgotten at a call site. Vector search and the planner reuse the same filter |
| **Lazy state normalisation** | Abandonment on read/write | D-12 | No sweeper job needed. Terminal state is correct whenever observed |
| **Resumable batch job** | Six cron jobs | FR-16 | Work to do is derived from data (rows lacking embeddings, events after `rollup_at`, rows past retention), so overlapping or interrupted runs converge to the same result |
| **Skill graph as curriculum memory** | `graph_node`, `graph_edge` | FR-08, FR-10 | Legality of the next item is a graph decision. Vectors only shortlist and tie-break (D-19) |
| **Contract-first** | `contracts.py` → OpenAPI → web types | TECH-56 | One definition, drift is a CI failure |
| **Append-only ledger** | `audit_event` | FR-15 | Immutability enforced by role and trigger, not by convention |
| **Callbacks as guards** | `before_model` prompt-capture, `before_tool` allow-list | §9.2 | Privacy and tool rules are enforced at the framework hook, not by agent prompt |

### 4.2 Architectural decision records

Reversibility: **High** = change by code and redeploy, **Medium** = needs a migration or data backfill, **Low** = embedded in stored data or an external contract.

| ID | Decision | Alternatives considered | Why this one | Trade-off accepted | Reversibility |
| --- | --- | --- | --- | --- | --- |
| DD-01 | **Session lease + short TX-A/TX-B** to serialise events (owner-approved). A different-key event during a live lease returns the existing retryable 409 `request_in_progress` | (a) One open transaction per turn (literal D-14). (b) Lease with a bounded wait | (a) contradicts "attempt stored before pipeline" and pins a pooled connection for up to 7.5 s. (b) occupies a function and pool slot and adds a tunable | A second tap during a turn gets a retryable 409 rather than waiting. The client already disables input during a turn. Adds three columns on `tutoring_session` and one configuration value (lease duration, fixed at 12 s) | High. The lease lives in one table and one code path |
| DD-02 | **One `tutor_turn` row per answer-bearing event**. None for Input Screen hits or note acknowledgements. `tutor_turn.turn_number` is a per-session ordinal. The cap counter stays on the session (owner-approved) | Row for every reply. Rows for pipeline turns only | Replay shows every reply to an attempt (including `rephrase_request`) without storing note replies. Keeps the cap rule unambiguous | The two numbers differ, so code must not use the ordinal for the cap | Medium (backfill if later changed) |
| DD-03 | **Attempt primary key derived (UUIDv5) from session id and idempotency key** | Add `idempotency_key` column to `attempt`. Add `attempt_id` to `idempotency_key` | Resume lookup is a PK read. No new column on a retention-sensitive table | Id is not random. It leaks nothing because both inputs are already known to the caller | Medium |
| DD-04 | **Orchestrator-driven persistence with ADK as an execution engine only** | ADK `DatabaseSessionService` as system of record | The authoritative record must carry the SPEC columns, FSM guards, lease and audit. Hydrating ADK state per turn keeps one source of truth | ADK-native session inspection tools are not used. Replay comes from `tutor_turn` and Langfuse | High. State keys are a pure function of rows, so adopting the ADK service later does not change the schema |
| DD-05 | **Question loading on the hot path uses the repository directly. MCP `get_question` serves tool consumers.** Verification still goes through MCP | Load the question through MCP each turn | Saves one network hop inside the 150 ms session-and-question load budget and keeps solution data off the wire on the hot path | Two read paths to the same table. Both apply one shared serve filter | High |
| DD-06 | **Postgres is the only shared store** (domain, vectors, graph, cache, counters, audit) | Redis or in-memory cache. A graph database. A separate vector store | SPEC mandates it. One transactional store gives atomic turn writes and a single backup unit. At the demo scale (10 concurrent students) a second store adds operational cost without benefit | Cache and rate counters add small writes on the request path. A higher load would move them out | Medium. Cache and counters sit behind store interfaces in L6 |
| DD-07 | **Pure verifier behind MCP from Phase B. Phase A bundles it in the API.** From Phase B SymPy is packaged only in the MCP bundle and the API reaches it through MCP, with a repeat MCP call as the single fallback on the Vercel topology and an in-process call only on a container topology that packages SymPy with the API | Always in process. Always remote. SymPy in both bundles | Meets the MCP requirement, keeps the API bundle small from Phase B, and the MCP limit is a measured 90 MB (SymPy alone is about 29 MB, so 30 MB was unreachable). Phase A lets Slice 0 and Tier 1a run as one deployable and pass CI. A cold start must not become a false `tool_failure`: the repeat call lands on an instance the first call has warmed | A cold MCP call costs the 400 ms timeout plus a repeat call. The normaliser and the verifier module keep to the layer rules so the Phase B split needs no rewrite | High |
| DD-08 | **Safety as a separate A2A service plus a deterministic first-line check** | In-process guard only. Model-only guard | Independent failure domain and a distinct trace span, and a deterministic override that a model `allow` cannot bypass | Extra hop and warm-up cron. **Recorded trade-offs:** (1) the in-process fallback runs inside the orchestrator, so when it is used the privilege separation does not hold for that call. (2) The guard receives `forbidden_strings[]` (the accepted answer, solution-step values and not-yet-produced probe values) strictly so it can recognise leakage. This is a constrained exception to the no-answer-to-LLM rule. The strings are never in spans or audit rows (count and hash only) and never returned | High |
| DD-09 | **Persist first, flush Langfuse second (after the response where the platform allows)**, with a corrective `trace_status='missing'` update when the flush fails | Flush before commit so status is known at insert. Default to `missing` and update to `ok` | Matches the SPEC order (step 11 then 12) and keeps trace export out of the commit path. A failed best-effort update is the lesser evil | A crash between commit and flush leaves `trace_status=ok` for a trace that never arrived | High |
| DD-10 | **`lease_stage` written non-transactionally for the progress stream** | In-memory stage per instance. No stream | Serverless instances share no memory. The stream is optional and carries only three stage names, read by polling Postgres | Up to two small best-effort writes per turn | High |
| DD-11 | **Reflection and transfer-offer text are authored, no model, no guard** | LLM-paraphrased reflection feedback | No leak surface. Satisfies "no unguarded model text" trivially | Less varied wording | High |
| DD-12 | **Linked transfer session (R1)** — accepting creates a new session and completes the original | Same session continues | Clean cap, summary and outcome accounting per item. Back-fill of `transfer_outcome` is the sole terminal write | One extra row, one back-fill path | Medium |
| DD-13 | **Role-checks in dependencies, scope in repositories, RLS as defence in depth (minimal form Tier 1a, full matrix T3)** | RLS only. Application checks only | Fails closed in two independent layers (SPEC SC-01). Minimal RLS is pulled forward to Tier 1a so both layers exist before Gate A. The API role is a non-owner without `BYPASSRLS`, every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY` and the pre-`SET LOCAL` lookup is a narrow `SECURITY DEFINER` function owned by a dedicated non-login role (BUILD_LOG ADR-012, ADR-013). The Tier 1c teacher replay adds a teacher assigned-cohort read policy. Only the full matrix waits for T3 | Duplicate rules to test (`tests/authz`) | High |
| DD-14 | **Separate Postgres roles per deployable** (API, MCP, Safety, migrations) | One shared credential | MCP holds solution data but no student tables. Safety holds neither | More secrets to rotate (every 90 days) | High |
| DD-15 | **Abandonment applied in the request path under the row lock** | A sweeper cron | No seventh-plus job and no stale-state window. The transition is deterministic from `last_activity_at` | A read request can write | High |
| DD-16 | **Jobs derive pending work from data, not stored cursors, using `FOR UPDATE SKIP LOCKED`** | Persisted cursor per job. Advisory locks | Transaction-mode pooler forbids session advisory locks. Data-derived work converges after any interruption | Selection queries need supporting indexes | High |

### 4.3 Irreversibility register

These choices are expensive to change once data exists. Each has a mitigation built into the design.

| Choice | Why it is hard to undo | Mitigation |
| --- | --- | --- |
| Pseudonymous `app_user.id` as the key in every table, trace and audit row | Re-keying touches immutable audit rows | No name or email is stored anywhere. Clerk identity maps through `clerk_user_id` only |
| Immutable `question` rows per `(question_id, version)` and the version pinned in the session | Sessions, attempts, replay and evidence refer to versions | An edit creates a new version. The old one stays readable. Deprecation is a status, not a delete |
| Append-only `audit_event` schema | Cannot be edited after the fact | Structured columns plus a `hashes` JSON for extension. Event types are an enum extended by migration |
| `vector(768)` embeddings | Dimension change invalidates every vector | `embedding-sync` supports re-embedding after a model or dimension change. Keep the dimension in one configuration constant and a migration path |
| Closed 13-value misconception taxonomy | Stored `misconception_event.code` values and exemplars depend on it | `taxonomy_version` is part of the cache key and exemplar rows. Add values by migration with a version bump |
| Public API contract (`TurnRequest`, `TurnResponse`, error payload) | Client and tests depend on it | `schema_version` on agent outputs. OpenAPI generated from one source, drift fails CI. The client only renders `tutor.controls` |
| `tutor_turn` and `attempt` column set | Retention, replay and evidence refer to it | Columns follow PRD §10.7 exactly. New data goes in JSON fields (`verifier_result`, `student_state`) before new columns are added |
| Four-deployable split and separate entrypoints | Network contracts and secrets | Same modules run in process. Moving to containers (Railway/Docker) requires no code change (PRD §15.6) |
| Hint ladder invariants (levels 0–5, +1 cap 4, Level 5 only via the four-condition gate) | Teachers and evaluations interpret stored levels | The ladder is data in the policy configuration, versioned per turn (`policy_version`, `policy_config_version`) |
| Deterministic mastery rules | Historical `learner_skill_state` values mix rule versions | Rules live behind `update_learner_model` and are stamped by policy version. Rollup recomputes the aggregates, not the turn-time values |

### 4.4 Interpretations made while translating SPEC (for owner confirmation)

These are the points where SPEC was silent or conflicted. Items 1 and 2 were decided by the product owner. The rest follow from SPEC text and are flagged so they can be confirmed or reversed cheaply.

| # | Item | Resolution in this design | Basis |
| --- | --- | --- | --- |
| 1 | D-14 concurrency mechanism | Lease on the session row, different-key conflict returns 409 `request_in_progress` (DD-01) | Owner decision. SPEC D-14 and WF-03 step 1 cannot both hold with a plain row lock |
| 2 | Which replies get a `tutor_turn` row | Answer-bearing events only (DD-02) | Owner decision |
| 3 | How a retry finds its attempt | Deterministic attempt id (DD-03) | §3.2 resume rule needs a lookup SPEC does not define |
| 4 | `trace_status` accuracy vs commit order | Persist then flush, corrective update (DD-09) | SPEC steps 11 and 12 |
| 5 | Source of the progress stage | `lease_stage` (DD-10) | SPEC §3.2 progress stream, serverless statelessness |
| 6 | Where abandonment is committed on a rejected event | Committed before the savepoint (S3, §3.3) | D-12 requires it to be applied first |
| 7 | Question loading path | Repository on the hot path (DD-05) | SPEC budget of 150 ms for session and question load |
| 8 | Precedence of 429 vs 409 | 429 before `transitions.apply`, as in WF-03 step 0 | WF-03 step 0 order |
| 9 | Revision-gate behaviour at the budget edge | Second iteration starts only if its stage timeouts fit before 7.5 s. Otherwise `budget` | SPEC §5.1 "a fallback that would take the turn past 7.5 s goes straight to the deterministic fallback" |
| 10 | Replay of the opening canned `level0_prompt` | Not stored as a `tutor_turn`. Rendered from the registry when a session has no turns | Follows DD-02 (not an answer-bearing event) |

Item 9 and the corresponding sentence in §2.3 rely on one reading of SPEC: `loop_exhausted` applies when two iterations were rejected, or an `escalate` verdict was returned, and `budget` applies when time prevents an iteration.

### 4.5 Open parameters carried from SPEC

The design names where each is configured and does not set a number (SPEC §1.5).

| Parameter | Configured in | Used by |
| --- | --- | --- |
| Exemplar top-k | Policy configuration (`POLICY_CONFIG_VERSION`) | `search_exemplars` |
| Cache TTLs per kind | Policy configuration | `cache_entry.expires_at` |
| Near-duplicate cosine threshold; difficulty-anomaly and "excessive confusion" thresholds | Policy configuration | `item-quality-scan` |
| `tone` value set | Policy configuration | `decide_hint`, Dialogue Agent |
| Evidence-limit sample threshold; group confidence computation | Policy configuration | OP-03, OP-04, WF-16 |
| "Strengths and next focus" computation | Policy configuration | Student dashboard |
| `confidence_rating` range (provisional 1–5) and payload limits (provisional) | `contracts` and request validation | `TurnRequest` |
| **Session lease duration** | `SESSION_LEASE_SECONDS`, fixed at **12** | TX-A / lease check. Exceeds 7.5 s + 200 ms and is below function `maxDuration` |
