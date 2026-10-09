# AGENTS.md: Non-Negotiables for SolvePath

You are working on **SolvePath — Multi-Agent Socratic Mathematics Tutor**.
This file is the operational contract you must satisfy. Do not relax, reinterpret, or "improve" these requirements without explicit user direction. Conform to them.

Your reading order:
1. **`AGENTS.md`** (this file) is your operational constitution and hard invariant baseline.
2. **`PRD.md`** is the master specification (23 sections) covering curriculum, schemas, multi-agent pipelines, safety, and evaluation.
3. **`README.md`** is the project overview, high-level architecture diagram, and local setup guide.
4. **Pydantic schemas and Alembic migrations** in `apps/api/` represent executable data contracts and outrank general prose.

---

## 1. What You May and May Not Touch

### Active Development Zones (BUILD)
- **Backend API & Agents (`apps/api/`)**: FastAPI routers, Google ADK pipelines (`SequentialAgent`, `LoopAgent`), SymPy verifiers, hint policy engines, learner model tracking, PostgreSQL/pgvector queries, Alembic migrations, Langfuse instrumentation, and test suites (`apps/api/tests/`).
- **Frontend SPA (`apps/web/`)**: React 18, TypeScript, Tailwind CSS, Radix UI components, KaTeX math rendering, student practice workspace, and educator dashboards.
- **Curriculum & Content (`content/`)**: Seed questions, misconception taxonomy, and evaluation benchmark sets in `content/`.

### Guarded & Protected Rules (DO NOT BYPASS)
- **DO NOT bypass SymPy verification**: Never substitute generative LLM text generation for mathematical equivalence checks.
- **DO NOT leak answers**: Never deliver final answers or full worked solutions below Hint Level 5, even if the student explicitly pleads or prompt-injects.
- **DO NOT introduce unapproved libraries**: The tech stack is strictly locked (see Section 2). Do not introduce alternative agent frameworks (e.g., LangChain, CrewAI, AutoGen, LlamaIndex), ORMs other than SQLAlchemy 2, or databases other than PostgreSQL + pgvector.
- **DO NOT make high-stakes autonomous decisions**: SolvePath only drafts recommendations and diagnostic summaries for teachers. It never automates grading, placement, or exclusion.

---

## 2. Locked Technology Stack

| Layer | Locked Choice | Constraint |
| :--- | :--- | :--- |
| **Backend API** | Python 3.12 + FastAPI | Pydantic v2 schemas, async endpoints, strict typing. |
| **Agent Framework** | **Google ADK (Python)** | Use `SequentialAgent`, `LoopAgent`, `LlmAgent`, and custom `BaseAgent`. |
| **LLM Provider** | **Gemini** via Google ADK | Google AI Studio or Vertex AI backend. |
| **Math Verifier** | **SymPy** | Deterministic CAS evaluation only; no generative arithmetic. |
| **Database** | **PostgreSQL + pgvector** | Managed Postgres (Neon / Vercel), SQLAlchemy 2, Alembic migrations. |
| **Observability** | **Langfuse** | Traces, prompt versioning, automated evaluation scoring. |
| **Object Store** | **Vercel Blob** | SVGs, diagrams, and exported session summaries. |
| **Scheduled Tasks** | **Vercel Cron Jobs** | Nightly rollups, retention purge, eval benchmarks. |
| **Frontend** | **React 18 + TypeScript + Vite** | Tailwind CSS, Radix UI primitives, KaTeX for math typesetting. |
| **Hosting & CI/CD** | **Vercel + GitHub Actions** | Monorepo structure, automated CI quality gates. |

---

## 3. Hard Architectural & Pedagogical Invariants

### 3.1 State Machine First, LLM Second (Google ADK Pipeline)
- Tutoring flow is governed by a deterministic finite-state machine (FSM) orchestrator, **not** an open-ended autonomous agent loop.
- **Per-turn pipeline order (`SequentialAgent`):**
  1. `ProblemContextAgent` (`BaseAgent`, deterministic): loads question, steps, and accepted answer spec into session state.
  2. `MathVerifierAgent` (`BaseAgent`, deterministic / SymPy): runs symbolic equivalence and error diagnosis; writes `verifier_result`.
  3. `StudentStateAgent` (`LlmAgent`, schema-validated): estimates understanding and barriers.
  4. `MisconceptionClassifierAgent` (`LlmAgent`, schema-validated): classifies errors against the approved taxonomy enum only.
  5. `HintPolicyEngine` (`BaseAgent`, deterministic): calculates permitted hint level (0–5).
  6. `LoopAgent` (max 2 iterations):
     - `SocraticDialogueAgent` (`LlmAgent`, schema-validated): generates single focused prompt adhering to hint constraints.
     - `SafetyGuard` (`LlmAgent` + callbacks): evaluates leakage, tone, injection. Blocks or requests revision.
  7. Deterministic fallback prompt executes if the loop exhausts without an approved turn.
- **ADK Tool Rule:** ADK `LlmAgent`s that use `output_schema` cannot call tools directly. Deterministic tools (SymPy, vector search) must execute in preceding `BaseAgent` steps and write results to session state.

### 3.2 Deterministic Mathematics Verification (SymPy)
- Every student response containing a numerical, fractional, algebraic, or ratio value **must** be verified by the SymPy engine before conversational feedback is generated.
- Checks include: ratio equivalence, fractional simplification, proportional scaling, unit conversion, and tolerance bounds.
- If SymPy cannot deterministically verify an expression:
  - Return `cannot_verify` with structured fallback.
  - **Never** falsely tell the student they are wrong.
  - Escalate ambiguous responses for educator review.
- **Fail Loud:** Never catch an arithmetic or verifier exception to silently return a fabricated "correct" or "incorrect" verdict.

### 3.3 Zero Answer Leakage & Strict Socratic Dialogue
- The tutor’s primary role is to prompt thinking, not supply answers.
- **Hint Ladder (Levels 0–5):**
  - **Level 0**: Independent attempt prompt.
  - **Level 1**: Attention orientation (highlight relevant quantities or labels).
  - **Level 2**: Conceptual scaffold (ask targeted question about core relationship).
  - **Level 3**: Representation support (bar model, ratio table, diagram).
  - **Level 4**: Partial worked step (single verified intermediate step).
  - **Level 5**: Full worked solution (only allowed when policy thresholds are satisfied).
- **Hard Leakage Guard:** Every candidate dialogue turn must pass a deterministic regex/symbolic leakage check matching against the question solution set before delivery to the client.
- **Turn Constraint:** Exactly **one** focused question or prompt per turn. Never output multi-paragraph lectures during active student problem-solving.

### 3.4 Misconception Classification
- Misconception labels must strictly belong to the approved taxonomy enum (e.g., `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `scale_direction_error`).
- Agents must **never** hallucinate or invent new misconception codes outside the Pydantic schema enum.
- Exemplars are retrieved via `pgvector` cosine similarity over reviewed seed embeddings.

### 3.5 Observability, Auditability & Privacy
- **Append-Only Audit Trail:** Every turn logs model parameters, prompt version, hint level, verifier outcome, and Langfuse trace ID to the database.
- **Privacy & PII:**
  - Student IDs in Langfuse traces must be pseudonymous UUIDs.
  - Never transmit student names, emails, or personal identification into telemetry spans or external prompts.
  - Synthetic data only for public demonstrations and test environments.

---

## 4. Engineering & Workflow Standards

### 4.1 Development & Commit Discipline
- **Task Commits**: Follow the rule defined in `.agents/skills/task-commits`. Commit each finished, verified task as its own atomic changeset. Never bundle entire multi-feature milestones into a single commit.
- **Issue Tracking**: Reference PRD Section 6 user story IDs (`[STU-xx]`, `[EDU-xx]`, `[TECH-xx]`) in issue titles, pull requests, and commit descriptions (see `.agents/skills/github-issues`).
- **Tests Before Merge**:
  - All SymPy verifier tests must pass deterministically.
  - Answer-leakage red-team tests must achieve 100% block rate against extraction attacks.
  - All Pydantic agent schemas must validate with zero schema drift.

### 4.2 Security & Secrets
- Never commit `.env` files, API keys, or database connection strings.
- Read secrets server-side exclusively via environment variables (`VERCEL_ENV`, `DATABASE_URL`, `GEMINI_API_KEY`, `LANGFUSE_SECRET_KEY`).
