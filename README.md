# SolvePath — Multi-Agent Socratic Mathematics Tutor

> **An evidence-driven, Socratic mathematics tutoring and teacher intelligence platform with deterministic SymPy verification and state-machine orchestration.**

[![CI](https://github.com/muthukumars/ai-math-tutor/actions/workflows/ci.yml/badge.svg)](https://github.com/muthukumars/ai-math-tutor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python: 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![React: 18](https://img.shields.io/badge/react-18-cyan.svg)](https://react.dev/)

---

## 📖 Overview

**SolvePath** is an AI-powered educational platform designed to guide upper-primary mathematics learners (Australian Years 5–6 preparing for selective-entry and quantitative reasoning assessments) through complex mathematical reasoning.

Unlike traditional chatbots that readily output worked answers when a student says *"I don't get it"*, SolvePath applies the **Socratic method**:
1. It assesses the student's initial attempt.
2. Diagnoses specific misconceptions (e.g., additive thinking instead of multiplicative scaling).
3. Delivers calibrated, single-step prompts and adaptive hints.
4. Deterministically validates calculations using computer algebra before responding.
5. Updates a longitudinal learner mastery model and provides educators with actionable, audit-backed learning evidence.

Full product specifications, curriculum mapping, and design principles are documented in [PRD.md](PRD.md).

---

## 🎯 Core Principles

- **Thinking Over Answers:** The tutor guides students to discover solutions themselves. Worked solutions are never leaked before appropriate scaffolding levels.
- **State Machine First, LLM Second:** Tutoring flow is governed by deterministic finite-state logic. LLMs are confined to bounded prompt tasks with schema validation.
- **Deterministic Math Verification:** Mathematical expressions and equivalence are verified using **SymPy** rather than trusting generative models with arithmetic.
- **Teacher-in-the-Loop:** AI drafts diagnostic insights and intervention recommendations, but never automates high-stakes academic decisions.
- **Comprehensive Auditability:** Every dialogue turn records model parameters, prompt versions, SymPy verifier logs, and [Langfuse](https://langfuse.com/) trace IDs in an append-only audit trail.

---

## 🏗️ Architecture

```text
Browser (React 18 + TypeScript SPA on Vercel)
        ↓ HTTPS (same-origin /api/* rewrite)
FastAPI Backend (Python 3.12 / Vercel Functions)
  ├─ Auth & RBAC Middleware (JWT validation, cohort scoping)
  ├─ Append-Only Audit Logging
  ↓
Tutor State Machine & Orchestrator (Deterministic)
        ↓
Google ADK Runner ───────────────► Langfuse (Traces, Prompts, Evals)
  ├─ Problem Context Loader
  ├─ Deterministic Verifier (SymPy ratio/proportion engine)
  ├─ Student-State Agent
  ├─ Misconception Classifier ◄── pgvector Exemplar Retrieval
  ├─ Hint Policy Engine (Calibrated Levels 0–3)
  ├─ Socratic Dialogue Agent & Safety Guard
  └─ Learner Model Updater
        ↓
PostgreSQL + pgvector           Vercel Blob (Diagrams & Exports)
        ↑
Vercel Cron Jobs (Nightly rollups, quality scans, eval runs)
        ↓
Educator Dashboard & Session Replay (React)
```

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Tailwind CSS, Radix UI primitives, KaTeX for math typesetting |
| **Backend API** | Python 3.12, FastAPI | Pydantic v2 schemas, async endpoints, SSE streaming |
| **Agent Framework** | Google ADK (Python) | `SequentialAgent`, `LoopAgent`, bounded function tools |
| **LLM Provider** | Gemini (via Google ADK) | Google AI Studio or Vertex AI |
| **Math Verification** | SymPy | Deterministic symbolic verification engine (no LLM hallucination) |
| **Database** | PostgreSQL + pgvector | Managed Postgres (Neon / Vercel), SQLAlchemy 2, Alembic migrations |
| **Observability & Evals** | Langfuse | Prompt management, OpenTelemetry tracing, automated eval gates |
| **Object Storage** | Vercel Blob | Diagram SVGs, curriculum assets, exported summaries |
| **Hosting & CI/CD** | Vercel + GitHub Actions | Monorepo deployment (web & api), automated lint/test/eval CI |

---

## 📁 Repository Structure

```text
ai-math-tutor/
├─ apps/
│  ├─ web/                         # React + TypeScript frontend (Vite SPA)
│  │  ├─ src/
│  │  │  ├─ features/student/      # Practice workspace, Socratic chat, progress
│  │  │  ├─ features/educator/     # Cohort dashboards, session replay, review queue
│  │  │  ├─ features/admin/        # Audit viewer, content management
│  │  │  └─ lib/                   # API client, auth, KaTeX components
│  │  └─ vercel.json
│  └─ api/                         # FastAPI + Google ADK backend
│     ├─ api/index.py              # Vercel serverless entrypoint
│     ├─ app/
│     │  ├─ core/                  # Security, RBAC, config, audit logger
│     │  ├─ routers/               # Practice sessions, questions, educator, jobs
│     │  ├─ agents/                # Google ADK agent pipelines and schemas
│     │  ├─ verifier/              # SymPy deterministic validation rules
│     │  ├─ policy/                # Hint policy engine and safety guardrails
│     │  ├─ learner_model/         # Rule-based mastery & dependency tracking
│     │  ├─ db/                    # SQLAlchemy models, Alembic migrations, pgvector
│     │  └─ jobs/                  # Vercel Cron scheduled handlers
│     ├─ tests/                    # Unit, verifier, authz, leakage, and eval tests
│     └─ pyproject.toml
├─ content/
│  ├─ questions/                   # Curriculum seed questions (reviewed JSON)
│  ├─ misconceptions/              # Taxonomy and exemplar embeddings
│  └─ eval/                        # Benchmark datasets for quality evaluation
├─ docs/
│  ├─ PRD.md                       # Master Product Requirements Document
│  ├─ adr/                         # Architecture Decision Records
│  └─ runbook.md                   # Operational guidelines & deployment
├─ .agents/                        # Agent workflows and project skills
├─ .github/workflows/              # GitHub Actions CI/CD workflows
├─ AGENTS.md                       # Operational rules, non-negotiables & agent contracts
├─ PRD.md                          # Master Product Requirements Document
└─ README.md                       # High-level architecture & getting started
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher (`pnpm` or `npm`)
- **Python**: `3.12`
- **PostgreSQL**: `16+` with `pgvector` extension enabled
- **Google AI Studio Key**: Gemini API access for Google ADK
- **Langfuse**: Account or self-hosted instance for traces and prompt management

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/muthukumars/ai-math-tutor.git
   cd ai-math-tutor
   ```

2. **Backend Setup (`apps/api`):**
   ```bash
   cd apps/api
   python3.12 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   
   # Copy environment configuration
   cp .env.example .env
   # Run database migrations
   alembic upgrade head
   
   # Start FastAPI local server
   uvicorn app.main:app --reload --port 8000
   ```

3. **Frontend Setup (`apps/web`):**
   ```bash
   cd ../../apps/web
   npm install
   cp .env.example .env.local
   npm run dev
   ```

---

## 🗺️ Delivery Roadmap

- [ ] **Phase 1: Project Bootstrap & Foundation**
  - Monorepo structure, linting, pre-commit hooks, CI workflow
  - Postgres + pgvector configuration, base Alembic migrations
  - Langfuse connection and Google ADK tracer bootstrap
- [ ] **Phase 2: Tutor Foundation**
  - Seed question bank schema & validated ratio items
  - SymPy verification engine & test suite
  - Practice interface & state machine session manager
- [ ] **Phase 3: Socratic Intelligence**
  - Google ADK multi-agent pipeline (`SequentialAgent` + `LoopAgent`)
  - Misconception classification & pgvector exemplar matching
  - Dynamic hint policy & answer-leakage guards
- [ ] **Phase 4: Teacher Operations**
  - Longitudinal learner model rollups
  - Teacher cohort dashboard, student session replay, and intervention draft summaries
- [ ] **Phase 5: Governance and Reliability**
  - E2E automated evaluation harness & red-teaming checks
  - Role-based authorization tests, audit-event viewer
- [ ] **Phase 6: Capstone Presentation & Showcase**
  - Final documentation, architecture diagram, threat model
  - Demonstration scenario and demo video
  - GitHub README and setup documentation

---

## 🤝 Development Standards & Workflow

### Issue Taxonomy and Tracking

Deliverables and stories are managed strictly in accordance with PRD Section 6 using the `.agents/skills/github-issues` standard. We use specific prefixes and labels to categorize work:

**Issue Prefixes:**
- **`[STU-xx]` (Student Stories):** Features built for the learner (e.g., practice interface, Socratic chat).
- **`[EDU-xx]` (Educator Stories):** Features built for teachers/tutors (e.g., dashboards, session replay).
- **`[ADM-xx]` (Administrator Stories):** Features built for platform admins (e.g., RBAC, audit trails).
- **`[TECH-xx]` (Technical Tasks):** Foundational infrastructure and backend work (e.g., CI/CD, database setup).

**Epic Labels:**
- **`epic:E1` (Guided practice and Socratic tutoring):** Core AI tutoring features, hints, and math verification.
- **`epic:E2` (Learner progress and educator insight):** Dashboards, progress tracking, and cohort overviews.
- **`epic:E3` (Review, replay, and human oversight):** Manual intervention, session replay, and content review.
- **`epic:E4` (Governance, security, and platform operations):** Administrative controls, RBAC, and audit logs.
- **`epic:tech`:** Supplementary label for technical infrastructure spanning multiple domains.

**Milestones:**
Milestones map to the chronologically sequential **Phases (Phase 1 through Phase 6)** of the Delivery Roadmap. While Epics group work by product area, Milestones group work by *when* it is executed.

### Additional Standards
- **Commit Cadence:** Granular, task-based commits adhering to `.agents/skills/task-commits`.
- **Quality Gates:** Zero unapproved questions in student pools; deterministic tests must pass for all SymPy verifiers before merging.

---

## 📄 License & References

- Master Documentation: [PRD.md](PRD.md)
- Operational Contract & Non-Negotiables: [AGENTS.md](AGENTS.md)
- Designed and developed as a Forward Deployed Engineer capstone project.
