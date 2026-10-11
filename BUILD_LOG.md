# SolvePath — Build Log (BUILD_LOG.md)

Sources: `PRD.md` §18 (roadmap, tiers, phases, Slice 0, starter backlog), §21 (gates); `SPEC.md`; `DESIGN.md`; `TECHNICAL.md` §1; `AGENTS.md`; `THRESHOLDS.md`; `EVALS.md`.

Conventions: This file records progress only. It adds no milestone, task, threshold or decision that the upstream files do not state. Every roadmap row cites its PRD source. A change to scope, a threshold or a design rule goes to §4 (ADR) and is made in the upstream file by its owner, never here. Status values: `Pending`, `In Progress`, `Blocked`, `Done`. Log actual hours at the end of every working session against the Tier 1a, 1b and 1c budgets (PRD §18.2).

---

## 1. Project Metadata & Build Baseline

### 1.1 Project

| Item | Value |
| --- | --- |
| Project name | SolvePath (AI Math Tutor) |
| Target branch | `main` |
| Log created | 2026-10-11 |
| Delivery model | 1 Forward Deployed Engineer, 25–30 h/week, 6–8 weeks (about 150–240 h) (PRD §18.2) |
| Release tiers | Tier 1 = Release 1.0 (Phases 0–2, 103–135 h, gates 1a / 1b / 1c). Tier 2 = Release 1.1 (Phase 3, ~55–70 h). Tier 3 = Release 1.2 (Phases 4–5, ~30–40 h) (PRD §18.1) |
| Commitment | Only Tier 1a and 1b are a commitment. Tiers 1c, 2 and 3 are best effort (PRD §18.2) |
| Checkpoints | Tier 1a must pass by hour 70. Tier 1 as a whole should pass by hour 125. Cut order is in PRD §18.2 and is applied without re-debate |
| Never cut | Leakage gates, the verifier, service-to-service authentication, the early educator check and the child usability check (PRD §18.2) |

### 1.2 Primary runtime and stack summary (TECHNICAL §1; versions marked TBD stay TBD until the Phase 0 ADR)

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, FastAPI (async), Pydantic v2, SQLAlchemy 2, Alembic |
| Agents | Google ADK (`SequentialAgent`, `LoopAgent`, `LlmAgent`, `BaseAgent`). Deterministic hub-and-spoke harness (AGENTS §1.1) |
| Protocols | MCP (streamable HTTP, stateless) `solvepath-mcp`. A2A Safety Guard `solvepath-safety` |
| Mathematics | SymPy, mpmath |
| Frontend | TypeScript, Vite SPA, React 18, React Router, TanStack Query, Tailwind CSS, KaTeX |
| Data | PostgreSQL on Neon with pgvector (`vector(768)`), Vercel Blob |
| LLM | Provider adapter. Gemini Flash default (`LLM_PROVIDER`). OpenRouter / vLLM alternates (Tier 2) |
| Identity and observability | Clerk. Langfuse Cloud (OTLP, OpenInference) |
| Hosting and CI | Vercel, four projects (`solvepath-web`, `solvepath-api`, `solvepath-mcp`, `solvepath-safety`). GitHub Actions required gate. Vercel Cron for `/api/jobs/*` |
| Pins still TBD | Exact `google-adk`, MCP SDK, A2A SDK, Gemini Flash model id, `MODEL_EMBEDDING`, FastAPI, Alembic, SymPy, frontend library versions (Version pin ADR, Decision #30) |

### 1.3 Initial repository state (as of 2026-10-11)

| Item | State |
| --- | --- |
| Branch | `main` |
| Contents | Documentation only: `PRD.md`, `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `idea/`, `docs/`, `.claude/`. No application source, no monorepo, no `ci.yml`, no tests |
| Working tree | This file (`BUILD_LOG.md`) is the only uncommitted change. Left uncommitted for manual review |

### 1.4 Environment setup status

| Item | Status | Source |
| --- | --- | --- |
| Monorepo skeleton (`apps/web`, `apps/api`, linting, formatting, pre-commit) | Pending | PRD §18.4 Phase 0, §16.1 |
| GitHub repository and `ci.yml` on an empty skeleton | Pending | PRD §18.4 Phase 0, §18.5 #1 |
| Deploy spike, provider spike | Pending | PRD §18.4 Phase 0 |
| Postgres + pgvector, Vercel Blob, Langfuse, four Vercel projects | Pending. Deferred until Slice 0 is green | PRD §18.4 Phase 0 "Deferred" |
| Secrets and environment variables | Pending. Not created | TECHNICAL §1.2 |

### 1.5 Documentation sign-off status

All seven baseline documents are recorded as complete and signed off, on the owner's instruction when this log was created (2026-10-11). The upstream files themselves hold no sign-off record. Items they mark as pending owner decision or `TBD` remain open and are not closed by this log (see §1.6).

| Document | Phase | Commit | Status |
| --- | --- | --- | --- |
| `PRD.md` | 1 | `07123db` | Signed off |
| `SPEC.md` | 2.1 | `13589d5` | Signed off |
| `DESIGN.md` | 2.2 | `175c697` | Signed off |
| `TECHNICAL.md` | 2.3 | `4363052` | Signed off |
| `AGENTS.md`, `CONTEXT.md` | 3 | `31a4b18` | Signed off |
| `THRESHOLDS.md`, `EVALS.md` | 4 | `013afbb` | Signed off |

### 1.6 Open upstream items carried into the build (not decided here)

| Item | Owner or source |
| --- | --- |
| Exact version pins and model ids | Phase 0 Version pin ADR (Decision #30) |
| Structured-output route per provider (ADK `output_schema` or adapter JSON mode) | Phase 0 provider spike (Decision #27) |
| Spend ceiling sign-off (USD 100 monthly, alert at 80%) | Decision #34, pending sign-off (AGENTS §4.3) |
| `ProblemParser` mode, `TeacherInsightAgent` model variable and timeout, token-budget split, cache TTLs, exemplar top-k, `tone` value set | AGENTS §5.10, policy configuration |
| Further open items | `THRESHOLDS.md` (`Not specified` rows), `EVALS.md` §5.5 |

---

## 2. Implementation Roadmap & Task Ledger

### 2.1 Phase structure and mapping to build-focus labels

The PRD phases and tiers are the authoritative structure. The four build-focus labels group them and add no phase.

| Build-focus label | PRD phases / tiers it groups | Gate |
| --- | --- | --- |
| Core Infrastructure | Phase 0 (incl. Slice 0), Phase 1 | Slice 0 exit test. Tier 1a (hour 70) |
| Models / APIs | Phase 2 (verifier exposure, provider, MCP, retrieval, cache). Phase 3 (teacher APIs and cron jobs) | Gate B |
| Agent Integration | Phase 2 (ADK pipeline, hint policy, Dialogue Agent, A2A Safety Guard, Langfuse propagation) | Gate B |
| Evals & Hardening | Phase 2 trajectory evals. Phase 4. Phase 5 | Gate A / B / C (PRD §21.1). Release criteria (PRD §21.2) |

Ordering rules from the PRD: Slice 0 gates all other work. Each later addition is added one at a time and keeps `test_demo_trajectory.py` green. The early educator check and child usability check run after Slice 0 is green and before Gate B. Tier 1c starts only after Gate B passes. Threat model v0 is done before Tier 1b starts.

### 2.2 Task ledger

Task ID format: `P{phase}-NN`. Existing PRD identifiers (`TECH-xx`) are cited where the PRD gives one. "Group" is the build-focus label from §2.1.

#### Phase 0 — Discovery, design and project bootstrap (1 week) — Group: Core Infrastructure

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P0-01 | Customer discovery interviews (2–3) and customer problem statement | — | Pending | PRD §18.4 |
| P0-02 | Personas, current/future-state workflow, curriculum map, selective-entry framing | P0-01 | Pending | PRD §18.4 |
| P0-03 | Skill graph for ratio and proportion | — | Pending | PRD §18.4 |
| P0-04 | Misconception taxonomy (12 codes in 4 calibration clusters) | — | Pending | PRD §18.4 |
| P0-05 | Hint-policy definition (Levels 0–5) | — | Pending | PRD §18.4 |
| P0-06 | Data and privacy assessment (incl. Input PII scrubber specification) | — | Pending | PRD §18.4 |
| P0-07 | MVP success metrics; one-page customer brief | P0-01 | Pending | PRD §18.4, §15.8 |
| P0-08 | Monorepo with `apps/web`, `apps/api`, linting, formatting, pre-commit hooks | — | Pending | PRD §18.4, §16.1 |
| P0-09 | GitHub Actions `ci.yml` on an empty working skeleton (lint + placeholder leakage test) | P0-08 | Pending | PRD §18.4, §18.5 #1 |
| P0-10 | Low-fidelity wireframes: student practice screen and Tier 1c replay | — | Pending | Before UI work begins (PRD §18.4) |
| P0-11 | Item blueprint `content/questions/blueprint.md` | P0-03, P0-04 | Pending | Agreed before any seed item is authored (PRD §18.4, §18.3) |
| P0-12 | Provider spike (≤ 4 h, week 1) + ADR | — | Pending | Pass: ≥ 9 of 10 canned prompts schema-valid on the alternate (PRD §18.4) |
| P0-13 | Deploy spike (≤ 4 h) + ADR | P0-08 | Pending | Before infrastructure work. Fail moves orchestrator, MCP and safety to a container host and amends PRD §15.4 before Tier 1b |
| P0-14 | Version pin ADR (model ids, `MODEL_EMBEDDING`, ADK, A2A, MCP SDK) | P0-12, P0-13 | Pending | Decision #30 |
| P0-15 | ADRs for the locked stack | P0-14 | Pending | PRD §18.4 |
| P0-16 | Threat model v0 (≤ 3 h) | — | Pending | TECH-55. Before Tier 1b starts |
| P0-17 | Slice 0 walking skeleton: FastAPI, in-process SymPy verifier, in-process hint policy, one Gemini Flash call, 3 seed items (`scale_0001/2/3`), events `submit` / `reflection_choice` / `transfer_decision`, minimal practice page with keypad | P0-08, P0-11 | Pending | PRD §18.4.1. About 15–20 h. Exit test: `test_demo_trajectory.py` green locally with 0 leaks. Gates all other work. Section 8.5.1 full table replaces inline transitions in Sprint 1 (TECH-52) |
| P0-18 | Early educator check (~10 turns, Socratic rubric) and child usability check (~20 min) | P0-17 | Pending | PRD §18.4.2. Findings applied before Gate B. Sets `DIALOGUE_MODE` rule. If no child is reachable, record in an ADR signed by the product owner |

#### Phase 1 — Tutor foundation (1–2 weeks) — Group: Core Infrastructure (Tier 1a)

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P1-01 | Authentication and role scaffolding (Clerk JWT, RBAC dependencies, audit middleware) | P0-17 | Pending | Added after Slice 0 is green (PRD §18.5 #7) |
| P1-02 | Postgres with pgvector and first Alembic migration | P0-17 | Pending | Deferred until Slice 0 is green |
| P1-03 | Deterministic Input PII scrubber | P0-06 | Pending | PRD §18.4 |
| P1-04 | Question-bank schema (steps, predictions, isomorphic examples) and import tooling | P1-02 | Pending | TECH-07 |
| P1-05 | 10 validated core seed ratio questions with collision-free predictions | P0-11, P1-04 | Pending | PRD §18.3 (about 2 days). Passes V1–V9 |
| P1-06 | Jargon list, Input Screen lexicon, canned replies (28 keys) | P1-05 | Pending | PRD §18.3 2a/2b. C1–C3. All keys `reviewed` at Gate B (C4) |
| P1-07 | Student practice interface in React (keypad, reasoning options, wait states) | P0-10 | Pending | PRD §18.4 |
| P1-08 | Session state machine (table-driven FSM, `transitions.apply`) | P0-17 | Pending | TECH-52 |
| P1-09 | Answer submission (numeric, ratio, reasoning options) | P1-08 | Pending | PRD §18.4 |
| P1-10 | Deterministic ratio/proportion verifier (SymPy) with shared normaliser, developed in-process first | P0-17 | Pending | PRD §18.4. Verifier p95 < 400 ms (CI gate) |
| P1-11 | Deterministic expression cache (exact key) | P1-02, P1-10 | Pending | PRD §18.4. Deferrable under cut order (2) |
| P1-12 | Basic event logging (Postgres append-only `audit_event`) | P1-02 | Pending | PRD §18.4 |
| P1-13 | Deterministic diagram renderer with leakage guard (Level 3 ratio table only in Tier 1) | P1-05 | Pending | PRD §18.1 Tier 1a |
| P1-14 | **Tier 1a checkpoint** (hour 70): in-process core passes | P1-01 to P1-13, P2-04 to P2-12 | Pending | Fail: apply cut order 0 then (1) to (3) (PRD §18.2) |

#### Phase 2 — Socratic intelligence (1–2 weeks)

| Task ID | Group | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P2-01 | Agent Integration | Google ADK per-turn pipeline (`SequentialAgent` + bounded `LoopAgent`, isolated context per agent) | P1-10, P1-08 | Pending | AGENTS §1.1, §5.1 |
| P2-02 | Models / APIs | Primary provider integration (Gemini Flash) and provider adapter interface | P0-14 | Pending | Secondary provider evaluation is P3-10 |
| P2-03 | Agent Integration | Structured agent schemas (Pydantic, versioned) | P1-04 | Pending | AGENTS §2.1 rule 3 |
| P2-04 | Agent Integration | Deterministic misconception matcher (< 10 ms, 0.90 confidence) | P1-05 | Pending | AG-03 |
| P2-05 | Agent Integration | Retrieval gate; deterministic student-state estimator | P2-01 | Pending | AG-04, AG-05 |
| P2-06 | Agent Integration | Hint-policy engine (Levels 0–5; isomorphic worked example on withheld Level 5) | P0-05, P2-01 | Pending | AG-07. < 40 ms |
| P2-07 | Agent Integration | Socratic Dialogue Agent (< 100-token prompts) | P2-02, P2-03, P2-06 | Pending | AG-08. `DIALOGUE_MODE` per P0-18 |
| P2-08 | Agent Integration | Deterministic leak check (value and method) | P2-07 | Pending | AG-09 |
| P2-09 | Agent Integration | Safety module, in-process behind the A2A interface | P2-08 | Pending | Tier 1a form of AG-10 |
| P2-10 | Agent Integration | Conditional misconception classifier | P2-02, P2-05 | Pending | AG-06 |
| P2-11 | Agent Integration | Skill and misconception graph seeded for ratio skills; transfer item selection (`select_transfer`) and next practice | P0-03, P1-05 | Pending | Authored graph partners until pgvector arrives in 1b |
| P2-12 | Agent Integration | Learner-model delta (`update_learner_model`) | P2-11 | Pending | Tier 1a |
| P2-13 | Evals & Hardening | 42 critical eval cases (15 direct-answer, 15 prompt-injection, 12 unsafe-input, ≥ 10 method-leak) | P1-06 | Pending | PRD §18.3 (about 3 days). 0-leak CI gate |
| P2-14 | Evals & Hardening | Multi-turn trajectory evals: golden demo trajectory, simulated pleading student | P2-01 | Pending | PRD §18.4 Phase 2 |
| P2-15 | **Gate A** (Release 1.0a) | In-process core demonstrable | P1-14, P2-13, P2-14 | Pending | PRD §21.1 |
| P2-16 | Models / APIs | MCP server: `verify_expression`, `get_question`, `search_exemplars` with in-process fallback | P1-10, P0-16, P0-13 | Pending | Tier 1b. Cut order (1) may keep `search_exemplars` in-process |
| P2-17 | Agent Integration | A2A Safety Guard service (`solvepath-safety`) with service-token authentication | P2-09, P0-16 | Pending | Tier 1b. Keep under every cut |
| P2-18 | Models / APIs | pgvector exemplar retrieval; exemplar per taxonomy label | P1-02, P2-05 | Pending | Tier 1b. Embedding sync via `MODEL_EMBEDDING` |
| P2-19 | Agent Integration | Langfuse traces and scores; W3C `traceparent` propagation across MCP and A2A | P2-16, P2-17 | Pending | Tier 1b |
| P2-20 | Models / APIs | Four Vercel projects with env vars (Development, Preview, Production) and `warmup` job | P0-13 | Pending | Tier 1b. Each addition keeps the golden test green |
| P2-21 | **Gate B** (Release 1.0) | Tier 1 demo gate | P2-16 to P2-20, P0-18 | Pending | PRD §21.1. All canned-reply keys `reviewed` (C4). Target hour 125 |

#### Tier 1c — Minimal teacher view (Release 1.0, 8–10 h) — Group: Models / APIs

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| T1c-01 | Read-only replay of one session for the assigned teacher | P2-21 | Pending | TECH-49. Does not start until Gate B passes. Cut order 0 |
| T1c-02 | One on-demand pending draft recommendation with evidence (Teacher Insight code path later reused by `insight-drafts`) | P2-21 | Pending | No accept/override UI, no dashboard, no cron |
| T1c-03 | **Gate C** (Release 1.0 with teacher view) | T1c-01, T1c-02 | Pending | PRD §21.1. Demo ends on a real teacher-facing result |

#### Phase 3 — Teacher operations, Tier 2 / Release 1.1 (1 week) — Group: Models / APIs

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P3-01 | Student learning profile | T1c-03 | Pending | PRD §18.4 |
| P3-02 | Cohort dashboard | P3-01 | Pending | PRD §18.4 |
| P3-03 | Session replay with Langfuse trace links for authorised roles | T1c-01 | Pending | PRD §18.4 |
| P3-04 | Intervention recommendation cards with step evidence; accept/reject/override UI; teacher override | T1c-02 | Pending | PRD §18.4 |
| P3-05 | Item-quality review queue | P1-04 | Pending | PRD §18.4 |
| P3-06 | Vercel Cron jobs: `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync`, `eval-nightly` (`warmup` exists from P2-20) | P2-20 | Pending | PRD §18.4 |
| P3-07 | Bar-model diagrams | P1-13 | Pending | PRD §18.1 Tier 2 |
| P3-08 | Question bank expanded to 40 approved items | P1-05 | Pending | TECH-07. About 3 days |
| P3-09 | 60 human-reviewed gold calibration cases across 4 error clusters | P3-08 | Pending | External educator labels ≥ 30 (about 3 h). Otherwise accuracy reported as unvalidated |
| P3-10 | Secondary provider adapter and evaluation (OpenRouter / vLLM) | P2-02, P0-12 | Pending | Deferrable under cut order (3) |

#### Phase 4 — Governance and reliability, Tier 3 / Release 1.2 (1 week) — Group: Evals & Hardening

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P4-01 | Role-based authorisation tests, Postgres RLS policies (per-transaction `SET LOCAL`, fail-closed), pooled-connection leak test | P1-01 | Pending | PRD §18.4 |
| P4-02 | Audit-event viewer | P1-12 | Pending | Cut order (3) |
| P4-03 | Full 150-case benchmark harness in GitHub Actions and Langfuse datasets | P2-13, P3-09 | Pending | Cut order (1): fall back to 42 critical + §14.1 category minimum |
| P4-04 | Model / prompt traceability end to end | P2-19 | Pending | PRD §18.4 |
| P4-05 | Monitoring dashboard (Langfuse dashboards, Vercel logs and alerts) | P2-19 | Pending | PRD §18.4 |
| P4-06 | Error handling and retry policy | P2-01 | Pending | PRD §18.4 |
| P4-07 | `retention-purge` job and retention policy | P1-02 | Pending | Cut order (3) |
| P4-08 | Coordinator cohort tooling | P3-02 | Pending | Cut order (4) |

#### Phase 5 — Deployment and showcase (1 week) — Group: Evals & Hardening

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-01 | Production deployment on Vercel with synthetic data | P2-20 | Pending | PRD §18.4 |
| P5-02 | Complete CI/CD pipeline with eval and security gates | P0-09, P4-03 | Pending | PRD §18.4 |
| P5-03 | Educator validation gate: external educator reviews 20–30 recorded turns (about 2 h) | P2-21 | Pending | PRD §18.2 |
| P5-04 | Threat model (final) | P0-16 | Pending | PRD §18.4 |
| P5-05 | Architecture diagram; evaluation report; operating runbook | P4-03 | Pending | PRD §18.4 |
| P5-06 | 6–8 minute demo video | P5-01 | Pending | PRD §18.4, §19 |
| P5-07 | Customer case study and handover brief | P0-07 | Pending | PRD §18.4 |
| P5-08 | GitHub README and setup documentation | P5-01 | Pending | PRD §18.4 |
| P5-09 | Release criteria check (Release 1.1 and 1.2) | P5-01 to P5-08 | Pending | PRD §21.2 |

### 2.3 Hours ledger (PRD §18.2 budgets)

| Budget | Planned | Actual | Notes |
| --- | --- | --- | --- |
| Slice 0 | 15–20 h | 0 | Inside Tier 1a |
| Tier 1a | 55–70 h | 0 | Checkpoint hour 70 |
| Tier 1b | 40–55 h | 0 | |
| Tier 1c | 8–10 h | 0 | Cut 0 if Tier 1a misses hour 70 |
| Tier 1 content package | about 32 h | 0 | |
| Tier 2 | 55–70 h (+ about 48 h content) | 0 | Best effort |
| Tier 3 | 30–40 h | 0 | Best effort |

---

## 3. Execution & Daily Work Log Format

### 3.1 Entry template

Append new entries below Entry 0, newest last. Never edit a past entry. Correct it with a new entry.

```text
### Entry NNN — <short title>
| Field | Value |
| --- | --- |
| Timestamp | YYYY-MM-DD HH:MM (local, with timezone) |
| Engineer / Agent | <name or agent id and model> |
| Scope Worked | <Task IDs from §2.2> |
| Changes Made | <files, modules, migrations, configuration. Commit hashes once committed> |
| Test / Verification Run | <command, suite, result. Include golden-test status and any eval gate result> |
| Blockers | <none, or what blocks and who owns the unblock> |
| Hours | <session hours, for the §2.3 ledger> |
```

Update the §2.2 status of every task named in Scope Worked in the same session.

### 3.2 Log

### Entry 0 — Documentation & Design Baseline Complete

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Baseline only. No §2.2 task started |
| Changes Made | Created `BUILD_LOG.md`. Recorded Phase 1–4 artifacts as complete: Phase 1 `PRD.md` (`07123db`). Phase 2.1 `SPEC.md` (`13589d5`). Phase 2.2 `DESIGN.md` (`175c697`). Phase 2.3 `TECHNICAL.md` (`4363052`). Phase 3 `AGENTS.md` and `CONTEXT.md` (`31a4b18`). Phase 4 `THRESHOLDS.md` and `EVALS.md` (`013afbb`) |
| Test / Verification Run | None. No application code exists |
| Blockers | None for starting Phase 0. Open upstream items in §1.6 remain open |
| Hours | 0 |

---

## 4. Architectural Decision Records (ADRs) & Divergence Log

Record a decision here when implementation forces a choice the upstream files leave open, or when the build diverges from them. A divergence is not applied until the owner changes the named upstream file (a threshold change is a PRD change, PRD §14.5). Required ADRs named by the PRD (provider spike, deploy spike, version pin, and the child-usability exception) are logged here when produced.

| ADR ID | Date | Decision Summary | Upstream File Impacted (`SPEC.md` / `DESIGN.md`) | Rationale | Trade-offs |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | | | | | |

Status of each ADR is one of `Proposed`, `Accepted`, `Superseded by ADR-NNN`. Add the status in the Decision Summary cell.

---

## 5. Issue, Bug & Debugging Incident Register

| Incident ID | Date Detected | Trigger / Symptom | Root Cause | Fix / Resolution | Eval Impact |
| --- | --- | --- | --- | --- | --- |
| INC-001 | | | | | |

Eval Impact names the affected gate or metric from `THRESHOLDS.md` / `EVALS.md` (for example `answer_leakage`, `schema_valid`, `fallback_rate`), or `None`. A leakage event, verifier mismatch or golden-test failure is always recorded here.
