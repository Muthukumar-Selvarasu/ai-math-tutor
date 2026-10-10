# SolvePath — Multi-Agent Socratic Mathematics Tutor

> **An evidence-driven, Socratic mathematics tutoring and teacher intelligence platform with deterministic SymPy verification and state-machine orchestration.**

[![CI](https://github.com/muthukumars/ai-math-tutor/actions/workflows/ci.yml/badge.svg)](https://github.com/muthukumars/ai-math-tutor/actions)
[![Python: 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![React: 18](https://img.shields.io/badge/react-18-cyan.svg)](https://react.dev/)

The product specification is [PRD.md](PRD.md) (draft v1.3.18). The build order is [PLAN.md](PLAN.md). Agent rules are in [AGENTS.md](AGENTS.md).

---

## Overview

**SolvePath** guides Australian Years 5–6 learners who are preparing for selective-entry style quantitative reasoning. The first curriculum is ratio, proportion, scale, and multiplicative reasoning.

The tutor does not answer "I don't get it" with a worked solution. Each turn:

1. Checks the attempt with **SymPy** through an **MCP** tool, before any tutor sentence.
2. Retrieves misconception exemplars only when that check is not correct.
3. Asks **one** question inside a hint level (0–5) chosen by policy, not by the model.
4. Sends the draft through an **A2A** Safety Guard. A blocked or unreachable guard falls back to a fixed prompt.
5. Records the turn, the provider, and a [Langfuse](https://langfuse.com/) trace, then updates a rules-based learner model.

Teachers receive drafts, replay, and overrides. The system does not grade, place, admit, or contact parents. Public demos use synthetic students.

The capstone covers Forward Deployed Engineering weeks 1, 2, 3, 4, and 6: the tutoring harness, subagents, retrieval plus a skill graph and cache, MCP and A2A, and a customer handover. Voice and a separate demo-day product are out of scope. The mapping is PRD section 15.7.

---

## Core principles

- **Thinking over answers.** A full worked solution is hint level 5, and only when policy allows it.
- **State machine first.** The model does not choose tools, hint level, or whether an answer is correct.
- **SymPy before language.** A verifier failure is `cannot_verify` or a tool error. It is never a model guess.
- **Structured input.** The student uses controls. Free text is a note for the teacher and never reaches a model. A deterministic Input Screen answers hostile or worrying text with authored replies.
- **Teacher in the loop.** Recommendations stay drafts until a teacher accepts, rejects, or overrides them.
- **Audit every turn.** Model, provider, prompt version, hint level, verifier result, and trace id are stored. Langfuse receives pseudonymous ids only.

---

## Architecture

```text
Browser (React 18 + TypeScript SPA on Vercel)
        ↓ HTTPS (same-origin /api/* rewrite)
FastAPI orchestrator (Python 3.12)
  ├─ Auth and RBAC (JWT, cohort scope)
  ├─ Append-only audit log
  ├─ Exact-key cache (expressions, exemplar queries, prompt templates)
  ↓
Tutor state machine
        ↓
Google ADK Runner ───────────────► Langfuse (one trace per turn)
  ├─ Problem context + Input Screen (canned replies, no model)
  ├─ Verifier ── MCP ──► SymPy tool server
  ├─ Retrieval gate (exemplars only when the attempt is not correct)
  ├─ Student-State Estimator (deterministic)
  ├─ Misconception Classifier (taxonomy enum only)
  ├─ Hint Policy Engine (levels 0–5)
  ├─ Socratic Dialogue Agent
  └─ Safety Guard ── A2A ──► safety service
        ↓
PostgreSQL (Neon)
  ├─ domain data
  ├─ pgvector exemplars and questions
  ├─ skill and misconception graph
  └─ exact-key cache
Vercel Blob (diagram SVGs and exports)
        ↑
Vercel Cron Jobs (rollups, insight drafts, item scan, embedding sync, retention)
        ↓
Educator dashboard and session replay (React)
```

LLM calls go through one provider adapter. **Gemini** is the default. The same agent schemas also run on **OpenRouter** or an OpenAI-compatible **vLLM** endpoint.

---

## Technology stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Tailwind CSS, Radix UI primitives, KaTeX |
| **Orchestrator** | Python 3.12, FastAPI | Pydantic v2, async endpoints; synchronous checked JSON responses (no unapproved tokens streamed) |
| **Agent framework** | Google ADK | `SequentialAgent`, `LoopAgent`, `LlmAgent`, custom `BaseAgent`. LLM agents do not call tools. |
| **Protocols** | MCP and A2A | MCP: SymPy, question lookup, exemplar search. A2A: Safety Guard. Separate entrypoints from the orchestrator. |
| **LLM access** | Provider adapter | `LLM_PROVIDER=gemini` (default), `openrouter`, or `vllm` |
| **Math verification** | SymPy | Ratio, proportion, equivalence, and tolerance rules. Reached only through MCP on the live path. |
| **Database** | PostgreSQL 16 + pgvector | Neon via Vercel. SQLAlchemy 2, Alembic. Skill graph is tables in the same database. |
| **Cache** | Postgres | Verifier results, exemplar queries, prompt templates. Student free text is not cached. |
| **Observability** | Langfuse Cloud | Traces, prompt versions, datasets, deterministic scores |
| **Object storage** | Vercel Blob | Validated diagram SVGs and exports |
| **Jobs** | Vercel Cron | Idempotent batches recorded in `job_run` |
| **CI/CD** | GitHub Actions + Vercel Git | Actions are the quality gate. Vercel deploys web, API, MCP, and safety. |
| **Secrets** | Vercel Environment Variables | Nothing secret is committed. Browser variables use the `VITE_` prefix only. |

Quality gates are fixed in PRD section 14.5: leakage 0, schema validity 100%, verifier agreement at least 99%, hint-policy match at least 95%, verifier p95 under 400 ms, tutor-turn p95 under 8 s.

---

## Repository layout

The application tree below is the target from PRD section 16.1. It is not in the repo yet. [PLAN.md](PLAN.md) Phase 0 creates it.

```text
ai-math-tutor/
├─ apps/
│  ├─ web/                         # React + TypeScript (Vite)
│  │  ├─ src/features/student/     # practice, tutor chat, progress
│  │  ├─ src/features/educator/    # cohort, replay, review queue
│  │  ├─ src/features/admin/       # audit viewer, content review
│  │  └─ vercel.json
│  └─ api/                         # FastAPI + Google ADK
│     ├─ api/index.py              # orchestrator entrypoint
│     ├─ mcp_server.py             # SymPy, questions, exemplars
│     ├─ a2a_safety.py             # Safety Guard
│     ├─ app/                      # agents, verifier, policy, graph, cache, jobs
│     ├─ tests/
│     └─ pyproject.toml
├─ content/
│  ├─ questions/                   # approved seed items and blueprint.md
│  ├─ misconceptions/              # taxonomy and exemplars
│  ├─ safety/                      # jargon.json, input_lexicon.json, canned_responses.json
│  └─ eval/                        # labelled cases (JSONL)
├─ docs/                           # adr/, threat-model.md, runbook.md (created as written)
├─ .agents/skills/                 # task commits, GitHub issues
├─ scripts/                        # sync_stories.py
├─ .github/workflows/              # ci, eval, content validation
├─ AGENTS.md                       # operational contract
├─ PLAN.md                         # phase order
├─ PRD.md                          # product requirements
├─ user-story.md                   # epics and stories
├─ REVIEW.md                       # course-coverage review
└─ README.md
```

---

## Getting started

The commands below are the local setup **after** Phase 0 of [PLAN.md](PLAN.md). `apps/web` and `apps/api` are not in the repository yet.

### Prerequisites

- Node.js 20 or newer
- Python 3.12
- PostgreSQL 16 with pgvector (Neon for shared environments)
- A Gemini API key (`LLM_PROVIDER=gemini`)
- A Langfuse Cloud project
- Optional, for the second provider run: an OpenRouter key or a vLLM base URL

### Backend

```bash
cd apps/api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Run the MCP server and the A2A safety service as their own processes (`mcp_server.py`, `a2a_safety.py`). The orchestrator calls them. It does not grade an answer inside the tutor prompt.

### Frontend

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

`VITE_` variables are public. Do not put API keys in the frontend env file.

---

## Delivery roadmap

Detail, exit tests, and the first-session backlog are in [PLAN.md](PLAN.md).

Phases 0–2 are the **Tier 1 demo gate** (10 items, 42 critical eval cases), reached in two steps: Release 1.0a is the in-process tutor, and Release 1.0 adds MCP, A2A, retrieval, cache and tracing (PRD 18.1). They are not the full launch: 40 items and 150 eval cases come with Release 1.1/1.2.

- [x] **Design baseline** — PRD v1.3.18, agent contract, course review, delivery plan, and user stories (stories still under review)
- [ ] **Slice 0: Walking skeleton** — single-process demo trajectory passing before any platform work (PRD 18.4.1)
- [ ] **Phase 0: Bootstrap** — monorepo, CI, provider spike, customer discovery; Neon, Blob, Langfuse and the four Vercel projects are added after Slice 0 is green
- [ ] **Phase 1: Tutor foundation** — auth, question bank, practice UI, session state, SymPy, hint policy
- [ ] **Phase 2: Socratic intelligence** — ADK pipeline, provider adapter, MCP, retrieval gate, cache, skill graph, A2A guard
- [ ] **Phase 3: Teacher operations** — profile, cohort, replay, drafts, overrides, cron rollups
- [ ] **Phase 4: Governance** — leakage and authz tests, 150-case eval set, retention
- [ ] **Phase 5: Deploy and hand over** — synthetic production, threat model, runbook, map-problem demo

---

## Backlog

Stories, acceptance criteria, and definition of done are in [user-story.md](user-story.md). They are still being validated. Acceptance criteria live only there. `scripts/sync_stories.py` copies them into PRD section 6, and CI fails if the two differ.

GitHub issues are not open yet. `user-story.md` is the record until you ask to create them.

## Development standards

- Stories follow PRD section 6 and `.agents/skills/github-issues`: `[STU-xx]`, `[EDU-xx]`, `[TECH-xx]`.
- Commits follow `.agents/skills/task-commits`: one finished task per commit, with the task id in the message. Do not commit a whole phase as one change.
- Students only see questions that are approved and published.
- SymPy tests and the leakage gate must pass before merge. An LLM judge does not block the pipeline.

---

## References

- [PRD.md](PRD.md) — requirements, the client–server contract (section 15.9), the failure-state contract (section 11.6), architecture, thresholds, launch criteria, and the task catalogue in section 6.8
- [PLAN.md](PLAN.md) — phase order and first working session
- [user-story.md](user-story.md) — epics, stories, acceptance criteria, definition of done
- [AGENTS.md](AGENTS.md) — non-negotiables for implementation
- [REVIEW.md](REVIEW.md) — how this capstone was scored against the FDE course
