# SolvePath — Technical Implementation (TECHNICAL.md)

Sources: `PRD.md` (§11, §15–17, §22), `SPEC.md` (§1.3, §5), `DESIGN.md` (§1–4).

Conventions:

- **Stated** means a value fixed by a source document. The source is cited.
- **TBD** means the sources defer the value. It is not decided here. The owner is named.
- Nothing in this file adds a tool, service or version that the sources do not name.

---

## 1. Technology Stack & Rationale

### 1.1 Runtimes, languages and frameworks

| Layer | Choice | Version constraint | Source |
| --- | --- | --- | --- |
| Backend language | Python | 3.12 | PRD §15.1 |
| API framework | FastAPI, async endpoints | TBD (Phase 0 ADR) | PRD §15.1 |
| Contracts and validation | Pydantic v2 (`contracts.py` is the single source of truth) | v2 | PRD §15.1, DESIGN §1.4 |
| ORM and migrations | SQLAlchemy 2, Alembic | SQLAlchemy 2.x. Alembic TBD | PRD §15.1 |
| Agent orchestration | Google ADK (Python): `SequentialAgent`, `LoopAgent`, `LlmAgent`, `BaseAgent`, callbacks | Exact version TBD (Decision #30, Phase 0 ADR) | PRD §15.1, §22.1 #30 |
| Agent protocols | MCP (streamable HTTP, stateless) and A2A, as separate entrypoints | MCP SDK and A2A SDK versions TBD (Decision #30) | PRD §15.1, DESIGN §2.1 |
| Mathematics | SymPy, mpmath | TBD | SPEC §5.5, DESIGN §1.3 |
| Frontend language and build | TypeScript, Vite SPA | Vite and TypeScript versions TBD | PRD §15.1, §22.1 #1 |
| Frontend framework | React 18 | 18.x | PRD §15.1 |
| Frontend libraries | React Router, TanStack Query, Tailwind CSS, KaTeX, accessible primitives (Radix named as an example) | TBD | PRD §15.1 |
| Node (CI skeleton) | Node.js | 20 | PRD §17.3 |

### 1.2 Storage, messaging and external services

| Concern | Choice | Notes | Source |
| --- | --- | --- | --- |
| Relational, vector, graph, cache, counters, audit | PostgreSQL on Neon, with pgvector (`CREATE EXTENSION IF NOT EXISTS vector;` in the first Alembic migration) | One store for everything. Skill graph is Postgres edges. Cache is the `cache_entry` table | PRD §15.1, §10.2, DESIGN DD-06 |
| Embeddings | `vector(768)`, model named by `MODEL_EMBEDDING` | Exact model id TBD (Decision #28, #30) | PRD §22.1 #28 |
| Object storage | Vercel Blob | Diagram SVGs, content imports, exports | PRD §15.1 |
| LLM provider | Adapter. Gemini by default. OpenRouter is the alternate. vLLM (OpenAI-compatible) is a later swap | Selected with `LLM_PROVIDER` | PRD §22.1 #3, #4, #27 |
| Identity | Clerk (identity proof only) | Roles and scope are decided in Postgres | PRD §22.1 #12, SPEC §1.3 |
| Observability | Langfuse Cloud, OTLP export, OpenTelemetry/OpenInference instrumentation for ADK | One project tag per environment | PRD §15.5, §22.1 #8 |
| Background work | Vercel Cron calling `/api/jobs/*` | **No message queue and no background worker** on the student path | PRD §22.1 #9, DESIGN §2.1 |
| Hosting | Vercel, four projects from one monorepo | Pro plan | PRD §15.4, §22.1 #13 |
| CI/CD | GitHub Actions as the required quality gate. Vercel Git integration deploys | | PRD §22.1 #11 |

### 1.3 Rationale and lock-in controls

| Decision | Rationale | Lock-in or bottleneck control |
| --- | --- | --- |
| Deterministic workflow harness, not an agent mesh | Models never choose tools, verdicts, hint levels or transitions. The fixed order is testable and cost-bounded | The table-driven FSM (`transitions.yaml`) is data, with parity to SPEC checked in CI |
| Postgres as the only shared store (DD-06) | One transactional store gives atomic turn writes and one backup unit at demo scale (10 concurrent students) | Cache and counters sit behind L6 store interfaces, so they can move out under higher load |
| LLM provider adapter | Gemini, OpenRouter and vLLM use the same agent schemas. Agents import no vendor SDK | Only L7 imports vendor SDKs. A provider change is configuration plus adapter code |
| ADK as an execution engine only (DD-04) | The authoritative record carries the SPEC columns, FSM guards, lease and audit | ADK state is a pure function of Postgres rows. `DatabaseSessionService` can be adopted later without a schema change |
| Pure verifier behind MCP with in-process fallback of the same module (DD-07) | Meets the MCP requirement. A cold start never becomes a false `tool_failure` | Same module serves HTTP and in-process calls |
| No separate graph or vector database | Graph is Postgres edges. Vectors only shortlist and tie-break. The graph decides legality (D-19) | Fewer runtimes to deploy and secure (Decision #5) |
| Vite SPA rather than Next.js (Decision #26) | The API is Python. No SEO or server rendering is needed. One fewer server runtime | Revisit only if server-rendered pages are needed |
| Container-portable API, MCP and Safety | Moving to Railway or Docker needs no code change (PRD §15.6) | Configuration is environment variables only. No Vercel-only APIs in L0–L6 (see §5.2) |
| Pooled Postgres string for requests, unpooled for migrations | Neon's pooler is transaction-mode, which suits serverless | No session-level connection state anywhere (see §5.2) |

---

## 2. Local Development Setup & Toolchain

### 2.1 Prerequisites

| Requirement | Constraint | Source |
| --- | --- | --- |
| Python | 3.12 | PRD §15.1 |
| Node.js | 20 (the version in the CI skeleton) | PRD §17.3 |
| Python tooling | `pip` with a virtual environment. Install with `pip install -e "apps/api[dev]"` | PRD §17.3 |
| JavaScript tooling | `npm` | PRD §11.5, §17.1 |
| Vercel CLI | `vercel`, used for `vercel env pull`. CI installs `vercel@latest` | PRD §16.2, §17.3 |
| Git | Required | — |
| `gitleaks` | Required to reproduce the CI secret scan locally | PRD §17.1 |
| Accounts and access | Vercel (Pro), Neon, Clerk, Langfuse Cloud, Google AI Studio key (or Vertex credentials), GitHub | PRD §15, §16.2 |

The sources name no Python or Node version manager. Developers choose their own.

### 2.2 Repository layout (stated in PRD §16.1)

```text
apps/web      React + TypeScript (Vite)
apps/api      FastAPI + ADK. Entrypoints: api/index.py, mcp_server.py, a2a_safety.py
              pyproject.toml, vercel.json, tests/, app/ (logical layers per DESIGN §1.4)
content/      questions, misconceptions, safety, eval, seed
docs/         adr, threat-model.md, runbook.md
scripts/      sync_stories.py, seed_synthetic.py
.github/workflows/
```

DESIGN §1.4 states that module names beyond those SPEC names are logical and indicative. SPEC does not fix a source tree.

### 2.3 Environment setup

1. Create a Python 3.12 virtual environment. Run `pip install -e "apps/api[dev]"`.
2. In `apps/web`, run `npm install`.
3. Run `vercel env pull` to write `.env.local` from the **Development** environment (PRD §16.2).
4. The Development environment points at its own Neon database (a dev branch or a dedicated dev database). No local Postgres container is used.
5. Apply migrations with Alembic using `DATABASE_URL_UNPOOLED`.
6. Load synthetic data with `scripts/seed_synthetic.py`. Seed users come from `content/seed/users.json`.

The pgvector extension is created by the first Alembic migration. Seeding the first administrator reads `BOOTSTRAP_ADMIN_CLERK_ID`, which only the seed script reads.

### 2.4 Configuration variables

Source: PRD §16.2. "Secret" means the value must live only in the secret store.

| Variable | Used by | Purpose | Secret |
| --- | --- | --- | --- |
| `APP_ENV` | api, web | `development`, `preview`, `production` | No |
| `DATABASE_URL` | api | Pooled Postgres string (request handlers) | Yes |
| `DATABASE_URL_UNPOOLED` | api (migrations) | Direct Postgres string | Yes |
| `BLOB_READ_WRITE_TOKEN` | api | Vercel Blob | Yes |
| `LLM_PROVIDER` | api | `gemini` (default), `openrouter`, `vllm` | No |
| `GOOGLE_API_KEY` | api | Gemini via AI Studio (or Vertex via `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) | Yes |
| `OPENROUTER_API_KEY` | api | Only when `LLM_PROVIDER=openrouter` | Yes |
| `VLLM_BASE_URL` | api | Only when `LLM_PROVIDER=vllm` | No |
| `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING` | api | Per-agent model selection. Values TBD (Decision #30) | No |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | api | Langfuse project credentials | Yes |
| `LANGFUSE_HOST`, `LANGFUSE_PROMPT_LABEL` | api | Base URL and pinned prompt label | No |
| `CRON_SECRET` | api | Bearer token for Vercel Cron | Yes |
| `INTERNAL_SERVICE_TOKEN_MCP` | api, mcp | HMAC secret for tokens to `solvepath-mcp` | Yes |
| `INTERNAL_SERVICE_TOKEN_SAFETY` | api, safety | HMAC secret for tokens to `solvepath-safety` | Yes |
| `DIALOGUE_MODE` | api | `llm` or `template` | No |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` | api | JWT verification | No |
| `AUTH_SECRET_KEY` (provider-specific) | api | Identity provider server key | Yes |
| `BOOTSTRAP_ADMIN_CLERK_ID` | seed script only | First administrator. The API process does not read it | No |
| `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION` | api | Stamped on each turn | No |
| `RETENTION_POLICY_VERSION` | api | Retention rule version (SPEC §5.10, DESIGN §3.8) | No |
| `LLM_TIMEOUT_SECONDS` | api | Upper bound for model and tool calls | No |
| Session lease duration | api | Name TBD. Must exceed 7.5 s + 200 ms and stay below the function `maxDuration` (DESIGN §3.3, §4.5) | No |
| `VITE_API_BASE_URL` | web | API base path (typically `/api`) | No |
| `VITE_AUTH_PUBLISHABLE_KEY` | web | Public identity key | No |

### 2.5 Secret handling

- All secrets live in **Vercel Environment Variables**, scoped to Development, Preview and Production. Mark sensitive values as Sensitive (PRD §11.1).
- Nothing secret is committed. `.env*` files are git-ignored. `.env.example` lists names only (PRD §16.2).
- Only `VITE_`-prefixed variables reach the browser. They never hold a secret.
- Local values come from `vercel env pull` into `.env.local`.
- Preview uses separate database and Langfuse credentials from Production.
- Each service holds only its own service-token secret (Decision #37, DESIGN §1.7). The API holds both signing secrets. MCP holds only `INTERNAL_SERVICE_TOKEN_MCP`. Safety holds only `INTERNAL_SERVICE_TOKEN_SAFETY`.
- Rotation: every 90 days and after any suspected exposure (SPEC §5.7).
- GitHub Secrets hold only CI deployment credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, project ids, per-environment database URLs for migrations) and CI-time evaluation keys (PRD §16.2, §17.3).
- Development and Preview data is synthetic only. No real student name, email or record is used.

### 2.6 Build, lint and verification commands

Only commands the sources name are listed. Exact script names and flags are defined when the tooling is created.

| Purpose | Command | Source |
| --- | --- | --- |
| Install API | `pip install -e "apps/api[dev]"` | PRD §17.3 |
| Python lint and type-check | Ruff, mypy | PRD §17.1 |
| Frontend lint and type-check | ESLint, `tsc` | PRD §17.1 |
| Critical tests | `pytest apps/api/tests -m "critical"` | PRD §17.3 |
| Authorisation tests | `tests/authz` (at least 9 Tier 1 cases) | SPEC §5.9 |
| Other test groups | unit, schema, verifier, FSM table parity, content validation, `tests/contract` (OpenAPI and web-type drift) | PRD §17.1 |
| Release check | `pytest -m release` (C4: every canned key `reviewed`). Not run on pull requests | PRD §14, SPEC §5.9 |
| Smoke test | `pytest apps/api/tests/smoke --base-url <url>` | PRD §17.3 |
| Migrations | `alembic upgrade head` with `DATABASE_URL_UNPOOLED`. Run only from CI for shared environments | PRD §17.3, DESIGN §1.7 |
| Dependency and secret scans | `pip-audit`, `npm audit`, `gitleaks` | PRD §17.1 |
| Accessibility | `axe` on the practice screen | PRD §17.1 |
| Story sync | `scripts/sync_stories.py --check` | PRD §17.1 |
| Import-boundary check | An import-linter style check enforcing DESIGN §1.4 rules 1–4. Tool choice TBD | DESIGN §1.4 |
| Bundle size | Unzipped API bundle ≤ 250 MB. MCP bundle < 30 MB | SPEC §5.2 |
| Evaluation | `eval.yml` runs the suite against the Langfuse dataset | PRD §17.1 |

CI workflows (SPEC §5.10): `ci.yml`, `eval.yml`, `deploy-preview.yml`, `deploy-prod.yml`, `content-validate.yml`.

---

## 3. External Dependencies & Third-Party Integrations

### 3.1 Direct dependencies

Versions are TBD unless a constraint is shown. Pinning is owned by the Phase 0 ADR (Decision #30). A change to `google-adk`, the A2A SDK, the MCP SDK, the Gemini model id or `MODEL_EMBEDDING` re-runs the replay and live gates (PRD §14.5).

**Orchestrator (`solvepath-api`)**

| Dependency | Constraint | Role |
| --- | --- | --- |
| FastAPI | TBD | HTTP layer |
| Pydantic | v2 | Contracts |
| SQLAlchemy | 2.x | Persistence (L6 only) |
| Alembic | TBD | Migrations |
| Postgres driver | TBD (not named in the sources) | L6 only |
| `google-adk` | Exact pin TBD (Decision #30) | Pipeline (L5 only) |
| MCP SDK, A2A SDK | Exact pins TBD (Decision #30) | Clients (L7 only) |
| SymPy | TBD. Imported at module load for the in-process fallback | Verifier fallback |
| Provider adapter and vendor SDKs | TBD | L7 only |
| Langfuse client, OpenTelemetry/OpenInference | TBD | Tracing (L7 only) |
| Blob client, JWKS client | TBD | L7 only |

**MCP server (`solvepath-mcp`)**: SymPy, mpmath, a Postgres driver, one HTTP client for embeddings, Pydantic subset. **No ADK, pandas, torch or transformers** (PRD §15.6, DESIGN §1.3).

**Safety Guard (`solvepath-safety`)**: an HTTP client for `MODEL_SAFETY`, Pydantic.

**Web (`solvepath-web`)**: React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, KaTeX, the Clerk SDK, an accessible component library (Radix named as an example). Web types are generated from the OpenAPI document derived from `contracts`. The generator tool is TBD.

**Development and CI**: pytest, Ruff, mypy, ESLint, `tsc`, `pip-audit`, `npm audit`, `gitleaks`, `axe`, Vercel CLI, GitHub Actions (`actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4` in the PRD skeleton).

### 3.2 External services

| Service | Used for | Authentication | Failure behaviour |
| --- | --- | --- | --- |
| Clerk | Identity proof | JWT verified against JWKS (cache ≤ 1 h). Only `sub` is trusted. Role and scope come from Postgres | No usable JWKS cache → 503. Never fail open |
| LLM provider (Gemini default, OpenRouter alternate) | Dialogue, Classifier, Safety model, Teacher Insight, embeddings | `GOOGLE_API_KEY` (or Vertex credentials), `OPENROUTER_API_KEY` | Timeout, 429, 5xx or invalid schema → deterministic fallback. One schema repair, no free-form retry |
| Neon Postgres + pgvector | All durable state | Pooled and unpooled strings. Separate roles per deployable (API, MCP, Safety, migrations) | Before attempt stored → 503. After pipeline → 503 and retry resumes |
| Vercel Blob | Diagrams, imports, exports | `BLOB_READ_WRITE_TOKEN` | Render the SVG in process from the validated spec, else probe text without a diagram |
| Langfuse Cloud | Traces, prompts, datasets, scores | Public and secret keys | Never fails a turn. `trace_status=missing` |
| Vercel Cron | Seven job routes | `Authorization: Bearer CRON_SECRET`. Mismatch → 401, log and audit, nothing runs | Remainder resumes on next invocation |
| `solvepath-mcp`, `solvepath-safety` | Verification, retrieval, safety verdict | Short-lived HMAC bearer: `aud`, `iat`, `exp`, `exp − iat ≤ 60 s`. One secret per target | Timeout or connect failure → one in-process fallback. HTTP 4xx/5xx is never retried |

### 3.3 Rate-limit and spend guardrails

| Guardrail | Value | Source |
| --- | --- | --- |
| Turns per student | 60 per hour and 15 per 5 minutes. Fixed-window counter in Postgres (`rate_counter`). Over the cap → 429 `rate_limited` with `retry_after_s` | SPEC §5.3 |
| Counting rule | Each accepted, non-replayed `POST /events` counts. Replays, `GET`s and cron calls do not | D-18 |
| Pipeline turns per session | 12. A transfer session has its own 12 | SPEC §5.3 |
| LLM calls per turn | Dialogue ≤ 2 iterations, one repair per call. Classifier ≤ 1 | SPEC §5.3 |
| Tokens per turn | ≤ 1,500 prompt and ≤ 250 completion | SPEC §5.2 |
| Request limits (provisional, need owner sign-off) | Body ≤ 8 KiB. `answer_text` and `step_expressions[0]` ≤ 64 characters. Notes and comments ≤ 1,000 characters | SPEC §5.2, D-13 |
| Idempotency record | 24 h | SPEC §5.3 |
| Service token lifetime | ≤ 60 s | SPEC §5.3 |
| JWKS cache | ≤ 1 h | SPEC §5.3 |
| Monthly spend (default pending sign-off, Decision #34) | USD 100 ceiling across Vercel, Neon, Langfuse and the provider. Alert at 80% via the Langfuse cost budget | PRD §11.5 |

The sources state no provider-side quota or rate limit for Gemini, OpenRouter, Neon, Blob or Langfuse. Provider quota or 429 is handled as `provider_error`.

---

## 4. Infrastructure, Runtime & Resource Requirements

### 4.1 Runtime deployment profile

| Unit | Vercel project / root | Entrypoint | Bundle and start constraints | Inbound callers |
| --- | --- | --- | --- | --- |
| Web | `solvepath-web` / `apps/web` | static | SPA fallback to `index.html`. Rewrites `/api/:path*` to the API project (one origin, no CORS) | Browser |
| Orchestrator | `solvepath-api` / `apps/api` | `api/index.py` | Unzipped bundle ≤ 250 MB (blocks CI). Cold-start p95 ≤ 5 s (blocks CI) | Web, Vercel Cron |
| MCP | `solvepath-mcp` / `apps/api` | `mcp_server.py` | Unzipped bundle < 30 MB. Cold start < 1.2 s | Orchestrator only |
| Safety | `solvepath-safety` / `apps/api` | `a2a_safety.py` | Verdict-only. No read access to domain data | Orchestrator only |

| Resource | Requirement | Source |
| --- | --- | --- |
| Compute and memory | **Not specified in the sources.** Serverless function limits depend on the Vercel plan (Pro) and must be confirmed against current Vercel documentation before finalising | SPEC §5.10 |
| Function duration | Sample `apps/api/vercel.json` sets `maxDuration: 60` for `api/index.py`. The session lease must stay below the configured value | PRD §15.4, DESIGN §3.3 |
| Turn budget | Server hard stop 7.5 s. CI gate: tutor-turn p95 < 8 s. Persistence reserve 200 ms | SPEC §5.1 |
| Networking | HTTPS everywhere. W3C `traceparent` and `tracestate` on every HTTP hop to MCP and Safety. Service endpoints require a service token | SPEC §5.7, §5.8 |
| Database connections | Small pool on the pooled string. Migrations on the unpooled string | SPEC §5.4 |
| Disk and volumes | None. Functions are stateless. State lives in Postgres and Blob | SPEC §5.4 |
| Blob retention | Approved diagrams are kept forever. Student-specific blobs are deleted after 90 days | DESIGN §3.8 |
| Demo load | Up to 10 concurrent synthetic students. Cohort view over 150 synthetic students (< 3 s) | SPEC §5.4, §5.1 |
| Cron (Pro plan) | `warmup` every 10 min. `learner-rollup` hourly. `embedding-sync` hourly at :15. `insight-drafts` 18:00. `item-quality-scan` 18:30. `retention-purge` 19:00. `eval-nightly` 20:00. Schedules are the PRD sample and must be confirmed against current Vercel limits | PRD §15.4 |
| Environments | Development (local, `vercel env pull`), Preview (own database and Langfuse credentials), Production (synthetic data only) | SPEC §5.10 |
| Backup | Neon point-in-time recovery. RPO 24 h, RTO 4 h (demo defaults, not a production claim) | SPEC §5.10 |
| Region | Production residency (Sydney, AWS `ap-southeast-2`) is out of scope for Release 1.0 | SPEC §1.4 |
| Client support | iPad Safari 16+, current Chrome and Edge, 768 px minimum viewport | SPEC §5.10 |

### 4.2 Containerization strategy

The sources require portability. They do not define a container image.

- **Stated:** FastAPI, MCP and A2A are container-portable. In Railway or Docker they run as three daemon processes, which removes cold starts. Moving requires no code change (PRD §15.6, §22.1 #10).
- **Trigger:** the deploy spike (≤ 4 h, before infrastructure work) deploys a throwaway FastAPI function with `google-adk`, SymPy and the MCP and A2A SDKs. Failure on bundle size, cold start or stateless MCP/A2A means the three services move to a container host. The result is recorded as an ADR and PRD §15.4 is amended (PRD §18.4).
- **TBD, decided only if the trigger fires:** base image, Dockerfile, process manager, container memory and CPU. This file does not set them.
- **Constraints that apply either way:**
  1. Three separate entrypoints, one per service. They share code only through the modules in DESIGN §1.5.
  2. All configuration comes from environment variables in §2.4.
  3. No in-memory state between requests. No local-disk state.
  4. The MCP image must not include ADK, pandas, torch or transformers.
  5. HTTP and in-process calls use the same module, so behaviour is identical.

### 4.3 Observability foundation

| Aspect | Foundation | Source |
| --- | --- | --- |
| Tracing | One Langfuse trace per tutor turn (`session_id` = session id, `user_id` = pseudonymous `app_user.id`). One span per agent step and tool call. MCP and A2A calls are child spans | SPEC §5.8 |
| Instrumentation | OpenTelemetry/OpenInference for ADK, exporting to Langfuse's OTLP endpoint | PRD §15.5 |
| Context propagation | W3C `traceparent` and `tracestate` on every HTTP call to MCP and Safety | PRD §15.5 |
| Trace metadata | `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment` | SPEC §5.8 |
| Per-turn record in Postgres | Provider, model, model version, temperature, prompt version, hint-policy version, policy-config version, tool results, `trace_id`, `trace_status`, `fallback_reason` | SPEC §5.8 |
| Flush | Flush before the function returns, at most 300 ms. Failure sets `trace_status=missing` and increments `trace_missing`. The turn is never failed | SPEC §5.1, §5.5 |
| Privacy | Pseudonymous ids only. A masking function runs before export. No free text reaches a span in Release 1.0 | SPEC §5.7 |
| Prompt management | Prompts versioned in Langfuse. A pinned label per environment (`LANGFUSE_PROMPT_LABEL`). Cached as `prompt_template` | SPEC §5.8, §5.6 |
| Scores | Deterministic and model-based scores attached to traces, with gates per SPEC §5.8–5.9 | SPEC §5.8 |
| Cost and latency | Per-agent token usage, cost and latency tracked. Spend alert at 80% | PRD §15.5, §11.5 |
| Logging | Application logs record failures noted in SPEC §5.5 (for example Postgres errors). Log format, sink and aggregation are **not specified** | SPEC §5.5 |
| Metrics | Counters named in the sources: `trace_missing`, `fallback_rate`, `in_process_fallback_rate`. No separate metrics backend is specified. Langfuse scores are the reporting path | SPEC §5.5, §5.8 |
| Source of truth | The Postgres `audit_event` ledger is authoritative. Langfuse is supplementary | DESIGN §3.1 |
| Retention | Traces 90 days | DESIGN §3.8 |

---

## 5. Technical Constraints, Guardrails & Anti-Patterns

### 5.1 Hard system boundaries

| Area | Boundary | Source |
| --- | --- | --- |
| Platform | Vercel Python Functions for API, MCP and Safety. Vercel static hosting for the web app. Neon Postgres. Container-portable | PRD §15.1, §15.6 |
| Client | iPad Safari 16+, current Chrome and Edge. 768 px minimum. WCAG 2.1 AA target for the practice screen | SPEC §5.10 |
| Serverless | Stateless functions. No in-memory state between requests. No message queue. No background worker on the student path | SPEC §5.4, DESIGN §2.1 |
| Data scope | Synthetic students only in every public and preview environment. No name or email in `app_user` | SPEC §5.7 |
| Concurrency (demo) | 10 concurrent students. 150-student cohort view | SPEC §5.4 |
| Per-session | One in-flight event per session, enforced by the session lease. A different-key event during a live lease gets 409 `request_in_progress` | DESIGN DD-01 |
| Per-turn time | 7.5 s hard stop. Stage timeouts: verifier 400 ms, retrieval 250 ms, classifier 1,000 ms, policy 40 ms, dialogue 1,400 ms, guard 1,200 ms (1.3 s cap), persistence 200 ms | SPEC §5.1 |
| Fallbacks | At most one in-process fallback per turn, only on timeout or connect failure | SPEC §5.5 |
| Size | Unzipped API bundle ≤ 250 MB. MCP bundle < 30 MB. Cold-start p95 ≤ 5 s. MCP cold start < 1.2 s | SPEC §5.2, §5.1 |
| Quality gates that block merge | `answer_leakage` = 0, `schema_valid` 100%, `verifier_agreement` ≥ 99%, `hint_policy_match` ≥ 95%, verifier p95 < 400 ms, tutor-turn p95 < 8 s, 0 authorisation failures, `fallback_rate` ≤ 5% (live) | SPEC §5.9 |
| Retention | Chat 90 d, attempts 365 d, notes and comments 365 d, traces 90 d, student-specific blobs 90 d. Audit rows and approved diagrams are never deleted | DESIGN §3.8 |
| Scope exclusions | No algebraic expressions with a variable. No free text to any model. No autonomous publication of generated content. No real-learner deployment, no separate graph database, no parent route | SPEC §1.4 |
| Dependencies | `pip-audit`, `npm audit` and `gitleaks` fail the build on a high-severity finding or a detected secret | SPEC §5.7 |
| Confirmation pending | Vercel plan limits (cron frequency, function duration, bundle size), the USD 100 ceiling, and the provisional payload limits need confirmation or owner sign-off | SPEC §5.10, §5.2; Decision #34 |

### 5.2 Anti-patterns that must not be introduced

**Agent and model behaviour**

1. No model chooses a tool, a route, a verdict, a hint level or a state transition. No open ReAct loop.
2. No student free text in any LLM prompt, Langfuse span, cache key or cache value in Release 1.0.
3. No streaming or storing of a model draft before it has passed the deterministic check, the guard and the final override.
4. No free-form model retry. Failures end in an authored, mathematics-free fallback.
5. No LLM agent holds a tool client, a repository or the accepted answer. LLM agents see only the allow-listed ADK state keys.
6. No misconception code reaches the student or alters correctness.
7. No LLM-generated diagrams, questions or reflection and transfer text on the student path.

**Architecture and layering**

8. No upward imports. L4 engines import nothing from L5, L6 or L7. Only L6 issues SQL. Only L7 imports vendor SDKs and HTTP clients.
9. No business rules in routers.
10. No code path that builds a database session bypassing the unit-of-work audit writer.
11. No ADK `DatabaseSessionService` as the system of record (DD-04).
12. No import of ADK, SQLAlchemy models or the provider adapter in the shared verifier module. The MCP bundle must stay small.
13. No second shared store (Redis, in-memory cache, graph or vector database) without superseding DD-06.
14. No fuzzy or semantic cache. Exact keys only. Verifier cache values hold the pure result only, never `progress`, hint level, retry count or `response_target`.
15. No state changes outside `transitions.apply`.
16. No hard-coded provider, model id, URL or threshold in code. These come from configuration and versioned policy data.

**Persistence and concurrency**

17. No database connection held across MCP, A2A or LLM calls. The pipeline runs between two short transactions (TX-A, TX-B).
18. No session-level Postgres state: no `SET` (use `SET LOCAL`), no session advisory locks, no reliance on prepared statements.
19. No migrations through the pooled string. No migrations run from a request handler.
20. No stored cursor or advisory lock for cron jobs. Work is derived from data using `FOR UPDATE SKIP LOCKED`.
21. No `UPDATE` or `DELETE` on `audit_event`. No free text, full prompt or raw model output in audit rows.
22. No write to a terminal session except the `transfer_outcome` back-fill.
23. No mutation of a published `question` version. An edit creates a new version.
24. No use of `tutor_turn.turn_number` for the cap. The cap counter is `tutoring_session.turn_number`.

**Security**

25. No trust in any token claim except `sub`. Authorisation is decided in Postgres on every request.
26. No fail-open on JWKS, service-token or cron-secret checks.
27. No secret in the repository, a `VITE_` variable, a client bundle, a log line or a trace.
28. No shared service-token secret across MCP and Safety. No signing secret held by the verifying service.
29. No guessable public URL for student-specific Blob objects.
30. No real student data in any public or preview environment.

**Delivery**

31. No CORS configuration. The same-origin rewrite removes the need.
32. No handwritten web types for API shapes. Types are generated from `contracts`, and drift fails CI.
33. No change to a prompt, the hint policy or the model configuration without running the evaluation suite.
34. No bundle growth that breaks the 250 MB or 30 MB limits. The MCP bundle must not gain ADK, pandas, torch or transformers.
35. No Vercel-specific API in L0–L6. Vercel details stay in entrypoints, configuration and L7 adapters.
36. No unpinned `google-adk`, MCP SDK, A2A SDK, Gemini model id or embedding model once the Phase 0 ADR exists.

### 5.3 Open items owned elsewhere

| Item | Owner / source |
| --- | --- |
| Exact versions: `google-adk`, MCP SDK, A2A SDK, Gemini Flash model id, `MODEL_EMBEDDING` | Phase 0 ADR (Decision #30) |
| Deploy spike result (bundle size, cold start, stateless MCP/A2A on Vercel) | PRD §18.4. Decides whether §4.2 container details are needed |
| Structured-output route (ADK `output_schema` or adapter JSON mode) | Phase 0 provider spike (Decision #27) |
| Postgres driver, HTTP client, OpenAPI-to-TypeScript generator, import-linter tool | Not named in the sources. Chosen at implementation |
| Logging format and sink | Not specified |
| Compute and memory sizing | Not specified. Confirm against current Vercel limits |
| Operational defaults (Decision #34) and provisional payload limits (D-13) | Product-owner sign-off |
| Repository licence | PRD §22.2 A3 |
