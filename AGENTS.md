# AGENTS.md: Non-Negotiables for SolvePath

You are working on **SolvePath — Multi-Agent Socratic Mathematics Tutor**.
This file is the operational contract you must satisfy. Do not relax, reinterpret, or "improve" these requirements without explicit user direction. Conform to them.

Your reading order:
1. **`AGENTS.md`** (this file) is your operational constitution and hard invariant baseline.
2. **`PRD.md`** is the master specification (24 sections) covering curriculum, schemas, multi-agent pipelines, safety, and evaluation.
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
| **Identity** | **Clerk** | FastAPI checks the JWT. Roles and grants are read from Postgres. |
| **Agent Framework** | **Google ADK (Python)** | Use `SequentialAgent`, `LoopAgent`, `LlmAgent`, and custom `BaseAgent`. SymPy and retrieval are MCP tools. The Safety Guard is an A2A service. Do not add a second agent framework. |
| **LLM Provider** | **Provider adapter** via Google ADK | Gemini is the default (AI Studio or Vertex). The same schemas must also run on OpenRouter or an OpenAI-compatible vLLM endpoint. Agents do not import a vendor SDK directly. |
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
  1. `ProblemContextAgent` (`BaseAgent`, deterministic): loads question stem, steps, accepted answer spec, predicted misconceptions into session state, executes the deterministic **Input PII Scrubber** on student text, and runs the deterministic **Input Screen** (see 3.6), whose hit short-circuits the turn to an authored canned reply.
  2. `MathVerifierAgent` (`BaseAgent`, deterministic): calls the SymPy **MCP** tool (`verify_expression`) and writes pure `verifier_result`. The expression cache stores only pure mathematical evaluation. The response-target overlay (a comparison with the active `scaffold_probes` expected value) is applied by this agent after the cache and is never cached; session-dependent progress (`advancing` vs `stalled`) is computed in the policy engine. A verifier failure is `cannot_verify` or a tool error, never a model verdict.
  3. `DeterministicMisconceptionMatcher` (`BaseAgent`, deterministic, < 10 ms): if the post-overlay status is `incorrect` and the input is a value or ratio, compares `canonical_value` with the pre-calculated `misconception_predictions` in the question JSON. If matched, sets taxonomy code deterministically with provisional confidence `0.90` (an authored prior, not a measured value), bypassing both exemplar retrieval and the LLM classifier.
  4. `RetrievalGate` (`BaseAgent`, deterministic): calls exemplar search only when the post-overlay status is `incorrect` or `cannot_verify` (`state=ok`) AND no deterministic misconception was matched, and `state` is not `tool_failure`. A `correct` or `partially_correct` result, `state=tool_failure`, or deterministic match skips retrieval and the classifier. `cannot_verify` with no matched step yields `insufficient_evidence`.
  5. `StudentStateEstimator` (`BaseAgent`, deterministic, every turn) writes attempt-history features only (`repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`). Then `MisconceptionClassifierAgent` (`LlmAgent`, schema-validated): skipped if a deterministic match was found; otherwise, if the retrieval gate opened, it classifies errors against the approved taxonomy enum, citing exemplar ids. There is no LLM student-state agent and `ParallelAgent` is unused in Release 1.0.
  6. `HintPolicyEngine` (`BaseAgent`, deterministic): calculates permitted hint level (0–5). Evaluates session progress: advancing partial progress (`partially_correct` with `progress=advancing`, computed here from a new `matched_solution_step`) does **not** raise the hint level; only `incorrect` or stalled work escalates. Explicit help-seeking (`"I am not sure"`) provides scaffolding but does **not** count toward the 3-attempt minimum for Level 5. Emits `permitted_scaffold_step` for Level 4 and `permitted_solution` for Level 5 from structured `solution_steps`. If Level 5 is withheld (`allow_level_5=false`), emits an isomorphic worked example or Level 4 retry rather than a dead-end.
  7. `LoopAgent` (max 2 iterations):
     - `SocraticDialogueAgent` (`LlmAgent`, schema-validated): generates a single focused prompt inside the hint constraints.
     - Deterministic Leakage Check (`BaseAgent` callback, < 10 ms): runs **FIRST** inside the loop using the shared canonical normaliser. Blocks candidate and triggers loop retry immediately if unpermitted solution terms are present. Problem stem givens and permitted intermediate steps are exempt.
     - `SafetyGuard` (**A2A** service): runs only after deterministic check passes; evaluates tone, injection resistance, and semantic safety. Blocks or requests revision.
  8. Deterministic fallback prompt executes if the loop exhausts without an approved turn, or if the Safety Guard cannot be reached.
- **Post-Solution Reflection State (`state=reflection`):** When the primary problem is solved, the item's authored `reflection` prompt is shown with no model, verifier or retrieval gate, preventing false `cannot_verify` flags or spurious ambiguity alerts.
- **ADK Tool Rule:** ADK `LlmAgent`s that use `output_schema` cannot call tools directly. Deterministic tools (SymPy, vector search) run in preceding `BaseAgent` steps via MCP and write results to session state.
- **Distributed Trace Propagation:** All HTTP calls to the MCP server and A2A Safety Guard must propagate W3C Trace Context headers (`traceparent` and `tracestate`) so child spans attach to the parent Langfuse turn trace.

### 3.2 Deterministic Mathematics Verification (SymPy)
- Every student response containing a numerical, fractional, algebraic, or ratio value **must** be verified by the SymPy engine before conversational feedback is generated.
- Checks include: ratio equivalence, fractional simplification, proportional scaling, unit conversion, and tolerance bounds.
- Shared Canonical Normaliser (`normaliser.py`): must be used by both student input parsing, diagram specification validation, and the leakage guard to normalize word numerals, units, and ratio forms uniformly.
- If SymPy cannot deterministically verify an expression:
  - Return `cannot_verify` with structured fallback.
  - **Never** falsely tell the student they are wrong.
  - Escalate ambiguous responses for educator review.
- **Fail Loud:** Never catch an arithmetic or verifier exception to silently return a fabricated "correct" or "incorrect" verdict.

### 3.3 Zero Answer Leakage & Strict Socratic Dialogue
- The tutor’s primary role is to prompt thinking, not supply answers.
- **Hint Ladder (Levels 0–5):**
  - **Level 0**: Independent attempt prompt.
  - **Level 1**: Attention orientation (highlight relevant quantities or labels from problem stem).
  - **Level 2**: Conceptual scaffold (ask a targeted question about the core relationship. It may ask which relationship or operation applies, or use a small unit case such as "how far is 2 cm?", but must not name the operation or the final calculation).
  - **Level 3**: Representation support (bar model, ratio table, diagram).
  - **Level 4**: Partial worked step (single verified intermediate step emitted by `HintPolicyEngine`; intermediate step is allowed in leakage filter).
  - **Level 5**: Full worked solution (only allowed when policy thresholds are satisfied: hint level 4, 3+ counted attempts, the student presses the "Show me the solution" control, and coordinator `allow_level_5=true`). Demo configuration sets `allow_level_5=true`.
- **Hard Leakage Guard:** Runs cheap deterministic checks first inside the loop, before the model check. Problem stem givens (e.g., "1 cm = 4 km") and student's already-verified quantities are strictly exempt across all hint levels.
- **Diagram Leakage Guard:** Below Level 5, all SVG diagram specifications and text labels must pass the exact same canonical normaliser check against the solution set. Unknown bars/quantities must be masked (e.g. `?` or `x`).
- **Method Leakage Guard:** Below Level 4 the deterministic leakage check also uses the item's `method_leak_patterns` to block candidates that name the operation or solution step.
- **Turn Constraint:** Exactly **one** focused question or prompt per turn. Never output multi-paragraph lectures during active student problem-solving.

### 3.4 Misconception Classification
- Misconception labels must strictly belong to the approved taxonomy enum (for example `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `scale_direction_error`, and `insufficient_evidence`).
- `insufficient_evidence` is the only sanctioned value that means "do not claim a misconception". Agents must not invent another code for that case.
- Agents must **never** hallucinate or invent new misconception codes outside the Pydantic schema enum.
- Exemplars are retrieved via `pgvector` cosine similarity over reviewed seed embeddings, and only after the retrieval gate opens. Next practice and transfer legality come from the Postgres skill graph, not from vector similarity alone.
- **Probe verification:** Level 1–3 questions come from the item's authored `scaffold_probes`. The dialogue agent only paraphrases the selected probe, and the `MathVerifierAgent`'s response-target overlay compares the student's probe reply with that probe after the pure verifier result. An off-path but correct probe answer never raises the hint level.
- Calibration covers all 12 taxonomy labels across 4 core error clusters. Content authoring enforces zero collision in `misconception_predictions`.

### 3.5 Session State Machine
- The transition table in PRD section 8.5.1 is the contract. The runtime loads `apps/api/app/fsm/transitions.yaml`, and a test fails if it differs from that table (TECH-52). Any (state, event) pair the table does not list is rejected and audited. Do not add a state or a transition in code without changing that table first.

### 3.6 Student Input Channel
- The tutor is a structured-input tutor. The student uses the answer field and keypad, step fields, reasoning options, "I am not sure where to start", "Show me the solution", and a free-text **note for the teacher** (PRD section 8.3.1).
- Free text is never sent to any LLM prompt or Langfuse span. A prompt-capture guard fails the turn if it ever is.
- The deterministic **Input Screen** handles answer requests, abuse, assessment help, impersonation, worrying disclosure and injection phrases with authored canned replies. A hit changes no hint level and no counter.
- The "Show me the solution" control is the only Level 5 request. Typed text is never parsed as one.
- A value in the answer field that equals an intermediate step is `incorrect` (`incomplete`). Only step fields and probe answers can be `partially_correct`.
- Probe selection (Levels 1–3): the first authored probe not yet asked with `min_level` at most the current level. If none remains the turn is the canned `fallback_l{level}` with no model call.
- `/` is a fraction in the answer field and division in step and probe fields. `÷` and `×` are always operators.
- Numbers use dot decimals. A comma is a thousands separator only in the `30,000` pattern. Any other comma is `cannot_verify`.
- Content validation V1–V9 (PRD section 10.3.1) must pass before an item is approved.
- The verifier result is the pure `PureVerifierResult` of PRD FR-04. An arithmetic expression is judged by form against a step's `target_expression` and is never evaluated into a final answer (`7.5 × 4` is `partially_correct`, not `correct`). The session-dependent response-target overlay is applied by `MathVerifierAgent` after the cache and is never cached.
- `not_sure` and `show_solution` events carry no answer, so pipeline steps 2 to 5 do not run for them. "I am not sure" raises the level by one, never above 4. Level 5 comes only from "Show me the solution".
- The Level 5 solution and the withheld-Level-5 example are rendered from authored data by a deterministic template. The Dialogue Agent is not invoked for them.
- Every fixed student-facing sentence lives in `content/safety/canned_responses.json` (28 keys, PRD 8.3.2). An entry is `draft` until an educator reviews it, and the Gate B tag requires every key to be `reviewed`. Code does not invent student wording.
- `partially_correct` never opens retrieval or the classifier.
- `reflection` and `transfer_offered` are authored text. No model, Safety Guard or `hint_decision` runs there.
- The client–server contract is PRD section 15.9 (routes, shapes, `Idempotency-Key`, one error payload). A rejected transition is HTTP 409 `transition_not_allowed`.
- PRD section 11.6 is the failure contract: no dependency failure produces a verdict, a leak or unguarded model text, Langfuse never fails a turn, and authentication fails closed.

### 3.7 Observability, Auditability & Privacy
- **Append-Only Audit Trail:** Every turn logs model parameters, prompt version, hint level, verifier outcome, and Langfuse trace ID to the database.
- **Privacy & PII:**
  - Student IDs in Langfuse traces must be pseudonymous UUIDs.
  - Deterministic **Input PII Scrubber** scrubs names, emails, phone numbers, and addresses from student free-text at ingress. In Release 1.0, free text is stored for the teacher only and is **never** sent to an LLM prompt or a Langfuse span; only structured reasoning options and numeric steps reach models.
  - Never transmit student names, emails, or personal identification into telemetry spans or external prompts.
  - Synthetic data only for public demonstrations and test environments.

---

## 4. Engineering & Workflow Standards

### 4.1 Development & Commit Discipline
- **Task Commits**: Follow the rule defined in `.agents/skills/task-commits`. Commit each finished, verified task as its own atomic changeset. Never bundle entire multi-feature milestones into a single commit.
- **Issue Tracking**: Reference PRD Section 6 user story IDs (`[STU-xx]`, `[EDU-xx]`, `[TECH-xx]`) in issue titles, pull requests, and commit descriptions (see `.agents/skills/github-issues`).
- **Tests Before Merge**:
  - All SymPy verifier tests must pass deterministically.
  - Answer-leakage red-team tests must achieve 100% block rate against extraction attacks on the critical set.
  - All Pydantic agent schemas must validate with zero schema drift.
  - Pull-request CI runs the LLM stages in replay mode (recorded fixtures); the live provider runs nightly and before a release (PRD 14.6).
  - Multi-turn trajectory tests: The Section 19 golden scenario and simulated student trajectories (repeated pleading, advancing intermediate progress, persistent error) must pass with zero answer leaks and no premature hint escalation.
  - Question content validation: Seed questions must pass offline checks ensuring no collision in `misconception_predictions` (no identical wrong number mapped to conflicting taxonomy codes).

### 4.2 Security & Secrets
- Never commit `.env` files, API keys, or database connection strings.
- `solvepath-mcp` and `solvepath-safety` are never public: every call from the orchestrator carries a short-lived signed token (an HMAC secret held per target service, `INTERNAL_SERVICE_TOKEN_MCP` or `INTERNAL_SERVICE_TOKEN_SAFETY`, so one compromised service cannot mint a token for the other) with an audience check, and an unauthenticated call returns 401.
- Postgres row-level security (Tier 3) sets identity per transaction with `SET LOCAL`, never a session-level `SET`, because the connection is pooled.
- Clerk ids map to `app_user` rows (PRD 8.1). A valid token for an unknown subject gets 403 and creates nothing. Users are created only by `scripts/seed_synthetic.py` and the ADM-13 route. The first administrator comes from `BOOTSTRAP_ADMIN_CLERK_ID`, read by the seed script only.
- Read secrets server-side exclusively via environment variables (`APP_ENV`, `DATABASE_URL`, `GOOGLE_API_KEY`, `LANGFUSE_SECRET_KEY`; full list in PRD section 16.2).
