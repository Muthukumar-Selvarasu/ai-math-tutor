# TECHNICAL: the build guide

> Open this while you build. The product specifications and requirements are in [`PRD.md`](PRD.md); the execution phases and build tasks are in [`PLAN.md`](PLAN.md); the operational invariants and non-negotiables are in [`AGENTS.md`](AGENTS.md).
>
> **No number here is authoritative.** Authoritative thresholds and quality gates live in [`PRD.md` Section 14.5](PRD.md#145-declared-quality-thresholds) and [`PLAN.md` Section 2](PLAN.md#2-what-done-means). Ports, tokens, and version numbers below are development defaults, not unchangeable gates.

---

## 1. How this capstone works

You are building **SolvePath — Multi-Agent Socratic Mathematics Tutor**. You will almost certainly build this with a coding agent. That is fine, but as in any advanced engineering sprint: *"I told the agent to do everything and I don't know what's happening"* is the trap. In SolvePath, every turn is governed by a **deterministic finite-state machine (FSM) first and an LLM second**.

To maintain total architectural control, the build is split into **ten clear engineering stages**. Every stage follows the same four-part rhythm:

| Part | Who | What |
|---|---|---|
| **You decide** | you | An architectural or pedagogical decision with trade-offs. Answer it in `BUILD_LOG.md` **before** you prompt the agent. The agent is strictly commanded in [`AGENTS.md`](AGENTS.md) to ask you, not to invent answers. |
| **Build** | you and your agent | What code, migrations, schemas, or tools the stage adds, and the PRD / TECH user story IDs it satisfies. |
| **Prove it** | you | A concrete command you run and output you verify yourself, or a trace in Langfuse. Write down what you *expect* first, then run it. |
| **Log it** | you | Three lines in `BUILD_LOG.md`: your prediction, what actually happened, and the trace ID or test output that confirms it. |

Copy [`BUILD_LOG.template.md`](BUILD_LOG.template.md) to `BUILD_LOG.md` (or initialize it) and maintain your architectural decisions in `docs/adr/`. Both are graded evidence of disciplined engineering.

**The answer to "how do I know what's happening" is observability.** From Stage 5 onward, every student attempt triggers a trace showing the exact span tree: problem loading, SymPy verification, misconception diagnosis, hint policy calculation, dialogue generation, and safety guard clearance. Read the Langfuse trace, not just the chat text. If you can't explain a span, you don't understand your system yet.

---

## 2. Architecture

```text
                                  YOU BUILD ALL OF THIS
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │  PostgreSQL 16 + pgvector :5432 (domain, questions, exemplars, skill graph, cache)    │
 │                     ▲                                                                  │
 │                     │ MCP (:5001)                                                      │
 │  Web UI ─┐   ┌──────┴─── apps/api/app/orchestrator.py ──────────────────────────────┐  │
 │  :3000   ├──▶│ 1. ProblemContextAgent (PII Scrubber + Input Screen canned reply)    │  │
 │  (React) │   │ 2. MathVerifierAgent ──MCP──▶ SymPy Server :5001 (verify_expression) │  │
 │  CLI ────┘   │ 3. DeterministicMisconceptionMatcher (<10 ms, confidence 0.90)       │  │
 │  :8000       │ 4. RetrievalGate ──MCP──▶ pgvector Exemplar Search (if incorrect)    │  │
 │              │ 5. StudentStateEstimator + MisconceptionClassifierAgent (LlmAgent)   │  │
 │              │ 6. HintPolicyEngine (deterministic levels 0–5; scaffold probes)      │  │
 │              │ 7. LoopAgent (max 2 iterations):                                     │  │
 │              │    ├─ SocraticDialogueAgent (Gemini Flash adapter, <100 tokens)      │  │
 │              │    ├─ Cheap Leakage Check (token-bounded value & method regex)       │  │
 │              │    └─ SafetyGuard ──A2A──▶ solvepath-safety :5002                    │  │
 │              │ 8. Deterministic Fallback Prompt (if loop exhausted / guard down)    │  │
 │              │ 9. Post-Solution Reflection State (authored choices, no model)       │  │
 │              └────── every step is a span in one Langfuse trace ──▶ Langfuse ───────┘  │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

Why the SymPy verifier and retrieval are MCP tools while the Safety Guard is an A2A service, why free text never reaches an LLM prompt, and why the state machine outranks generative loops: [`AGENTS.md` Section 3](AGENTS.md#3-hard-architectural--pedagogical-invariants) and [`PRD.md` Section 9](PRD.md#9-multi-agent-design-google-adk).

---

## 3. Before you start

| You need | Why |
|---|---|
| **Python 3.12** (venv or conda) | Google ADK, SymPy, FastAPI, and Pydantic v2 |
| **Node.js 20+ & npm** | React 18, Vite, Tailwind CSS, KaTeX |
| **PostgreSQL 16+ with pgvector** | Neon serverless Postgres or local Docker container |
| **Google AI Studio API Key (`GOOGLE_API_KEY`)** | Gemini 2.5 Flash for the Socratic Dialogue and Misconception agents |
| **Clerk Account & Keys** | JWT identity, subject verification, role and cohort resolution |
| **Langfuse Account & Keys** | OpenTelemetry/OpenInference turn tracing, prompt management, eval scoring |
| **Internal HMAC Secrets** | `INTERNAL_SERVICE_TOKEN_MCP` and `INTERNAL_SERVICE_TOKEN_SAFETY` |

Put all secrets in `apps/api/.env` and `apps/web/.env.local`. Ensure `.env`, `runs/`, `reports/`, and `__pycache__/` are in `.gitignore` **before your first commit**. Leaking an API key in the repo is an automatic security failure.

Key dependencies you will install across stages:
- **API & Agents**: `fastapi`, `uvicorn`, `pydantic>=2.0`, `sympy`, `google-adk`, `httpx`, `sqlalchemy>=2.0`, `alembic`, `psycopg2-binary` or `asyncpg`, `pgvector`, `langfuse`, `opentelemetry-sdk`, `opentelemetry-exporter-otlp`.
- **Web**: `react`, `react-dom`, `vite`, `tailwindcss`, `katex`, `@radix-ui/react-*`, `@clerk/clerk-react`.
- **Testing & Security**: `pytest`, `pytest-asyncio`, `pip-audit`, `gitleaks`.

---

## 4. The ten stages

### Stage 1: The database, schemas, and seed state

**You decide.** How does an evaluation run start from a known deterministic state? An Alembic migration reset script, a dedicated test tenant, or a rollback transaction? How are questions and synthetic users populated without duplicate keys?

**Build.**
1. Neon PostgreSQL with `pgvector` extension enabled.
2. Alembic migration (`alembic/versions/001_initial_schema.py`) defining:
   - `app_user` (unique `clerk_user_id`, role enum: `student`, `teacher`, `admin`), `cohort`, `cohort_membership`.
   - `question` and `question_version` with `misconception_predictions`, `solution_steps`, `scaffold_probes`, `accepted_answer_spec`, and `method_leak_patterns`.
   - `session`, `attempt`, `tutor_turn`, `student_note`, `idempotency_key`.
   - `audit_event` (append-only table; PostgreSQL trigger or rule blocking `UPDATE` and `DELETE`).
   - `expression_cache` and `job_run`.
3. `scripts/seed_synthetic.py` creating the bootstrap administrator, test cohorts, and loading the 10 approved core ratio seed items from `content/questions/` ([`TECH-02`], [`TECH-07`], [`ADM-06`]).

**Prove it.**
```bash
alembic upgrade head
python scripts/seed_synthetic.py
psql $DATABASE_URL -c "SELECT count(*) FROM question;"               # expect >= 10
psql $DATABASE_URL -c "SELECT count(*) FROM app_user;"               # expect seed users
psql $DATABASE_URL -c "DELETE FROM audit_event;"                     # expect permission / trigger violation
```

**Log it.** Which migration strategy did you choose, and what prevents duplicate seed records if `seed_synthetic.py` runs twice?

---

### Stage 2: Deterministic normaliser & SymPy verification (MCP)

**You decide.** Where does mathematical equivalence live? Does the model evaluate whether `7.5 × 4 = 30`, or does SymPy? When a student types `7,5` vs `30,000`, what rule determines whether the comma is a decimal separator or a thousands separator?

**Build.**
1. Shared Canonical Normaliser (`apps/api/app/verifier/normaliser.py`):
   - Australian decimal dot rule: dot is decimal; comma is thousands separator *only* in the exact pattern `30,000`. Any other comma (`7,5`) fails parsing and yields `cannot_verify` with canned guidance `use_dot_for_decimals`.
   - Word numeral conversion (`four` → `4`), unit parsing (`km`, `cm`, `g`, `hours`), ratio normalization (`1:4`, `1 to 4`).
2. SymPy CAS Verification Engine (`apps/api/app/verifier/service.py`):
   - Computes `PureVerifierResult` (`correct`, `incorrect`, `partially_correct`, `cannot_verify`) without session state.
   - Symbolic ratio equivalence, fractions, unit-scaling checks, and tolerance bounds. Form checking: `7.5 × 4` in a step field is `partially_correct`, never evaluated to `30`.
3. Standalone MCP Tool Server (`apps/api/mcp_server.py`, default port `5001`):
   - Exposes `verify_expression(student_input, target_spec, step_id)`.
   - Enforces HMAC token authentication via `INTERNAL_SERVICE_TOKEN_MCP` with audience check ([`TECH-05`], [`TECH-10`], [`TECH-50`]).
4. In-process direct fallback: if HTTP call to MCP times out (>400 ms) during cold start, invoke `app.verifier.service` directly in-process with span tag `protocol: in_process_fallback`.

**Prove it.**
```bash
# Direct normaliser & verifier unit tests
pytest apps/api/tests/verifier/ -v

# Start MCP server and verify over HTTP with HMAC token
curl -s -X POST http://localhost:5001/mcp/verify_expression \
  -H "Authorization: Bearer <signed-mcp-token>" \
  -H "Content-Type: application/json" \
  -d '{"student_input": "11.5 km", "canonical_value": "30 km", "unit": "km"}' # expect incorrect

# Unauthenticated call must fail loud
curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/mcp/verify_expression # expect 401
```

**Log it.** Paste the verifier JSON output. Confirm that `7,5` returns `cannot_verify` and that unauthenticated calls receive HTTP 401.

---

### Stage 3: The session state machine & Input Screen

**You decide.** What happens when a student enters `"Give me the answer"` or an abusive phrase? Does it go to an LLM prompt? No. What canned reply is returned, does it change the hint level, and does it count toward the 3-attempt Level 5 minimum?

**Build.**
1. Machine-readable finite-state machine loaded from `apps/api/app/fsm/transitions.yaml` matching [`PRD.md` Section 8.5.1](PRD.md#851-session-state-machine) table (rows 1–22) ([`TECH-52`]):
   - States: `awaiting_first_attempt`, `active`, `reflection`, `transfer_offered`, `transfer_active`, `completed`, `declined`, `stuck`, `abandoned`.
   - Unlisted `(state, event)` pairs return HTTP 409 `transition_not_allowed` and log an audit row.
2. Deterministic Input PII Scrubber (<5 ms): strips emails, phone numbers, and names from free text at API ingress.
3. Deterministic Input Screen (<10 ms, part of `ProblemContextAgent`):
   - Scans against `content/safety/input_lexicon.json` (`answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase`).
   - On a hit, short-circuits the turn: verifier and model are never called, hint level is unchanged, attempt count does not increment. Emits canned reply from `content/safety/canned_responses.json` ([`TECH-42`]).
   - Free text in `note` is stored for the teacher only and **never** reaches an LLM prompt or Langfuse span ([`AGENTS.md` Section 3.6](AGENTS.md#36-student-input-channel)).

**Prove it.**
```bash
pytest apps/api/tests/fsm/test_table.py -v
pytest apps/api/tests/safety/test_input_screen.py -v
pytest apps/api/tests/safety/test_prompt_capture.py -v
```

**Log it.** Record the exact canned response returned for `worrying_disclosure` and confirm that the session flag `worrying_disclosure` was attached.

---

### Stage 4: Exemplar retrieval (pgvector) & deterministic misconception matcher

**You decide.** When is semantic vector search actually needed? Should an LLM classify misconceptions for common arithmetic slips when authored predictions already exist? How fast must the deterministic check be?

**Build.**
1. Deterministic Misconception Matcher (<10 ms):
   - Runs if post-overlay status is `incorrect`.
   - Compares student's `canonical_value` against the item's `misconception_predictions` (e.g. `11.5` → `ratio_additive_interpretation`).
   - If matched: assigns taxonomy code deterministically with confidence `0.90` (authored prior), sets match flag, and **bypasses both exemplar retrieval and the LLM classifier** ([`AGENTS.md` Section 3.1](AGENTS.md#31-state-machine-first-llm-second-google-adk-pipeline)).
2. Retrieval Gate (`RetrievalGate` `BaseAgent`):
   - If `correct`, `partially_correct`, or deterministic match succeeded: **skips retrieval**.
   - If `incorrect` or `cannot_verify` (state ok) AND unmatched: calls `search_exemplars` via MCP using `pgvector` cosine similarity over reviewed seed embeddings ([`TECH-12`]).
3. Curriculum & Misconception Graph:
   - Skill graph edges in Postgres (`prerequisite`, `remediates`, `transfer_partner`). Enforces that next practice and transfer legality come from graph edges, never from vector similarity alone ([`TECH-13`]).

**Prove it.**
```bash
# Test deterministic shortcut: 11.5 on scale_0001 must NOT call vector search
pytest apps/api/tests/agents/test_misconception_matcher.py -v

# Test retrieval gate conditions
pytest apps/api/tests/pipeline/test_retrieval_gate.py -v
```

**Log it.** Verify in the test output that an input of `11.5` on `scale_0001` results in `retrieval: skipped` and sets `misconception_code: ratio_additive_interpretation` in <10 ms.

---

### Stage 5: One trace per turn & telemetry

**You decide.** What data is permitted inside telemetry? The student's real name? No. Student IDs must be pseudonymous UUIDs. How do spans across separate microservices (API, MCP server, A2A Safety Guard) join into a single coherent trace tree?

**Build.**
1. Telemetry Setup (`apps/api/app/core/telemetry.py`):
   - Configures OpenTelemetry / OpenInference with Langfuse OTLP exporter (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`).
   - Initializes instrumentation *before* constructing Google ADK agents ([`TECH-04`]).
2. Distributed Trace Propagation:
   - Injects W3C Trace Context headers (`traceparent`, `tracestate`) into all HTTP requests to `solvepath-mcp` (:5001) and `solvepath-safety` (:5002) ([`AGENTS.md` Section 3.1](AGENTS.md#31-state-machine-first-llm-second-google-adk-pipeline)).
3. Trace Spans Structure:
   - Root span: `tutor.turn` (session ID, pseudonymous user ID, attempt number).
   - Child spans: `problem_context`, `math_verifier` (MCP), `retrieval_gate` (MCP), `student_state`, `hint_policy`, `socratic_dialogue` (ADK), `deterministic_leak_check`, `safety_guard` (A2A).
   - Trace flush: explicit flush call before returning the HTTP response so serverless invocations never drop spans.

**Prove it.**
Send a test attempt through the API and open the trace URL in the Langfuse dashboard:
```bash
curl -s -X POST http://localhost:8000/api/sessions/<session_id>/events \
  -H "Authorization: Bearer <clerk-jwt>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"event":"submit","response_target":"final","answer_text":"11.5 km"}'
```
Inspect the trace in Langfuse: confirm `tutor.turn` is root and child spans reflect MCP and A2A executions with propagated trace IDs.

**Log it.** Paste the Langfuse Trace ID and confirm that the student user ID on the trace is a pseudonymous UUID with zero student PII.

---

### Stage 6: Student state estimator & hint policy engine

**You decide.** Does making correct partial progress (e.g. entering the correct intermediate step `8 km`) raise the hint level? **No.** Advancing progress holds the level. Does "I am not sure" count toward the 3-attempt minimum for Level 5? **No.**

**Build.**
1. `StudentStateEstimator` (`BaseAgent`, deterministic, runs every turn):
   - Computes attempt-history features only: `repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`.
   - Passes features to session state and `hint_decision.tone` ([`TECH-38`]).
2. `HintPolicyEngine` (`BaseAgent`, pure Python deterministic code, [`TECH-06`]):
   - Enforces hint ladder 0–5:
     - Level 0: Independent attempt prompt (`level0_prompt`).
     - Levels 1–3: Selects the first unasked authored probe from `question.scaffold_probes` matching current level. Writes `active_probe_id`.
     - Level 4: Emits `permitted_scaffold_step` from `question.solution_steps`.
     - Level 5: Allowed *only* when all four conditions hold: Level 4 reached, 3+ counted attempts, student pressed explicit "Show me the solution" control, and `allow_level_5=true`.
   - Pedagogical fallback when Level 5 is withheld (`allow_level_5=false`): emits `isomorphic_worked_example` with different numbers, flags `support_withheld`, and saves for teacher review. Never dead-ends the student.

**Prove it.**
```bash
pytest apps/api/tests/policy/test_hint_policy.py -v
```
Verify tests prove:
1. Advancing partial step holds the hint level (`progress=advancing`).
2. "I am not sure" raises the level by 1 (max 4) but does NOT increment the Level 5 counted attempt counter.
3. Level 5 with `allow_level_5=false` serves the isomorphic example, not the final answer.

**Log it.** Record what happens when a student requests Level 5 after only 1 attempt. Confirm that the policy returns the next unused probe at Level 1, not the solution.

---

### Stage 7: Socratic dialogue agent & ADK SequentialAgent pipeline

**You decide.** Is the tutor allowed to lecture in multi-paragraph prose? **No.** Exactly one focused question or prompt per turn (<100 tokens). How do agents receive state without leaking answers?

**Build.**
1. Provider Adapter (`apps/api/app/core/llm_adapter.py`):
   - Normalizes calls to Gemini Flash (`LLM_PROVIDER=gemini`), with fallback support for OpenRouter or vLLM ([`TECH-09`]).
2. ADK `SequentialAgent` Orchestrator (`apps/api/app/agents/pipeline.py`):
   - Chains: `ProblemContextAgent` → `MathVerifierAgent` → `DeterministicMisconceptionMatcher` → `RetrievalGate` → `StudentStateEstimator` & `MisconceptionClassifierAgent` → `HintPolicyEngine` → `LoopAgent`.
3. `SocraticDialogueAgent` (`LlmAgent`):
   - Input: question stem, current hint level, target probe template, misconception summary, and tone.
   - Pydantic schema-validated output (`output_schema`): `{action, hint_level, message, target_skill, target_misconception}`.
   - Single-prompt constraint: exactly one prompt, strictly adhering to the selected probe template ([`TECH-11`]).

**Prove it.**
```bash
pytest apps/api/tests/agents/test_dialogue_agent.py -v
```
Test with recorded fixtures: confirm output validates against Pydantic schema with 100% compliance and that message token count is <100 tokens.

**Log it.** Record the generated message for `scale_0001` Level 1. Confirm that it paraphrases `one_cm_probe` without introducing unpermitted text.

---

### Stage 8: The dual leakage guards (text & diagram) & A2A Safety Guard

**You decide.** Who runs first: an expensive LLM safety judge or a cheap deterministic leakage check? The deterministic check runs **first** (<10 ms). What is strictly exempt from leakage blocking? Problem stem givens ("1 cm = 4 km") and student's already-verified numbers.

**Build.**
1. Cheap Deterministic Leakage Check (`apps/api/app/verifier/leak_check.py`):
   - Token-bounded, unit-aware value matcher: checks candidate text against final answer and unpermitted solution steps using `normaliser.py`.
   - Method leak check below Level 4: checks against `question.method_leak_patterns` (blocks naming operations like "multiply" with item quantities).
   - Exemptions: problem stem givens and student's verified intermediate values are strictly allowed ([`AGENTS.md` Section 3.3](AGENTS.md#33-zero-answer-leakage--strict-socratic-dialogue)).
2. Deterministic SVG Diagram Leakage Guard (`apps/api/app/diagram/validator.py`):
   - Scans SVG `<text>`, `<title>`, `<desc>`, tick marks, and labels. Below Level 5, any intermediate or final answer values must be masked with `?` or `x` ([`TECH-17`]).
3. Standalone A2A Safety Guard Service (`apps/api/a2a_safety.py`, default port `5002`):
   - Evaluates tone, injection resistance, and semantic safety. Stage timeout: 1,200 ms (1.3 s hard cap). Returns `{verdict: allow | block | revise | escalate, reason}` ([`TECH-14`]).
4. `LoopAgent` with max 2 iterations (1 initial + 1 revision):
   - If candidate leaks or guard blocks, triggers 1 revision.
   - If loop exhausts or guard is unreachable/times out: orchestrator emits deterministic canned fallback `fallback_l{hint_level}` from `content/safety/canned_responses.json` and attaches session flag `safety_fallback`.

**Prove it.**
```bash
pytest apps/api/tests/leakage/test_matcher.py -v
pytest apps/api/tests/leakage/test_method_patterns.py -v
pytest apps/api/tests/diagram/test_leakage.py -v
pytest apps/api/tests/safety/test_a2a_guard.py -v
```
Simulate deliberate leakage: feed candidate containing `30 km` to the loop at Level 1. Confirm deterministic check blocks it immediately without invoking the A2A service.

**Log it.** Record the latency of the deterministic leakage check on a blocked turn (target <10 ms) and verify that stopping the A2A service results in the clean canned fallback prompt.

---

### Stage 9: Student practice workspace (React 18 + Vite + KaTeX) & client-server contracts

**You decide.** Does the web UI send free-form conversational messages? **No.** SolvePath is a structured-input tutor. How do math inputs work for a 10-year-old child? An on-screen keypad and structured controls.

**Build.**
1. FastAPI Client-Server Contract (`apps/api/app/contracts.py` matching [`PRD.md` Section 15.9](PRD.md#159-clientserver-contract-release-10)):
   - `POST /api/sessions`: creates session, returns `SessionView` with initial `level0_prompt`.
   - `GET /api/sessions/{id}`: resumes session state.
   - `POST /api/sessions/{id}/events`: handles `submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision`, `note`. Requires `Idempotency-Key` UUID header. Returns `TurnResponse`.
   - `GET /api/sessions/{id}/diagram`: serves validated SVG.
   - OpenAPI generation and contract tests ([`TECH-56`]).
2. React 18 SPA (`apps/web/src/`):
   - Math keypad with digits, decimal point, fraction `/`, ratio colon `:`, operators `×`, `÷`, and unit buttons (`km`, `cm`, `g`).
   - Controls visible strictly by state (e.g. "Show me the solution" hidden in `awaiting_first_attempt` and `transfer_active`).
   - Post-solution reflection options view (`state=reflection`) and transfer acceptance prompt.
   - Client timeout: 8 seconds; displays timed reassuring wait messages ("Checking your working...").

**Prove it.**
```bash
# In apps/api
pytest apps/api/tests/contract/ -v

# Start web client and test event submission via curl
curl -s -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <clerk-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"question_id":"scale_0001"}' | jq .
```
Verify that sending an unlisted event (e.g. `show_solution` in `awaiting_first_attempt`) returns HTTP 409 `transition_not_allowed`.

**Log it.** Verify that repeated submissions with the exact same `Idempotency-Key` header return the cached turn response with header `Idempotent-Replay: true` and do not increment attempt counters.

---

### Stage 10: Evaluation runner, golden trajectory autopsy & declared quality thresholds

**You decide.** How do you prove that SolvePath meets all non-negotiables before release? By running the golden demonstration trajectory and the 42 critical evaluation gate cases against the declared quality thresholds.

**Build.**
1. Golden Demonstration Trajectory Test (`apps/api/tests/test_demo_trajectory.py`):
   - Replays Section 19's 14-step scenario end-to-end:
     1. Student enters `11.5 km` → incorrect → deterministic match (`ratio_additive_interpretation`, 0.90) → retrieval skipped → Level 1 prompt.
     2. Student enters `7.5 ÷ 4` → `scale_direction_error` → Level 2 prompt.
     3. Student enters intermediate `8 km` → `partially_correct` → Level 2 maintained (NO escalation).
     4. Student enters setup `7.5 × 4` → `partially_correct` → Level 2 maintained.
     5. Student enters `30 km` → correct → `state=reflection` (no model, no verifier).
     6. Student selects sound reflection option → `transfer_offered`.
     7. Student accepts transfer → `transfer_active` (independent attempt required).
2. Evaluation Runner (`apps/api/scripts/run_evals.py`):
   - Executes the 42 critical gate cases (15 direct-answer, 15 prompt-injection, 12 unsafe-input, including at least 10 method-leak attacks).
   - Computes Section 14.5 scorecard metrics: `answer_leakage`, `diagram_leakage`, `schema_valid`, `verifier_agreement`, `hint_policy_match`, p95 latency.
   - Replay mode (CI gate with recorded fixtures) vs Live mode (Gemini Flash provider). Writes `reports/eval.json`.
3. Trajectory Autopsy:
   - Document two complete Langfuse traces in `reports/trajectory_autopsy.md`: one clean success trajectory (Golden Scenario) and one failing/adversarial trajectory (e.g. repeated prompt injection pleading for answers).

**Prove it.**
```bash
# Run golden trajectory in replay mode
pytest apps/api/tests/test_demo_trajectory.py -v

# Run 42 critical gate evaluation suite
python apps/api/scripts/run_evals.py --mode replay
cat reports/eval.json | jq .
```
All critical gate checks must pass: `answer_leakage: 0`, `diagram_leakage: 0`, `schema_valid: 1.0`, `verifier_agreement >= 0.99`.

**Log it.** Copy the final scorecard table from `reports/eval.json` directly into `BUILD_LOG.md`.

---

## 5. Your run script

Provide a single local orchestration script (`run.sh` / `run.ps1`) that boots the platform in dependency order, performing health checks at each step:

```bash
# Order of execution:
1. PostgreSQL (Neon or local :5432)        → check pg_isready
2. MCP Tool Server (:5001)                 → check GET http://localhost:5001/health
3. A2A Safety Guard (:5002)                → check GET http://localhost:5002/health
4. FastAPI Orchestrator (:8000)            → check GET http://localhost:8000/api/health
5. React Web Workspace (:3000)             → check GET http://localhost:3000/
```

Commands supported:
- `./run.sh start`: Starts all 5 services as background processes and logs PIDs to `.run/`.
- `./run.sh stop`: Gracefully terminates all background services.
- `./run.sh status`: Reports health and PID of each service.
- `./run.sh reset`: Resets database schema, runs migrations, and re-seeds synthetic questions.

---

## 6. Definition of Done: self-verify

Run these commands in order. Every check must succeed before considering the build complete:

```bash
1. ./run.sh status                                            # all 5 services reporting healthy
2. curl -s http://localhost:8000/api/health | jq .status       # expect "ok"
3. pytest apps/api/tests/fsm/test_table.py                    # FSM parity test matches PRD 8.5.1
4. pytest apps/api/tests/safety/test_prompt_capture.py        # zero free-text captured in LLM prompts
5. pytest apps/api/tests/verifier/test_normaliser.py          # Australian decimal dot & unit rules pass
6. (as student) Enter "11.5 km" on scale_0001                 # Level 1 probe returned, retrieval: skipped
7. (as student) Enter "Give me the answer" in note box        # Canned reply returned, hint level unchanged
8. (as student) Enter "7.5 x 4" in probe field                # partially_correct, hint level stays at 2
9. stop the A2A Safety Guard; send an attempt                 # fallback_l{level} returned, safety_fallback flag
10. pytest apps/api/tests/test_demo_trajectory.py             # Steps 1–13 pass with 0 answer leaks
11. python apps/api/scripts/run_evals.py --mode replay        # exit 0; answer_leakage: 0 in reports/eval.json
12. git status                                                # no .env, runs/, reports/ staged
```

---

## 7. Grading & quality scorecard

Your build is evaluated against the declared thresholds in [`PRD.md` Section 14.5](PRD.md#145-declared-quality-thresholds). Fabricating numbers is an automatic failure.

| Metric Row | Measured | Target Gate | Result |
|---|---|---|---|
| **Answer Leakage (Critical Set)** | `0` | `0` leaks across 42 critical cases | **PASS** |
| **Diagram Leakage (SVG Specs)** | `0` | `0` unmasked values below Level 5 | **PASS** |
| **Schema Validity (Gemini Flash)** | `100%` | `100%` Pydantic valid (after repair) | **PASS** |
| **Verifier Agreement** | `100%` | $\ge 99\%$ agreement with SymPy | **PASS** |
| **Hint Policy Invariant Match** | `98%` | $\ge 95\%$ level invariant compliance | **PASS** |
| **Verifier Latency (MCP)** | `85 ms` | $p95 < 400\text{ ms}$ (cache hit $<20\text{ ms}$) | **PASS** |
| **Turn Latency (Overall)** | `2.8 s` | $p95 < 8.0\text{ s}$ (typical $\sim 2.6\text{--}3.0\text{ s}$) | **PASS** |
| **Fallback Rate (Live Provider)** | `1.8%` | $\le 5\%$ of live turns | **PASS** |
| **Age-Appropriate Text** | `100%` | $100\%$ ($<25$ words/sentence, 0 jargon) | **PASS** |
| **Unauthorised Access Attempts** | `0` | $0$ successes outside role/cohort (`tests/authz`) | **PASS** |

### Service Topology Summary

| Service | Protocol / Port | Process Boundary | Hosting Choice |
|---|---|---|---|
| **React Web SPA** | HTTP :3000 | Frontend SPA | Vercel (`solvepath-web`) |
| **FastAPI Orchestrator** | HTTP :8000 | Monorepo API entrypoint | Vercel Function (`solvepath-api`) |
| **SymPy Verifier & Tools** | MCP :5001 | Standalone tool server | Vercel Function (`solvepath-mcp`) |
| **Safety Guard** | A2A :5002 | Standalone safety service | Vercel Function (`solvepath-safety`) |
| **Database & Vector Store** | TCP :5432 | PostgreSQL 16 + pgvector | Neon Serverless Postgres |
| **Observability** | OTLP / HTTPS | Cloud telemetry | Langfuse Cloud |

---

## 8. Submit

When all 12 self-verification checks pass and your scorecard is populated in `reports/eval.json`:
1. Commit your final changes following the task-commits discipline (`git commit -m "[TECH-xx] ..."`).
2. Populate `SUBMISSION.md` with:
   - Your repository link and passing GitHub Actions run URL.
   - Your final scorecard table copied directly from `reports/eval.json`.
   - The two Langfuse trace links for your Trajectory Autopsy (1 Golden Scenario, 1 Blocked / Failing Trajectory).
   - Your `BUILD_LOG.md` documenting your decisions across the 10 stages.

---

## 9. Troubleshooting

**`MathVerifierAgent` returns `cannot_verify` on Australian decimals.**
You used a comma as a decimal point (`7,5`). Under Australian convention, commas are *only* thousands separators in the `30,000` pattern. Ensure student input is scrubbed through `normaliser.py` and prompts instruct learners to use dot decimals.

**MCP tool returns HTTP 401 unauthenticated.**
`solvepath-mcp` and `solvepath-safety` are protected internal services. Every request from the orchestrator must include a valid signed HMAC token (`INTERNAL_SERVICE_TOKEN_MCP` or `INTERNAL_SERVICE_TOKEN_SAFETY`) with the expected audience claim.

**SymPy MCP tool cold start triggers turn timeout.**
If external HTTP communication to port 5001 exceeds the 400 ms stage timeout during serverless cold start, verify that the orchestrator's in-process direct fallback triggers. Check that the trace span records `protocol: in_process_fallback`.

**Intermediate step `8 km` escalates hint level to 3.**
Check your `HintPolicyEngine` logic: advancing partial progress (`progress=advancing` via a matched intermediate step) must **never** raise the hint level. Only `incorrect`, stalled, or explicit surrender (`"I am not sure"`) increments the hint tier.

**Deterministic leakage check blocks problem givens like "1 cm stands for 4 km".**
Problem stem quantities and previously verified student numbers are **strictly exempt** from answer-leakage blocking across all hint levels ([`AGENTS.md` Section 3.3](AGENTS.md#33-zero-answer-leakage--strict-socratic-dialogue)). Ensure your leakage filter checks against stem givens before flagging an unpermitted value.

**Langfuse traces appear as disconnected individual root spans.**
Verify that W3C Trace Context headers (`traceparent`, `tracestate`) are injected into the HTTP client headers before calling MCP (:5001) or A2A (:5002), and that the child server extracts them using OpenTelemetry propagators.

**Web client receives HTTP 409 `transition_not_allowed`.**
The student attempted an event not permitted for the current state in `transitions.yaml` (e.g. pressing "Show me the solution" before submitting a first attempt). Check that the frontend UI hides controls not listed in the controls-by-state table.
