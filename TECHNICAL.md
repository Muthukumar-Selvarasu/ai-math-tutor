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
| Mathematics | SymPy and mpmath in `app.verifier` (the API in Phase A, **only in `solvepath-mcp` from Phase B**). The shared normaliser uses the standard library only | TBD | SPEC §5.5, DESIGN §1.3 |
| Frontend language and framework | TypeScript, **Next.js 14.x** (App Router), client-rendered pages | Next.js 14.x, pinned by ADR-015 (owner decision 2026-10-11). The exact patch and the TypeScript version are recorded in the Phase 0 ADR (P0-14). **Recorded risk:** Next.js 14 passed end of life on 2025-10-26 and an App Router advisory (CVE-2026-23864) is reported unpatched for 14.x. P0-08 runs `npm audit` and checks the `@clerk/nextjs` and `@sentry/nextjs` peer ranges on the skeleton first. A high-severity finding with no 14.x fix fails the P1-16 `npm audit` gate, and the pre-agreed fallback is an ADR moving the web app to the supported Next.js line (with the React version it requires) before P1-07 starts. The gate is never weakened | PRD §15.1, §22.1 #1, #26 |
| Frontend UI library | React 18 | 18.x, as required by Next.js 14.x (ADR-015). React 19 is not adopted unless the fallback above is taken | PRD §15.1 |
| Frontend libraries | TanStack Query, Tailwind CSS, KaTeX, accessible primitives (Radix named as an example) | TBD | PRD §15.1 |
| Node (CI skeleton) | Node.js | 20 | PRD §17.3 |

### 1.2 Storage, messaging and external services

| Concern | Choice | Notes | Source |
| --- | --- | --- | --- |
| Relational, vector, graph, cache, counters, audit | PostgreSQL on Neon, with pgvector (`CREATE EXTENSION IF NOT EXISTS vector;` in the Tier 1b migration that adds `question_embedding`; not needed at Tier 1a) | One store for everything. Skill graph is Postgres edges. pgvector serves only the transfer tie-break and the near-duplicate scan (exemplar retrieval is an exact SQL filter, SPEC D-26). Cache is the `cache_entry` table (exact-key cache is Tier 1b only; Tier 1a verifies without it) | PRD §15.1, §10.2, DESIGN DD-06 |
| Embeddings | `vector(768)`, model named by `MODEL_EMBEDDING`. Used for questions only, for the transfer tie-break and the near-duplicate scan, off the student hot path. Exemplars are not embedded and exemplar retrieval is an exact SQL filter (SPEC D-26) | Exact model id TBD (Decision #28, #30) | PRD §22.1 #28 |
| Object storage | Vercel Blob | Diagram SVGs, content imports, exports | PRD §15.1 |
| LLM provider | Adapter. Gemini by default. OpenRouter is the alternate. vLLM (OpenAI-compatible) is a later swap | Selected with `LLM_PROVIDER` | PRD §22.1 #3, #4, #27 |
| Identity | Clerk (identity proof only) | Roles and scope are decided in Postgres | PRD §22.1 #12, SPEC §1.3 |
| LLM observability | Langfuse Cloud, OTLP export, OpenTelemetry/OpenInference instrumentation for ADK. LLM and agent telemetry only | One project tag per environment | PRD §15.5, §22.1 #8 |
| Application error monitoring | Sentry: `@sentry/nextjs` (web), `sentry-sdk` with its FastAPI integration (API, MCP, Safety). Errors and crashes only | Tracing and Session Replay off. Region open (PRD §22.2 A4) | PRD §15.5.1 |
| Background work | Vercel Cron calling `/api/jobs/*` | **No message queue and no background worker** on the student path | PRD §22.1 #9, DESIGN §2.1 |
| Hosting | Vercel, four projects from one monorepo (**end state only**: Phase A / Tier 1a has two, `solvepath-web` and `solvepath-api`. The four-project set is Phase B / Tier 1b) | Pro plan | PRD §15.4, §22.1 #13 |
| CI/CD | GitHub Actions as the required quality gate and the authoritative deploy trigger (`deploy-prod.yml`, built by P2-22 in Tier 1b). Vercel Git auto-deploy is disabled on every project (PRD v1.3.27, SPEC D-36, BUILD_LOG ADR-014) | | PRD §22.1 #11 |

### 1.3 Rationale and lock-in controls

| Decision | Rationale | Lock-in or bottleneck control |
| --- | --- | --- |
| Deterministic workflow harness, not an agent mesh | Models never choose tools, verdicts, hint levels or transitions. The fixed order is testable and cost-bounded | The table-driven FSM (`transitions.yaml`) is data, with parity to SPEC checked in CI |
| Postgres as the only shared store (DD-06) | One transactional store gives atomic turn writes and one backup unit at demo scale (10 concurrent students) | Cache and counters sit behind L6 store interfaces, so they can move out under higher load |
| LLM provider adapter | Gemini, OpenRouter and vLLM use the same agent schemas. Agents import no vendor SDK | Only L7 imports vendor SDKs. A provider change is configuration plus adapter code |
| ADK as an execution engine only (DD-04) | The authoritative record carries the SPEC columns, FSM guards, lease and audit | ADK state is a pure function of Postgres rows. `DatabaseSessionService` can be adopted later without a schema change |
| Pure verifier behind MCP from Phase B (DD-07). In Phase A (Slice 0, Tier 1a) the verifier module is bundled in the single API deployable | Meets the MCP requirement and, from Phase B, keeps the API bundle free of SymPy. A cold start never becomes a false `tool_failure`: from Phase B the single fallback on the Vercel topology is a repeat MCP call, and on a container topology it is the same module in process | The normaliser is standard-library only so the API can normalise and leak-check without SymPy, and so the verifier module can be split out without rewriting it |
| No separate graph or vector database | Graph is Postgres edges. Vectors only shortlist and tie-break. The graph decides legality (D-19) | Fewer runtimes to deploy and secure (Decision #5) |
| Next.js, client-rendered, rather than a Vite SPA (Decision #26, reverses the earlier choice) | First-party Clerk and Sentry SDKs, App Router routing and error boundaries, build-time source maps | The web project is no longer static and adds a Node runtime on Vercel. Kept small by no server-side data fetching and no authorisation in Next.js |
| Container-portable API, MCP and Safety | Moving to Railway or Docker needs no code change (PRD §15.6) | Configuration is environment variables only. No Vercel-only APIs in L0–L6 (see §5.2) |
| Pooled Postgres string for requests, unpooled for migrations | Neon's pooler is transaction-mode, which suits serverless | No session-level connection state anywhere (see §5.2). Prepared-statement caching is disabled on the driver and the per-instance pool is small or absent, so instances times pool size stays under the pooler limit |

---

## 2. Local Development Setup & Toolchain

### 2.1 Prerequisites

| Requirement | Constraint | Source |
| --- | --- | --- |
| Python | 3.12 | PRD §15.1 |
| Node.js | 20 (the version in the CI skeleton) | PRD §17.3 |
| Python tooling | `pip` with a virtual environment. Install with `pip install -e "apps/api[dev]"` | PRD §17.3 |
| JavaScript tooling | `npm` | PRD §11.5, §17.1 |
| Vercel CLI | `vercel`, used for `vercel env pull` once the first Vercel project exists (before Tier 1b; Tier 1a uses a hand-made `.env.local`). CI installs `vercel@latest` | PRD §16.2, §17.3 |
| Git | Required | — |
| `gitleaks` | Required to reproduce the CI secret scan locally | PRD §17.1 |
| Accounts and access | Vercel (Pro), Neon, Clerk, Langfuse Cloud, Sentry, Google AI Studio key (or Vertex credentials), GitHub | PRD §15, §16.2 |

The sources name no Python or Node version manager. Developers choose their own.

### 2.2 Repository layout (stated in PRD §16.1)

```text
apps/web      Next.js (App Router) + TypeScript
apps/api      Python source tree for all three services: pyproject.toml (extras in `[project.optional-dependencies]`, not PEP 735 groups, so `pip install -e "apps/api[dev]"` works: api, mcp, safety, verifier, dev. In Phase A `dev` includes `verifier`),
              tests/, app/ (logical layers per DESIGN §1.4), mcp_server.py, a2a_safety.py
  deploy/api     solvepath-api deploy root: manifest, vercel.json, api/index.py. Phase A: includes the `verifier` extra (SymPy). Phase B: no SymPy
  deploy/mcp     solvepath-mcp deploy root (created at Phase B): manifest, vercel.json, entry for mcp_server.py (SymPy only here)
  deploy/safety  solvepath-safety deploy root (created at Phase B): manifest, vercel.json, entry for a2a_safety.py
content/      questions, misconceptions, safety, eval, seed
docs/         adr, threat-model.md, runbook.md
scripts/      sync_stories.py, seed_synthetic.py
.github/workflows/
```

DESIGN §1.4 states that module names beyond those SPEC names are logical and indicative. SPEC does not fix a source tree.

### 2.3 Environment setup

1. Create a Python 3.12 virtual environment. Run `pip install -e "apps/api[dev]"`.
2. In `apps/web`, run `npm install`.
3. **Tier 1a local-env route:** create `.env.local` by hand from `.env.example`. Slice 0 needs only `GOOGLE_API_KEY` (the Gemini key) and no Postgres. It is the only external dependency of Slice 0. `vercel env pull` (writes `.env.local` from the **Development** environment, PRD §16.2) applies only after the first Vercel project exists, which is before Tier 1b. The golden test runs in CI in recorded-fixture replay mode, plus a local live smoke against Gemini Flash. At Tier 1a it is the 1a variant of `test_demo_trajectory.py` (in process, empty retrieval from the empty exemplar stub (D1: the retrieval gate runs but the exemplar source is empty at Tier 1a), a recorded classifier output that is null or `insufficient_evidence`; the replay fixture pins no misconception claim and `prompt_type=diagnostic_probe`, while in live mode the test asserts only that `prompt_type` obeys the confidence rule: `targeted_scaffold` only if classifier confidence >= 0.80 and the code is not `insufficient_evidence`; no verifier cache-hit trace item). The 1b variant (exemplar retrieval, an exemplar-citing classifier result, the cache-hit trace item) is a Gate B test (SPEC D-33). The Slice 0 exit test is owned by P0-17, which builds a minimal fixture recorder and the replay CI job and depends on P0-05, P0-08, P0-09, P0-11 and P0-12. Slice 0 uses a thin in-process provider-adapter call that P2-02 later generalises into the full adapter, and P0-14 formalises the dependency pins (BUILD_LOG ADR-012).
4. The Development environment points at its own Neon database (a dev branch or a dedicated dev database). No local Postgres container is used.
5. Apply migrations with Alembic using `DATABASE_URL_UNPOOLED`.
6. Load synthetic data with `scripts/seed_synthetic.py`. Seed users come from `content/seed/users.json`, which lists each synthetic user by a logical `clerk_ref`, role, cohort and display label, and holds no Clerk id.

**Seeding the identity map (per environment).** Clerk user ids differ between a Clerk development instance and a production instance, and an unknown `sub` is a 403 (no auto-provisioning). Each environment therefore has its own map from `clerk_ref` to `clerk_user_id`, `content/seed/clerk_ids.<APP_ENV>.json`:

| Environment | Clerk instance | Procedure |
| --- | --- | --- |
| Development (local) | Clerk development instance | Create the synthetic users in the Clerk dashboard (or with the Backend API using `CLERK_SECRET_KEY`). Record each id in `clerk_ids.development.json`. Run the seed script |
| Preview | **Deferred to Tier 3 (inactive, unprovisioned in Tier 1).** Not used yet. Development is local first and the owner deploys to Vercel later. If a Preview environment is created it reuses the Clerk development instance and `clerk_ids.development.json`, with its own database seeded after migrations | None until a Preview environment exists. Tier 1 targets are Development (local) and Production only. No ephemeral preview database branches are provisioned |
| Production (synthetic only) | Clerk production instance | Create the synthetic users (about 10 students for the concurrency demo, plus teacher, coordinator, reviewer and administrator accounts) in the production instance. Record the ids in `clerk_ids.production.json`. `BOOTSTRAP_ADMIN_CLERK_ID` seeds the first administrator, then OP-18 creates the rest |

The script fails if a `clerk_ref` has no id in the active map. It never creates a Clerk user and never writes a name or email to `app_user`. The seed files contain synthetic data only.

The pgvector extension is created by the Tier 1b migration that adds `question_embedding` (not at Tier 1a). Seeding the first administrator reads `BOOTSTRAP_ADMIN_CLERK_ID`, which only the seed script reads.

### 2.4 Configuration variables

Source: PRD §16.2. "Secret" means the value must live only in the secret store.

| Variable | Used by | Purpose | Secret |
| --- | --- | --- | --- |
| `APP_ENV` | api, web | `development`, `preview`, `production` | No |
| `DATABASE_URL` | api | Pooled Postgres string (request handlers) | Yes |
| `DATABASE_URL_UNPOOLED` | api (migrations) | Direct Postgres string | Yes |
| `BLOB_READ_WRITE_TOKEN` | api | Vercel Blob | Yes |
| `LLM_PROVIDER` | api | `gemini` (default), `openrouter`, `vllm` | No |
| `GOOGLE_API_KEY` | api | Gemini via AI Studio. Required from Slice 0, which makes one real Gemini Flash call through the provider adapter, and the only Slice 0 external dependency. Also needed in the local `.env.local` list (or Vertex via `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) | Yes |
| `OPENROUTER_API_KEY` | api | Only when `LLM_PROVIDER=openrouter` | Yes |
| `VLLM_BASE_URL` | api | Only when `LLM_PROVIDER=vllm` | No |
| `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING` | api | Per-agent model selection. Values TBD (Decision #30) | No |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | api | Langfuse project credentials | Yes |
| `PROMPT_SOURCE` | api | `repo` (Tier 1a default, files under `apps/api/app/prompts/`) or `langfuse` (from Tier 1b), SPEC D-31 | No |
| `LANGFUSE_HOST`, `LANGFUSE_PROMPT_LABEL` | api | Base URL and pinned prompt label. Read only when `PROMPT_SOURCE=langfuse` | No |
| `CRON_SECRET` | api | Bearer token for Vercel Cron | Yes |
| `INTERNAL_SERVICE_TOKEN_MCP` | api, mcp | HMAC secret for tokens to `solvepath-mcp` | Yes |
| `INTERNAL_SERVICE_TOKEN_SAFETY` | api, safety | HMAC secret for tokens to `solvepath-safety` | Yes |
| `DIALOGUE_MODE` | api | `template` (**shipped default**, SPEC D-37: authored probe text, no Classifier, Dialogue or Guard model call, which is Cut 1a-3 taken at baseline) or `llm` (an opt-in evaluation and stretch mode, gated by the early educator check and a Gate B live calibration run, n ≥ 100). `llm` becomes the default only by a PRD change (PRD §18.4.2). The Slice 0 local live smoke sets `llm` explicitly. Model-level ratchets are measured in `llm` mode | No |
| `AUTH_ISSUER`, `AUTH_AUTHORIZED_PARTIES`, `CLERK_JWKS_URL` | api | Clerk JWT verification. `AUTH_AUTHORIZED_PARTIES` is an allow-list of exact web origins accepted as `azp`, no wildcard. Development: the local origin. Production: set at the owner's first Vercel deployment. No Preview origin is configured (development is local first). A Preview alias, if ever created, is an exact origin and any pattern needs an ADR | No |
| `AUTH_AUDIENCE` | api | Optional. Set only when a Clerk JWT template adds an `aud` claim. Unset means `aud` is not checked | No |
| `CLERK_SECRET_KEY` | api | Clerk server key | Yes |
| `BOOTSTRAP_ADMIN_CLERK_ID` | seed script only | First administrator. The API process does not read it | No |
| `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION` | api | Stamped on each turn | No |
| `RETENTION_POLICY_VERSION` | api | Retention rule version (SPEC §5.10, DESIGN §3.8) | No |
| `LLM_TIMEOUT_SECONDS` | api | Upper bound for model and tool calls | No |
| `LLM_THINKING_BUDGET` | api | Gemini thinking budget. **Fixed at 0 (thinking disabled)** for every agent call, because thinking tokens count as completion tokens | No |
| `SESSION_LEASE_SECONDS` | api | Session lease duration, **12**. Exceeds 7.5 s + 200 ms and is below the function `maxDuration` (DESIGN §3.3, §4.5) | No |
| `NEXT_PUBLIC_API_BASE_URL` | web | API base path (typically `/api`) | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | Clerk publishable key (public, Next.js-exposed) | No |
| `SENTRY_DSN` | api, mcp, safety | Sentry project DSN for the Python services | No |
| `NEXT_PUBLIC_SENTRY_DSN` | web | Sentry project DSN for the browser (public, Next.js-exposed) | No |
| `SENTRY_AUTH_TOKEN` | web (build time only) | Source-map upload. Never read at runtime, never `NEXT_PUBLIC_` | Yes |

### 2.5 Secret handling

- All secrets live in **Vercel Environment Variables**, scoped to Development and Production in Tier 1 (Preview: Deferred to Tier 3 (inactive, unprovisioned in Tier 1)). Mark sensitive values as Sensitive (PRD §11.1).
- Nothing secret is committed. `.env*` files are git-ignored. `.env.example` lists names only (PRD §16.2).
- Only `NEXT_PUBLIC_`-prefixed variables reach the browser. They never hold a secret.
- Local values come from `vercel env pull` into `.env.local` once the first Vercel project exists (before Tier 1b). At Tier 1a the file is made by hand from `.env.example`.
- Preview (Deferred to Tier 3 (inactive, unprovisioned in Tier 1)) would use separate database and Langfuse credentials from Production.
- Each service holds only its own service-token secret (Decision #37, DESIGN §1.7). The API holds both signing secrets. MCP holds only `INTERNAL_SERVICE_TOKEN_MCP`. Safety holds only `INTERNAL_SERVICE_TOKEN_SAFETY`.
- Rotation: every 90 days and after any suspected exposure (SPEC §5.7).
- GitHub Secrets hold only CI deployment credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, project ids, per-environment database URLs for migrations) and CI-time evaluation keys (PRD §16.2, §17.3).
- Development and Production data is synthetic only (Preview, if ever created, likewise). No real student name, email or record is used.

### 2.6 Build, lint and verification commands

Only commands the sources name are listed. Exact script names and flags are defined when the tooling is created.

| Purpose | Command | Source |
| --- | --- | --- |
| Install API | `pip install -e "apps/api[dev]"` | PRD §17.3 |
| Python lint and type-check | Ruff, mypy | PRD §17.1 |
| Frontend lint and type-check | ESLint, `tsc` | PRD §17.1 |
| Critical tests | `pytest apps/api/tests -m "critical"` | PRD §17.3 |
| Authorisation tests | `tests/authz` (covering both layers: application checks and minimal Postgres RLS, SPEC D-30. At Gate A the suite is 9 application-layer + 3 RLS + 4 hardening = 16 cases, all blocking. The unauthenticated MCP/A2A 401 case is a Gate B item [B]). Pooled-connection leak test for `SET LOCAL app.user_id`. Also asserts the API database role is a non-owner, `BYPASSRLS` is false, `FORCE ROW LEVEL SECURITY` is on for every table that holds student-scoped rows, and the `SECURITY DEFINER` lookup function (keyed by the Clerk `sub`, owned by a dedicated non-login role, `search_path = pg_catalog, public`, `EXECUTE` revoked from `PUBLIC` and granted only to the API role, reading `app_user`, `user_grant` and `cohort_assignment` under an explicit policy for that owner role only) returns only the caller's `app_user.id`, role and cohort ids (SPEC D-30, BUILD_LOG ADR-012, ADR-013) | SPEC §5.9 |
| Other test groups | unit, schema, verifier, FSM table parity, content validation, `tests/contract` (OpenAPI and web-type drift, built by P1-15, Tier 1a) | PRD §17.1 |
| Release check | `pytest -m release` (C4: every canned key `reviewed`). Not run on pull requests. Wired into CI by task P2-22 (Tier 1b) | PRD §14, SPEC §5.9 |
| Smoke test | `pytest apps/api/tests/smoke --base-url <url>`. Wired into the deployed live job by task P2-22 (Tier 1b) | PRD §17.3 |
| Migrations | `alembic upgrade head` with `DATABASE_URL_UNPOOLED`. Run only from CI for shared environments | PRD §17.3, DESIGN §1.7 |
| Dependency and secret scans | `pip-audit`, `npm audit`, `gitleaks`. Built by task P1-16 (Tier 1a) | PRD §17.1 |
| Accessibility | `axe` on the practice screen. Built by task P1-16 (Tier 1a) | PRD §17.1 |
| Story sync | `scripts/sync_stories.py --check`. Built by task P1-16 (Tier 1a) against the planned `user-story.md` | PRD §17.1 |
| Import-boundary check | An import-linter style check enforcing DESIGN §1.4 rules 1–4. Tool choice TBD. Built by task P1-16 (Tier 1a) | DESIGN §1.4 |
| Bundle size (the Phase A measurement is built by P1-15, Tier 1a) | Unzipped API bundle ≤ 250 MB (Phase A: measured with SymPy included. Phase B: without it). From **Phase B only**: MCP bundle ≤ 90 MB and manifest-resolution check (no ADK, pandas, torch or transformers in the MCP tree, no SymPy in the API tree; the check is added by P2-22) | SPEC §5.2 |
| Evaluation | `eval.yml` runs the suite. At Tier 1a the dataset is the repository files under `content/eval/` and the Gate A suite is the Tier 1a subset: 42 critical cases, the golden 1a trajectory, one pleading persona, all in `DIALOGUE_MODE=template` with fixture-backed adapter replay (the live subset of at least 100 LLM-stage turns belongs to the opt-in `llm` stretch and Gate B). The 150-case set, DS-06 (at least 20 oracle leaks) and the five personas are Tier 2/3. From Tier 1b the suite runs against the Langfuse dataset mirror. The eval harness and CI are task P1-15 (the scripted-variant generator, about 10 h, belongs to the opt-in `llm` stretch), built inside the Tier 1a engineering budget of 120 h (SPEC D-33, D-35). The verifier p95 < 400 ms CI gate is not run at Tier 1a (the verifier is in process). `check_candidate(candidate_text, hint_decision, question, verifier_outcome)` has a unit test for the digit rule, whose exemption set is the question stem, the selected probe template and the student's value that the verifier marked correct on this attempt (read from this attempt's `verifier_outcome` in ADK state, inside `check_candidate` only). `eval.yml` also owns the nightly live run (`eval-nightly`), which is a GitHub Actions schedule and not a Vercel Cron route. At Tier 1a `eval-nightly` runs locally or on a runner and is distinct from the deployed nightly run owned by P2-22 (from Tier 1b). Live eval ceilings: PR and release runs ≤ 250 turns, ≤ USD 0.80. Nightly ≤ 250 turns, ≤ USD 0.30. The token ceiling is 500,000 tokens, provisional: P0-12 measures the mean tokens per turn on at least 20 turns with a throwaway synthetic three-call harness (Classifier-, Dialogue- and Guard-sized calls), the real Tier 1a figure is re-confirmed at the first live run, and the live-run ceiling is always the measured mean x 250 turns, set by a PRD change. The provisional 500,000 corresponds to a measured mean of 2,000 tokens per turn (500,000 / 250), and if the measured mean exceeds 2,000 the ceiling is raised by a PRD change. The monthly USD 20 ceiling and USD 16 alert are unchanged. The Slice 0 golden test runs in CI in recorded-fixture replay mode and as a local live smoke | PRD §17.1 |

CI workflows (SPEC §5.10): `ci.yml`, `eval.yml`, `deploy-prod.yml`, `content-validate.yml` (`deploy-preview.yml`: Deferred to Tier 3 (inactive, unprovisioned in Tier 1)). At Tier 1a `ci.yml`, `eval.yml` and `content-validate.yml` are built (tasks P1-15, P1-16). `deploy-prod.yml` and the deployed live job are built by task P2-22 (Tier 1b). `deploy-prod.yml` is the authoritative deploy trigger and Vercel Git auto-deploy is disabled on every project (PRD v1.3.27, SPEC D-36, BUILD_LOG ADR-014).

**Task P1-16 (CI, security and content checks, Tier 1a, about 8-12 h, inside the Tier 1a budget)** is the builder of the story-sync check, `content-validate.yml`, the `pip-audit`, `npm audit` and `gitleaks` jobs, `axe` on the practice screen, and the Sentry SDK with its `before_send` scrubber (web and API). It also owns the import-boundary check. It depends on P0-09 and P0-17 and is a dependency of P1-14 (BUILD_LOG ADR-012, ADR-013). `user-story.md`, `scripts/`, `content/` and `blueprint.md` are planned artefacts. `user-story.md` is created in P0-08, `content/` and `blueprint.md` in P0-11, and `scripts/` (`sync_stories.py`) in P1-16. They do not exist until those tasks are done.

**Task P1-17 (Orchestrator and persistence, Tier 1a, about 14-20 h, inside the Tier 1a engineering budget of 120 h)** builds `run_turn`, the TX-A and TX-B transactions, the session lease, idempotency and the rate counters. It depends on P1-02, P1-04, P1-08 and P1-01a and is a dependency of P1-14 (BUILD_LOG ADR-013, SPEC D-35).

**Task P2-22 (Gate B CI and release checks, Tier 1b)** builds `deploy-prod.yml`, the deployed live job and its deployed nightly run (distinct from the Tier 1a `eval-nightly` in `eval.yml`), `tests/smoke`, `pytest -m release`, the Langfuse dataset mirror and the golden 1b variant (BUILD_LOG ADR-013, SPEC D-35). The import-boundary check is not part of P2-22: it is owned by P1-16 (Tier 1a).

---

## 3. External Dependencies & Third-Party Integrations

### 3.1 Direct dependencies

Versions are TBD unless a constraint is shown. Pinning is owned by the Phase 0 ADR (Decision #30), task P0-14. P0-14 depends on P0-12 and not on the deferred P0-13 deploy spike: it records SDK sizes from a local `pip install --target --no-compile`, and P0-13 re-checks the pins on Vercel. A change to `google-adk`, the A2A SDK, the MCP SDK, the Gemini model id or `MODEL_EMBEDDING` re-runs the replay and live gates (PRD §14.5).

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
| SymPy, mpmath (`verifier` extra) | Phase A: in the API manifest, imported by `app.verifier` for the in-process verifier. Phase B: removed from the API manifest and packaged only in `solvepath-mcp`. A container image may keep it in the API for the in-process fallback, with the 250 MB check re-run | Verifier |
| Provider adapter and vendor SDKs | TBD | L7 only |
| Langfuse client, OpenTelemetry/OpenInference | TBD | LLM and agent tracing (L7 only) |
| `sentry-sdk` (FastAPI integration), `@sentry/nextjs` | TBD | Application error reporting (L7 only on the API side) |
| Blob client, JWKS client | TBD | L7 only |

**MCP server (`solvepath-mcp`)**: SymPy, mpmath, the MCP SDK, a Postgres driver, Pydantic subset (no embedding client: exemplar retrieval is an exact SQL filter). Measured unzipped wheel size of that set is 83 MB with no bytecode shipped, and 142 MB if `__pycache__` ships (SymPy about 29 MB and SymPy plus mpmath about 31 MB, the PostgreSQL binary driver 19 MB, `cryptography` 14 MB pulled in by the MCP SDK), which is why the limit is 90 MB. **No ADK, pandas, torch or transformers** (PRD §15.6, DESIGN §1.3).

**Safety Guard (`solvepath-safety`)**: an HTTP client for `MODEL_SAFETY`, Pydantic.

**Web (`solvepath-web`)**: React 18, TypeScript, Next.js 14.x (App Router), TanStack Query, Tailwind CSS, KaTeX, `@clerk/nextjs`, `@sentry/nextjs`, an accessible component library (Radix named as an example). Web types are generated from the OpenAPI document derived from `contracts`. The generator tool is TBD.

**Development and CI**: pytest, Ruff, mypy, ESLint, `tsc`, `pip-audit`, `npm audit`, `gitleaks`, `axe`, Vercel CLI, GitHub Actions (`actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4` in the PRD skeleton).

### 3.2 External services

| Service | Used for | Authentication | Failure behaviour |
| --- | --- | --- | --- |
| Clerk | Identity proof | JWT verified against `CLERK_JWKS_URL` (cache ≤ 1 h): signature, `iss`, `exp`, `nbf`, and the authorised party `azp` against `AUTH_AUTHORIZED_PARTIES`. Clerk's default session token has no `aud` claim, so `aud` is checked only if a Clerk JWT template sets it (then `AUTH_AUDIENCE` is configured). Only `sub` is trusted and any role claim is ignored. Role and scope come from Postgres on every request. An unknown `sub` gets 403 `forbidden`. No auto-provisioning | No usable JWKS cache → 503 `service_unavailable`. Never fail open |
| LLM provider (Gemini default, OpenRouter alternate) | Dialogue, Classifier, Safety model (on the student path only in the opt-in `DIALOGUE_MODE=llm`, none in the shipped `template` default), Teacher Insight, embeddings | `GOOGLE_API_KEY` (or Vertex credentials), `OPENROUTER_API_KEY` | Timeout, 429, 5xx or invalid schema → deterministic fallback. One schema repair, no free-form retry |
| Neon Postgres + pgvector | All durable state | Pooled and unpooled strings. Separate roles per deployable (API, MCP, Safety, migrations) | Before attempt stored → 503. After pipeline → 503 and retry resumes |
| Vercel Blob | Diagrams, imports, exports | `BLOB_READ_WRITE_TOKEN` | Render the SVG in process from the validated spec, else probe text without a diagram |
| Langfuse Cloud | LLM and agent telemetry only: traces, prompts, datasets, scores | Public and secret keys | Never fails a turn. `trace_status=missing` |
| Sentry | Application errors and crashes (web, API, MCP, Safety) | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (build time) | Event dropped. Never fails or delays a turn |
| Vercel Cron | Six job routes (`warmup`, `learner-rollup`, `embedding-sync`, `insight-drafts`, `item-quality-scan`, `retention-purge`). The nightly evaluation is a GitHub Actions workflow, not a cron route | `Authorization: Bearer CRON_SECRET`. Mismatch → 401, log and audit, nothing runs | Remainder resumes on next invocation |
| `solvepath-mcp`, `solvepath-safety` | Verification, retrieval, safety verdict | Short-lived HMAC bearer: `aud`, `iat`, `exp`, `exp − iat ≤ 60 s`. One secret per target | Timeout or connect failure → one fallback per turn: verifier = repeat MCP call on the Vercel topology (in-process only on a container topology), guard = in-process. HTTP 4xx/5xx is never retried |

### 3.3 Rate-limit and spend guardrails

| Guardrail | Value | Source |
| --- | --- | --- |
| Turns per student | 60 per hour and 15 per 5 minutes. Fixed-window counter in Postgres (`rate_counter`). Over the cap → 429 `rate_limited` with `retry_after_s` | SPEC §5.3 |
| Counting rule | Each accepted, non-replayed `POST /events` counts. Replays, `GET`s and cron calls do not | D-18 |
| Pipeline turns per session | 12. A transfer session has its own 12 | SPEC §5.3 |
| LLM calls per turn | Dialogue ≤ 2 iterations, one repair per call. Classifier ≤ 1 | SPEC §5.3 |
| Tokens per model call | ≤ 1,500 prompt and ≤ 250 completion, **per individual call** (not cumulative per turn). Thinking tokens are disabled on every Gemini call | SPEC §5.2 |
| Request limits (accepted, D-13, accepted by the product owner on 2026-10-11) | Body ≤ 8 KiB. `answer_text` and `step_expressions[0]` ≤ 64 characters. Notes and comments ≤ 1,000 characters | SPEC §5.2, D-13 |
| Idempotency record | 24 h | SPEC §5.3 |
| Service token lifetime | ≤ 60 s | SPEC §5.3 |
| JWKS cache | ≤ 1 h | SPEC §5.3 |
| Monthly spend (Decision #34, accepted by the product owner on 2026-10-11) | USD 20 ceiling for model-provider (LLM) usage only. Alert at USD 16 (80%) via the Langfuse cost budget. Fixed plan fees (Vercel Pro, Neon, Langfuse) are tracked separately | PRD §11.5 |

The sources state no provider-side quota or rate limit for Gemini, OpenRouter, Neon, Blob or Langfuse. Provider quota or 429 is handled as `provider_error`.

---

## 4. Infrastructure, Runtime & Resource Requirements

### 4.1 Runtime deployment profile

| Unit | Vercel project / root | Entrypoint | Bundle and start constraints | Inbound callers |
| --- | --- | --- | --- | --- |
| Web | `solvepath-web` / `apps/web` | Next.js (App Router), client-rendered, Node runtime on Vercel | Vercel Next.js preset. A `next.config` rewrite sends `/api/:path*` to the API project (one origin, no CORS). No SPA fallback and no static-only hosting | Browser |
| Orchestrator | `solvepath-api` / `apps/api/deploy/api` | `api/index.py` | Own manifest. Phase A: includes SymPy and the in-process verifier and safety modules (a single deployable). Phase B: no SymPy. Unzipped bundle ≤ 250 MB (blocks CI on the build artefact; unzipped wheel sum measured at about 115 MB without SymPy and about 146 MB with it (Linux x86_64 wheels, Python 3.12, unpinned versions on 2026-10-11; P0-13 re-measures on the pinned set); Phase A ships the 146 MB form, MCP in Phase B is 83 MB of its 90 MB limit). Cold-start p95 ≤ 5 s (measured on the deployed service: not run at Gate A, blocks at Gate B) | Web, Vercel Cron |
| MCP (**Phase B**) | `solvepath-mcp` / `apps/api/deploy/mcp` | `mcp_server.py` (entry in the deploy root) | Created at Phase B. Own manifest. Unzipped bundle ≤ 90 MB. MCP cold-start (first-call) p95 design target < 1.2 s (the p95 ≤ 5 s gate binds at Gate B). CI resolves the manifest and fails on ADK, pandas, torch or transformers. These checks do not run before this root exists | Orchestrator only |
| Safety (**Phase B**) | `solvepath-safety` / `apps/api/deploy/safety` | `a2a_safety.py` (entry in the deploy root) | Own manifest. Verdict-only. No read access to domain data | Orchestrator only |

| Resource | Requirement | Source |
| --- | --- | --- |
| Compute and memory | **Not specified in the sources.** Serverless function limits depend on the Vercel plan (Pro) and must be confirmed against current Vercel documentation before finalising | SPEC §5.10 |
| Function duration | Sample `apps/api/vercel.json` sets `maxDuration: 60` for `api/index.py`. The session lease must stay below the configured value | PRD §15.4, DESIGN §3.3 |
| Turn budget | Server hard stop 7.5 s. CI gate: tutor-turn p95 < 8 s (a hard-stop-honoured assertion, since the 7.5 s hard stop binds; the < 5 s p95 target is reported, not gated), measured request received to response sent and excluding the post-response Langfuse flush. Persistence reserve 200 ms. The flush runs asynchronously in the background after the response. If the platform cannot run it, it runs inline (≤ 300 ms) and the turn deadline and revision gate use 7.2 s. Stage sums exclude the single per-turn fallback (up to 0.4 s verifier, 1.2 s guard), so the hard stop and the revision gate bound the turn (SPEC §5.1) | SPEC §5.1 |
| Networking | HTTPS everywhere. W3C `traceparent` and `tracestate` on every HTTP hop to MCP and Safety. Service endpoints require a service token | SPEC §5.7, §5.8 |
| Database connections | Small pool on the pooled string. Migrations on the unpooled string | SPEC §5.4 |
| Disk and volumes | None. Functions are stateless. State lives in Postgres and Blob | SPEC §5.4 |
| Blob retention | Approved diagrams are kept forever. Student-specific blobs are deleted after 90 days | DESIGN §3.8 |
| Demo load | Up to 10 concurrent synthetic students. Cohort view over 150 synthetic students (< 3 s) | SPEC §5.4, §5.1 |
| Cron (Pro plan) | `warmup` every 10 min (warms one instance per project and pings the database). `learner-rollup` hourly. `embedding-sync` hourly at :15. `insight-drafts` 18:00. `item-quality-scan` 18:30. `retention-purge` 19:00. The nightly evaluation is the GitHub Actions workflow `eval.yml` at 20:00, not a Vercel Cron route. Schedules are the PRD sample and must be confirmed against current Vercel limits | PRD §15.4 |
| Environments | Development (local; `.env.local` by hand at Tier 1a, `vercel env pull` once a Vercel project exists), Production (synthetic data only). Preview (own database and Langfuse credentials): Deferred to Tier 3 (inactive, unprovisioned in Tier 1) | SPEC §5.10 |
| Backup | Neon point-in-time recovery. RPO 24 h, RTO 4 h (demo defaults, not a production claim) | SPEC §5.10 |
| Region | Production residency (Sydney, AWS `ap-southeast-2`) is out of scope for Release 1.0 | SPEC §1.4 |
| Client support | iPad Safari 16+, current Chrome and Edge, 768 px minimum viewport | SPEC §5.10 |

**Topology phases and when the CI rules apply (B-1).**

| Phase | Scope | Deployables | SymPy | CI rules active |
| --- | --- | --- | --- | --- |
| A | Slice 0 (single local process), Tier 1a, Gate A | One: `solvepath-api` (plus `solvepath-web`) with the verifier and safety modules in process | In the API (`apps/api/app/verifier`) | API bundle ≤ 250 MB (with SymPy, about 146 MB), checked on the CI build artefact. The API cold start ≤ 5 s and the MCP cold-start (first-call) p95 are **not run** at Gate A (they need a deployed service and apply at Gate B). Minimal Postgres RLS (per-transaction `SET LOCAL app.user_id`, fail-closed policies on every table that holds student-scoped rows, pooled-connection leak test; full matrix Tier 3), import-linter layer rules (the verifier module imports no ADK, SQLAlchemy model or provider adapter, so it can be split out) |
| B | Tier 1b, Gate B | `solvepath-api`, `solvepath-mcp`, `solvepath-safety`, `solvepath-web` | Only in `solvepath-mcp` | All Phase A rules, plus: no SymPy in the API tree, MCP bundle ≤ 90 MB, no ADK, pandas, torch or transformers in the MCP tree, MCP cold-start (first-call) p95 (design target < 1.2 s, gate p95 ≤ 5 s), verifier p95 on the MCP call span |

The Phase B rules are switched on by the change that creates `apps/api/deploy/mcp` and removes the `verifier` extra from the API manifest. A Phase A build passes CI by design.

### 4.2 Containerization strategy

The sources require portability. They do not define a container image.

- **Stated:** FastAPI, MCP and A2A are container-portable. In Railway or Docker they run as three daemon processes, which removes cold starts. Moving requires no code change (PRD §15.6, §22.1 #10).
- **Trigger:** the deploy spike (P0-13, ≤ 4 h) stays deferred until the first Vercel deployment (before Tier 1b) and then deploys **three throwaway projects from three separate deploy roots**. The spike rehearses the **Phase B** topology: an API root with `google-adk` and the MCP and A2A SDKs (no SymPy), an MCP root with SymPy, mpmath and the MCP SDK, and a Safety root. It records: (a) unzipped bundle size per root against 250 MB and 90 MB, (b) cold start per root, (c) that the MCP and A2A servers run statelessly, (d) the number of HTTP round trips and the latency of one MCP `verify_expression` call from the API with the chosen client, against the 400 ms cap, (e) whether post-response background work is available for the Langfuse flush, (f) whether the deploy roots can reach the shared source tree (include-outside-root setting, or a build-time copy), and (g) that Gemini Flash thinking can be disabled. This spike does not change Phase A: Slice 0 and Tier 1a bundle SymPy in the API (about 146 MB of 250 MB). Failure on bundle size, cold start, the MCP round trip or stateless MCP/A2A means the three services move to a container host. The result is recorded as an ADR and PRD §15.4 is amended (PRD §18.4). **P0-13 empirical watch-items (formal, each unproven until recorded in the ADR):** (1) API bundle, unzipped, at most 250 MB (Phase A with SymPy, Phase B without it); (2) cold-start p95 at most 5.0 s; (3) post-response telemetry flush behaviour in serverless execution (fallback: inline flush with the turn deadline and revision gate lowered to 7.2 s); (4) MCP protocol HTTP handshake and round-trip overhead against the 400 ms cap (including stateless MCP/A2A operation); (5) Gemini Flash provider API behaviour with thinking explicitly disabled (fallback: lower token ceiling). **Action trigger (fail-closed):** if item 1 or item 2 fails empirical verification, the documented container-topology fallback (DESIGN DD-07: orchestrator, MCP and safety services on a container host, for example Docker on Railway) is triggered immediately, with no dependency-trimming debate and no redesign of the services. Item 4, as already stated in PRD §18.4, also moves the services to the container host. Items 3 and 5 take their stated fallbacks with no topology change. Every outcome is recorded as an ADR and PRD §15.4 is amended before Tier 1b starts. `docs/threat-model.md` v0 (task P0-16) is likewise due before Tier 1b starts, and Gate B verifies that it exists. The P0-14 version pins do **not** depend on P0-13: they depend on P0-12 and record SDK sizes from a local `pip install --target --no-compile`. P0-13 re-checks the pins on Vercel.
- **TBD, decided only if the trigger fires:** base image, Dockerfile, process manager, container memory and CPU. This file does not set them.
- **Constraints that apply either way:**
  1. Three separate deploy roots and entrypoints, one per service, each with its own dependency manifest. They share code only through the modules in DESIGN §1.5.
  2. All configuration comes from environment variables in §2.4.
  3. No in-memory state between requests. No local-disk state.
  4. The MCP image must not include ADK, pandas, torch or transformers.
  5. HTTP and in-process calls use the same module, so behaviour is identical. In Phase A the verifier is called in process. From Phase B a container image that packages SymPy with the API may call `app.verifier.service` in process as the verifier's single fallback. Without it, the verifier's fallback is a repeat MCP call.

### 4.3 Observability foundation

| Aspect | Foundation | Source |
| --- | --- | --- |
| Tracing | One Langfuse trace per tutor turn (`session_id` = session id, `user_id` = pseudonymous `app_user.id`). One span per agent step and tool call. MCP and A2A calls are child spans | SPEC §5.8 |
| Instrumentation | OpenTelemetry/OpenInference for ADK, exporting to Langfuse's OTLP endpoint | PRD §15.5 |
| Context propagation | W3C `traceparent` and `tracestate` on every HTTP call to MCP and Safety | PRD §15.5 |
| Trace metadata | `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment` | SPEC §5.8 |
| Per-turn record in Postgres | Provider, model, model version, temperature, prompt version, hint-policy version, policy-config version, tool results, `trace_id`, `trace_status`, `fallback_reason` | SPEC §5.8 |
| Flush | After TX-B, asynchronously in the background after the response (platform background task or non-blocking worker). Otherwise inline before return, capped at 300 ms, with the turn deadline and revision gate cut to 7.2 s. Failure sets `trace_status=missing` and increments `trace_missing`. The turn is never failed | SPEC §5.1, §5.5 |
| Privacy | Pseudonymous ids only. A masking function runs before export. No free text reaches a span in Release 1.0 | SPEC §5.7 |
| Sentry boundary | Sentry owns uncaught exceptions, unhandled 5xx, failed browser network calls, error boundaries and operational health. Langfuse owns everything above. A handled fallback is not a Sentry event. Tracing and Replay off | PRD §15.5.1, SPEC §5.8 |
| Sentry privacy and correlation | `before_send` scrubber (built in P1-16): no request bodies, cookies, `Authorization`, local variables or exception message text. Tags limited to `request_id`, `trace_id`, `session_id`, `environment`, `release`, service. No `app_user.id` or Clerk id | PRD §15.5.1, SPEC §5.8 |
| Prompt management | Tier 1a: prompts versioned as repo files (`PROMPT_SOURCE=repo`). Tier 1b onward: versioned in Langfuse with a pinned label per environment (`LANGFUSE_PROMPT_LABEL`), cached as `prompt_template` | SPEC §5.8, §5.6 |
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
| Platform | Vercel Python Functions for API, MCP and Safety, each from its own deploy root. Vercel Next.js (App Router, client-rendered, Node runtime) for the web app. Neon Postgres. Container-portable | PRD §15.1, §15.6 |
| Client | iPad Safari 16+, current Chrome and Edge. 768 px minimum. WCAG 2.1 AA target for the practice screen | SPEC §5.10 |
| Serverless | Stateless functions. No in-memory state between requests. No message queue. No background worker on the student path | SPEC §5.4, DESIGN §2.1 |
| Data scope | Synthetic students only in every public and preview environment. No name or email in `app_user` | SPEC §5.7 |
| Concurrency (demo) | 10 concurrent students. 150-student cohort view | SPEC §5.4 |
| Per-session | One in-flight event per session, enforced by the session lease (12 s). A different-key event during a live lease gets 409 `request_in_progress` | DESIGN DD-01 |
| Per-turn time | 7.5 s hard stop. Stage timeouts: verifier 400 ms, retrieval 250 ms, classifier 1,000 ms, policy 40 ms, dialogue 1,400 ms, guard 1,200 ms (1.3 s cap), persistence 200 ms | SPEC §5.1 |
| Fallbacks | At most one fallback per turn, only on timeout or connect failure (verifier: repeat MCP call, or in-process on a container topology; guard: in-process) | SPEC §5.5 |
| Size | Unzipped API bundle ≤ 250 MB (checked on the CI build artefact from Phase A). MCP bundle ≤ 90 MB. Cold-start p95 ≤ 5 s and the MCP cold-start (first-call) p95 (design target < 1.2 s) are measured on deployed services (not run at Gate A, applied at Gate B) | SPEC §5.2, §5.1 |
| Quality gates that block merge | `answer_leakage` = 0, `schema_valid` 100%, `single_prompt` 100%, `age_appropriate` 100%, trajectory leakage 0, `verifier_agreement` ≥ 99%, `hint_policy_match` ≥ 95%, verifier p95 < 400 ms (Gate B, on the MCP call span; not run at Tier 1a, where the verifier is in process), tutor-turn p95 < 8 s (hard-stop-honoured assertion; the < 5 s target is reported), 0 authorisation failures, `fallback_rate` ≤ 5% (live, model-level ratchet: reported until the first calibration run with n ≥ 100, blocking after it) | SPEC §5.9 |
| Retention | Chat 90 d, attempts 365 d, notes and comments 365 d, traces 90 d, student-specific blobs 90 d. Audit rows and approved diagrams are never deleted | DESIGN §3.8 |
| Scope exclusions | No algebraic expressions with a variable. No free text to any model. No autonomous publication of generated content. No real-learner deployment, no separate graph database, no parent route | SPEC §1.4 |
| Dependencies | `pip-audit`, `npm audit` and `gitleaks` (task P1-16) fail the build on a high-severity finding or a detected secret | SPEC §5.7 |
| Confirmation pending | Vercel plan limits (cron frequency, function duration, bundle size), to be confirmed when the owner first deploys. The operational defaults of Decision #34 and the payload limits are accepted | SPEC §5.10; Decision #34 |

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
12. No import of ADK, SQLAlchemy models or the provider adapter in the shared verifier module. The MCP bundle must stay within 90 MB. From Phase B, no import of SymPy outside `solvepath-mcp` (and a container image that opts in); in Phase A `app.verifier` is the only API module that imports it. The normaliser is standard library only.
13. No second shared store (Redis, in-memory cache, graph or vector database) without superseding DD-06.
14. No fuzzy or semantic cache. Exact keys only. Verifier cache values hold the pure result only, never `progress`, hint level, retry count or `response_target`.
15. No state changes outside `transitions.apply`, which is applied in two phases (legality in TX-A, outcome resolution in TX-B).
16. No hard-coded provider, model id, URL or threshold in code. These come from configuration and versioned policy data.

**Persistence and concurrency**

17. No database connection held across MCP, A2A or LLM calls. The pipeline runs between two short transactions (TX-A, TX-B).
18. No session-level Postgres state: no `SET` (use `SET LOCAL`), no session advisory locks, no reliance on prepared statements.
19. No migrations through the pooled string. No migrations run from a request handler.
20. No stored cursor or advisory lock for cron jobs. Work is derived from data using `FOR UPDATE SKIP LOCKED`. No transaction is held open across an LLM or embedding call (claim and read, call, then write with a pending re-check).
21. No `UPDATE` or `DELETE` on `audit_event`. No free text, full prompt or raw model output in audit rows.
22. No mutation of a terminal session row except the `transfer_outcome` back-fill. `student_note`, `session_flag` and audit rows are separate tables and are written in any state.
23. No mutation of a published `question` version. An edit creates a new version.
24. No use of `tutor_turn.turn_number` for the cap. The cap counter is `tutoring_session.turn_number`.

**Security**

25. No trust in any token claim except `sub`. Authorisation is decided in Postgres on every request.
26. No fail-open on JWKS, service-token or cron-secret checks.
27. No secret in the repository, a `NEXT_PUBLIC_` variable, a client bundle, a log line or a trace.
28. No shared service-token secret across MCP and Safety. No signing secret held by the verifying service.
29. No guessable public URL for student-specific Blob objects.
30. No real student data in any public or preview environment.

**Delivery**

31. No CORS configuration. The same-origin rewrite removes the need.
32. No handwritten web types for API shapes. Types are generated from `contracts`, and drift fails CI.
33. No change to a prompt, the hint policy or the model configuration without running the evaluation suite.
34. No bundle growth that breaks the 250 MB limit (from Phase A) or the 90 MB MCP limit (from Phase B). From Phase B the MCP bundle must not gain ADK, pandas, torch or transformers.
35. No Vercel-specific API in L0–L6. Vercel details stay in entrypoints, configuration and L7 adapters.
36. No unpinned `google-adk`, MCP SDK, A2A SDK, Gemini model id or embedding model once the Phase 0 ADR exists.

### 5.3 Open items owned elsewhere

| Item | Owner / source |
| --- | --- |
| Exact versions: `google-adk`, MCP SDK, A2A SDK, Gemini Flash model id, `MODEL_EMBEDDING` | Phase 0 ADR (Decision #30) |
| **Empirical validation items for the P0-13 spike (rehearses the Phase B topology, unproven until recorded):** post-response background work for the Langfuse flush (§4.3), the MCP round-trip count and latency against the 400 ms cap, Gemini thinking disabled, shared-source access from the deploy roots. Each has a stated fallback | P0-13 spike and ADR |
| Deploy spike result (bundle size, cold start, stateless MCP/A2A on Vercel) | PRD §18.4. Decides whether §4.2 container details are needed |
| Structured-output route (ADK `output_schema` or adapter JSON mode) | Phase 0 provider spike (Decision #27) |
| Postgres driver, HTTP client, OpenAPI-to-TypeScript generator, import-linter tool | Not named in the sources. Chosen at implementation |
| Logging format and sink | Not specified |
| Compute and memory sizing | Not specified. Confirm against current Vercel limits |
| Operational defaults of Decision #34 (WCAG target, device matrix, demo load, RPO and RTO, secret rotation, USD 20 ceiling) and payload limits (D-13): **closed**, accepted by the product owner on 2026-10-11 | Recorded |
| Repository licence | PRD §22.2 A3 |
