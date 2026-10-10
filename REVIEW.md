# SolvePath review against the FDE course

**Date:** 10 October 2026
**Plan revision:** `PRD.md` v1.3 now specifies the in-scope weeks. The scores below are the review of the plan **before** that revision (54% mean). The revised design is mapped in PRD [Section 15.7](PRD.md#157-fde-course-skill-map). Intended coverage after v1.3 is about **86%** of weeks 1, 2, 3, 4, and 6 (harness 82, subagents 90, retrieval and cache and graph 82, MCP and A2A 88, customer handover 86). The remaining gap is deliberate: no second search product, no video-scale corpus, and a synthetic customer rather than a live organisation.
**Status update (PRD v1.3.9):** this file is the historical review of PRD v1.2 and its scores are not re-run. The P0, P1 and P2 corrections in section 7 have been applied in the PRD. A later PRD-against-idea review (10 October 2026) fixed these further items: one verifier status vocabulary (`partially_correct` plus `progress=advancing`), alternate solution paths in the question schema, a provisional 0.90 matcher confidence, the Release 1.0 / 1.1 split of the demo scenario, a `fallback_rate` gate, an `age_appropriate` gate, an early educator check (PRD 18.4.2), a capacity buffer with a cut order, and an explicit free-text limit. See the PRD revision log (v1.3.7 to v1.3.9). Section 9 below still describes the repository as it was at the original review.
**Status update (PRD v1.3.13):** a pre-build audit remediated the specification. Scores here are still not re-run. **Scope decision recorded:** section 6.3 of this review asked for *one* protocol (MCP for SymPy, or A2A for the safety guard). The PRD adopts both, because the weeks 4 protocol skills are graded and the deterministic stages run first either way. That costs about 40–55 engineering hours (Tier 1b) and is the main scope risk. The PRD's cut order (Section 18.2) keeps both services and cuts the retrieval wrapper and the cache first. The product owner should confirm this trade-off. A red-team pass at v1.3.14 and a verification pass at v1.3.15 added the pure verifier contract, authored reflection, the client–server contract (PRD 15.9) and the failure-state contract (PRD 11.6).
**Reviewed:** `PRD.md` (draft v1.2), `README.md`, `AGENTS.md`, `idea/AI-Tutor-Math-FDE-Capstone.docx`, and the repository contents
**Course:** [Forward Deployed Engineering Bootcamp](https://maven.com/boring-bot/ai-system-design) (Hamza Farooq, Maven)
**Curriculum source:** [hamzafarooq/multi-agent-course](https://github.com/hamzafarooq/multi-agent-course) `main`, which is the live merged Agent Engineering + FDE curriculum

**In scope for this review:** Weeks 1, 2, 3, 4, and 6. Week 5 (voice) and Week 7 (Demo Day) are outside the capstone requirement and are not scored.

This document is the review outcome. Use it to recorrect the project plan before implementation.

---

## 1. Verdict

The written SolvePath plan covers about **half** of the in-scope FDE course (weeks 1–4 and 6). **None of that plan is built yet.** The repository is specification only: `PRD.md`, `README.md`, `AGENTS.md`, and agent skills. There is no `apps/` tree, no SymPy verifier, no eval harness, and no deployment.

| Measure | Result |
| --- | --- |
| Plan coverage of the in-scope course | **54%** |
| Skills shipped in code | **0%** |
| In-scope weeks with a real design | **4 of 5** (weeks 1, 2, 4, and 6) |
| Course additions to make before building | **3** |

SolvePath is a strong education product for bounded agents, deterministic mathematics, evaluation gates, and teacher oversight. It is a weak course portfolio until the plan adds three proofs those weeks grade:

1. A **model boundary**, so Gemini stays the default and OpenRouter or a small vLLM endpoint can be swapped without rewriting agents.
2. **Retrieval the agent chooses**, plus a concrete cache, with a written reason that a knowledge graph is the wrong memory for a 40-item ratio bank.
3. **One protocol** (MCP for the SymPy verifier, or the safety check as a separate A2A service).

Diagrams as validated SVG are the right safety choice for this product. Say that in an architecture decision so it reads as a choice.

Do not build the full six-phase PRD first. Ship one scored tutoring turn, then the teacher dashboard.

---

## 2. What the plan already proves

Keep these. They are the FDE judgment in the design, and they match the product.

- The tutor is a **state machine**. The model writes one question inside a hint level it does not choose.
- **SymPy** decides correctness before any tutor sentence. A verifier exception must fail loudly, never as a fabricated correct or incorrect verdict.
- Hint levels **0–5**. Level 5 (full worked solution) is policy-gated. The model cannot decide when to reveal an answer.
- Misconception labels stay inside a **fixed taxonomy enum**. Agents do not invent codes.
- Teachers receive drafts and can override them. The system does not grade, place, or admit students.
- Evals are specified as **deterministic gates**: verifier agreement, answer leakage, hint-policy match, schema validity. An LLM judge may report tone and Socratic quality. It must not block a deploy.
- Traces are designed as one Langfuse trace per turn, with pseudonymous student IDs and no names or emails in telemetry.
- Public demos use **synthetic** student data.

Week 1 of the course teaches a ReAct loop from scratch, then asks when a workflow is the better system. A tutoring product that refuses an open agent loop is that decision. Section 9 of the PRD should say so explicitly, and should point at the safety `LoopAgent` (max 2 iterations, then a deterministic fallback) as the only bounded retry.

---

## 3. How the scores were judged

Design coverage is how much of that course week the written plan already specifies, from 0 to 100. A reference line of **70%** is the level that would hold up in a review of that week.

The headline **54%** is the unweighted mean of the five in-scope weeks: 55, 78, 32, 42, and 65. Week 5 and Week 7 are excluded from the mean.

Built coverage is **0% on every row**, because no application code exists.

Sources:

- Maven course page: [Forward Deployed Engineering Bootcamp](https://maven.com/boring-bot/ai-system-design)
- Official curriculum: [hamzafarooq/multi-agent-course](https://github.com/hamzafarooq/multi-agent-course)

The Maven page describes an end-to-end product: a React frontend, a backend, a model you host or route, caching, and deployment. The week table below uses that curriculum for weeks 1–4 and 6 only.

---

## 4. Week-by-week mapping

| Course week | What the course makes you ship | Where SolvePath stands | Design |
| --- | --- | --- | --- |
| 1. Agent loop, harness, system design | A ReAct agent from scratch, then **LUMINA** (Perplexity-style search with retrieval, citations, and a UI) | Workflow, tools, timeouts, state, and a full architecture are specified. There is no from-scratch ReAct loop and no citation-search product. | **55%** |
| 2. Skills, subagents, product architecture | An orchestrator plus specialized subagents (Sprint Zero) | `SequentialAgent` and `LoopAgent`, one schema per agent, shared session state. This is the strongest match in the plan. | **78%** |
| 3. Production agentic RAG | **ARGUS**: multimodal retrieval, semantic cache, knowledge-graph comparison, Llama Guard, an eval pyramid | pgvector top-k for misconception exemplars and transfer candidates. The eval design is strong. Cache, graph, and multimodal retrieval are absent. Diagrams are validated SVG. | **32%** |
| 4. Multi-agent protocols | A system where **ADK**, **A2A**, and **MCP** are separate processes, with traces across them | ADK is the centre of the design (`LlmAgent`, `BaseAgent`, callbacks, `output_schema`). MCP and A2A are absent. Tutoring runs inside one FastAPI app. Cron jobs are the only separate workers. | **42%** |
| 6. Leading AI systems | Roadmap, adoption, governance, and a way to measure impact | Non-goals, synthetic data, teacher control, and success metrics are specified. There is no named customer, handover, or operating boundary for a real tutoring centre. | **65%** |

Weeks 1, 2, 4, and 6 have a real design. Week 3 is the thin one: retrieval, cache, and a knowledge-graph decision are still open.

---

## 5. Maven learning outcomes mapped to the project

These six outcomes are the "What you'll learn" list on the [course page](https://maven.com/boring-bot/ai-system-design).

| Course outcome | Plan | What the PRD already has | What is still missing |
| --- | --- | --- | --- |
| Build a full-stack AI product: React, a backend, and an AI service, with streaming and error handling | **60%** | React 18 + TypeScript SPA, FastAPI, SSE for tutor responses, timeouts, idempotent retries for safe reads | The AI path lives inside the API process. The course expects a separable AI service behind the app. |
| Run and swap your own model (vLLM on RunPod, or OpenRouter) | **20%** | Per-agent model names as environment variables (`MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`) | Gemini via Google ADK is the only access path. Changing an env var changes the model name, not the provider. |
| Agentic multimodal RAG that scales, with semantic cache and a knowledge graph | **25%** | pgvector for near-duplicate questions, transfer candidates, and misconception exemplars. Retrieval is joined to approved, published items. | Retrieval is a fixed pipeline step, not a decision. There is no semantic cache, no graph, and no multimodal retrieval. SVG diagrams are safer for maths and do not cover this outcome. |
| Ship agents that are safe and proven: guardrails, trajectory evals, and outcome evals | **75%** | Hint policy, deterministic leakage check, Pydantic schemas, prompt-injection handling, Langfuse scores, CI eval gates, 150-case eval plan | The gates are specified and not implemented. Llama Guard is optional if the deterministic leakage gate is stricter and blocks the pipeline. |
| Observability across the stack: tracing, latency, cost, and quality per request | **85%** | One trace per tutor turn, one span per agent and tool, prompt versions, cost and latency, PII masking, flush before the serverless function returns | Best-specified part of the PRD. It exists only as design. |
| Distributed services that stay up, coordinated with MCP and A2A | **35%** | Vercel web + API projects, cron workers, pooled Postgres, container-portable FastAPI as a fallback | MCP and A2A are absent. Background work is cron hitting the same API. |

The mean of these six Maven outcomes is **50%**. The in-scope week mean is **54%**. Both say the same thing: the plan is about halfway to the course work this capstone is taking on.

---

## 6. Three additions before any feature work

These are the smallest changes that close the gaps a course reviewer will notice. They do not replace the Socratic product.

### 6.1 Model boundary

Keep Gemini as the default. Add one adapter so the same tutor turn can call OpenRouter or a small vLLM endpoint. Record provider, model, latency, and cost on the Langfuse trace. The demo shows a swap that does not rewrite the agents.

This is the course skill "swap models and providers without rewriting the app."

### 6.2 Retrieval that decides

The misconception classifier retrieves exemplars only when the verifier status is `incorrect` or `cannot_verify`. Cache identical expressions and repeated prompt templates. Write an architecture decision record that a knowledge graph is the wrong memory for a bank of about 40 reviewed ratio items.

This turns pgvector from a bolt-on lookup into the agentic-retrieval pattern from Week 3, at a size that fits the MVP.

### 6.3 One protocol

Put the SymPy verifier behind MCP, or run the Safety Guard as a separate A2A service. Keep the deterministic leakage, schema, and hint-policy gates already specified in the PRD. An LLM opinion must not be the gate.

This is the Week 4 protocol skill. The eval gates themselves belong to the safety and observability work already in the plan.

---

## 7. PRD corrections

Apply these in `PRD.md` before implementation. Priority is the order to edit, not a suggestion to do them all in one commit.

### P0 — change the plan before code

| Where | Change |
| --- | --- |
| New section after section 15 | **Course skill map.** List what this capstone proves against weeks 1–4 and 6, the knowledge-graph decision, and the three additions in section 6 of this review. |
| Sections 14 and 17 | Adopt the course quality bar. Write leakage, schema, and p95 latency thresholds before the first run. Deterministic checks block the pipeline. An LLM judge may report and must not block. Run cheap checks before model checks. |
| Section 18 | Shrink the first ship to one problem family, one student session, the SymPy verifier, the hint policy, the ADK pipeline, leakage tests, one Langfuse trace, and one deploy. The teacher dashboard is the next slice. Six phases, four personas, and 150 eval cases will not finish as a capstone if they are all treated as the first release. |
| Section 22 | Close the decisions `AGENTS.md` already treats as locked: Vite SPA, Gemini as the default, Neon (or the chosen Postgres). Add two decisions with defaults: the provider-swap adapter, and MCP for the verifier or A2A for the safety guard. |

### P1 — make the design readable as course work

| Where | Change |
| --- | --- |
| Section 9.3 | State why tutoring is a workflow. Point at the safety `LoopAgent` (max 2, then a deterministic fallback) as the only bounded retry. |
| Section 11.3 and the risk table | Replace the single word "caching" with the actual caches: question payload, identical SymPy results, prompt templates, embedding lookups. |
| Section 19 | Extend the demo script so it shows a blocked answer leak, the Langfuse trace, a cache hit, a retrieval decision, and the eval gate failing a deliberately leaky prompt. |
| `README.md` architecture diagram | The diagram says hint levels 0–3. The PRD ladder is 0–5. Make both 0–5. |

### P2 — keep scope from stalling the build

| Where | Change |
| --- | --- |
| Sections 6 and 7 | Parent, content-reviewer, and academic-coordinator roles are specified before the student loop exists. Mark them post-MVP. |

### Internal consistency to fix while editing

- `README.md` lists both `docs/PRD.md` and a root `PRD.md`. The master spec is the root file.
- The original idea document suggested Next.js and a flexible orchestrator. `PRD.md` v1.2 locked Vite + FastAPI + Google ADK. That lock is fine once section 22 stops listing Vite as an open decision.
- `AGENTS.md` is the operational contract and already matches the locked stack. After the PRD edits, keep `AGENTS.md` and `README.md` aligned with it in the same change.

---

## 8. What to build first

Treat SolvePath as an education-operations capstone that uses weeks 1–4 and 6. It does not need to reproduce the weekly project apps.

1. Keep the Socratic product: state machine, SymPy, hint ladder, taxonomy, teacher override.
2. Add the three course proofs: swappable model, decided retrieval plus cache, and one protocol (MCP or A2A).
3. Record the knowledge-graph decision in an architecture decision record.
4. Ship one scored tutoring turn on synthetic data before the teacher dashboard.

### First working slice

On synthetic data, one session should show:

- The student submits "I think it is 11.5 km" on the 1 cm : 4 km map problem.
- SymPy marks the attempt wrong (additive interpretation, not an arithmetic slip).
- The tutor asks one question and cannot reveal 30 km.
- Langfuse shows verifier, hint decision, dialogue, and safety guard as separate spans.
- A cache hit and a retrieval decision are visible on that trace.
- Gemini is called through the provider adapter, so a second provider can be selected without rewriting the agents.

---

## 9. Repository state at review time

Present:

- `PRD.md` — 23 sections, locked stack, ADK pipeline, data model, eval plan, Vercel topology, roadmap, demo scenario
- `README.md` — overview, architecture, stack, roadmap
- `AGENTS.md` — non-negotiables aligned with the PRD
- `idea/AI-Tutor-Math-FDE-Capstone.docx` — the source idea the PRD was written from
- `.agents/skills/` — task commits and GitHub issue workflow

Absent:

- `apps/web` and `apps/api`
- `content/questions`, misconception taxonomy files, and `content/eval`
- GitHub Actions workflows
- Architecture decision records, threat model, and runbook (named in the PRD, not in the tree)

The PRD is ahead of the repository. The next planning edit should make the first ship smaller than the PRD's full MVP, then the first code commit should be that smaller ship.

---

## 10. Test plan for the specified contracts (added at PRD v1.3.15)

This review's remit is whether the plan can be verified. Each contract added by the later remediation passes has one named test, and the story that holds its acceptance criteria. Paths are under `apps/api/`. The task that creates each test is listed in PLAN section 5 ("Which task creates which test"), and a task is not done until its tests pass.

| Contract | PRD | Story | Test (file or marker) |
| --- | --- | --- | --- |
| Normaliser corpus (word numerals, units, the dot and `30,000` comma rule) and the token-bounded leakage matcher | FR-03, FR-06 | STU-03, STU-05 | `tests/verifier/test_normaliser.py`, `tests/leakage/test_matcher.py` |
| Hint policy (Decisions #18 and #19, the FR-04 table) | FR-06 | STU-02, STU-05 | `tests/policy/test_hint_policy.py` |
| Item validation V1–V9 and the offline collision checks | §10.3.1 | ADM-04, ADM-12 | `tests/content/test_item_rules.py` |
| Golden trajectory, replay mode on every pull request | §14.6, §19 | STU-01 to STU-06 | `tests/test_demo_trajectory.py` |
| Input Screen: each category gets its canned reply, event and flag | §8.3.1 | STU-10 | `tests/safety/test_input_screen.py` |
| Pure verifier result and the pure-status table | FR-04 | STU-11 | `tests/verifier/test_pure_status.py`, one case per row of the table |
| Expression judged by form, never `correct` | FR-04 | STU-11 | `tests/verifier/test_expressions.py` (`7.5 × 4`, `4 × 7.5`, `7.5 ÷ 4`) |
| Response-target overlay (`final`, `step`, `probe`) | FR-04 | STU-11 | `tests/verifier/test_overlay.py` |
| Retrieval gate and matcher only on `incorrect` or `cannot_verify` | §9.3, §9.8 | STU-15 | `tests/pipeline/test_gate.py` |
| State machine rows 1–22 and the controls-by-state table | §8.5.1 | STU-12, STU-18, STU-01 | `tests/fsm/test_table.py`: `transitions.yaml` parity with the PRD table, plus an event-coverage test |
| `not_sure` and `show_solution` skip steps 2 to 5 | §9.3 | STU-01, STU-05 | `tests/pipeline/test_answerless_events.py` |
| Deterministic solution and example turns | §9.3 | STU-05 | `tests/pipeline/test_authored_turns.py` (no model call, no guard call) |
| Authored reflection and V9 | §8.5.1, §10.3.1 | STU-06 | `tests/content/test_reflection.py` |
| Authored text registry C1–C3 (draft or reviewed) and the release check C4 | §8.3.2 | ADM-12 | `tests/content/test_registry.py`, and `pytest -m release` for C4 |
| Identity mapping, unknown subject and idempotent seeding | §8.1 | ADM-06, ADM-13 | `tests/authz/test_unknown_subject.py`, `tests/seed/test_seed_synthetic.py` |
| `SessionView`, `QuestionView` and diagram route | §15.9 | STU-12 | `tests/contract/test_session_view.py` (asserts the forbidden fields are absent) |
| Idempotency, conflict, in-progress and error payload | §15.9 | STU-12 | `tests/contract/test_idempotency.py` |
| OpenAPI and web-type drift | §15.9 | ADM-08 | `tests/contract/test_openapi_drift.py` |
| Failure states | §11.6 | STU-13, ADM-06 | `tests/failure/test_failure_table.py`, one case per row, with fault injection |
| Turn, note and idempotency records | §10.7 | ADM-05, ADM-09 | `tests/db/test_records.py` |
| Free text never reaches a model | §8.3.1 | STU-10 | `tests/safety/test_prompt_capture.py` |
| Method-leak patterns below Level 4 | §8.6 | STU-05 | `tests/leakage/test_method_patterns.py` |
| Service-token 401 on MCP and A2A | §9.9 | ADM-05 | `tests/authz/test_service_tokens.py` |
| Diagram render and leakage guard | FR-09 | STU-08 | `tests/diagram/test_render.py`, `tests/diagram/test_leakage.py` |
| Tier 1 CI gate wiring | §14.5, §17 | ADM-08 | A deliberately leaky fixture pull request must fail `eval.yml` |
| Probe selection and `fallback_l{level}` | FR-06 | STU-02 | `tests/policy/test_hint_policy.py` (probe-order cases) |
