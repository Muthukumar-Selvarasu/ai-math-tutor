# Comparison: LUMINA PRD vs. SolvePath (AI-Math-Tutor) PRD

This document provides a comparative analysis between **LUMINA** (FDE Bootcamp Assignment 1 PRD) and **SolvePath / AI-Math-Tutor** (FDE Bootcamp Capstone PRD), highlighting core differences, shared engineering philosophies, and specific patterns from LUMINA that can be applied to SolvePath.

---

## 1. Document Context & Objectives

| Property | [LUMINA PRD](file:///c:/projects/ai-math-tutor/Assignment-PRD/LUMINA.md) | [SolvePath PRD](file:///c:/projects/ai-math-tutor/PRD.md) |
| :--- | :--- | :--- |
| **Course Context** | FDE Agent Engineering Bootcamp, Cohort 2026-03 · Assignment 1 (Week 1–2). Owner: Hamza Farooq. | FDE Agent Engineering Bootcamp · Capstone Project planned across Weeks 1, 2, 3, 4, and 6. |
| **Product Domain** | AI Search Engine (Perplexity clone) for knowledge discovery and synthesis. | Multi-Agent Socratic Mathematics Tutor for Years 5–6 quantitative reasoning. |
| **Core Principle** | Grounded answers: synthesize retrieved web/doc knowledge and cite sources. | Socratic guidance: help students *think* and scaffold reasoning without leaking answers. |
| **End User** | General knowledge seekers, researchers, developers. | Upper-primary students, math tutors, teachers, and academic coordinators. |

---

## 2. Architectural & Technical Comparison

| Dimension | [LUMINA](file:///c:/projects/ai-math-tutor/Assignment-PRD/LUMINA.md) | [SolvePath](file:///c:/projects/ai-math-tutor/PRD.md) |
| :--- | :--- | :--- |
| **Orchestration** | Custom Perceive-Reason-Act loop (Plan $\rightarrow$ Choose Tool $\rightarrow$ Observe $\rightarrow$ Repeat $\rightarrow$ Stop). Bounded iterations. | Deterministic Finite-State Machine (FSM) first via Google ADK (`SequentialAgent`, `LoopAgent`), LLM second. |
| **Tech Stack** | **MERN Stack**: Express Gateway (Edge) + Express Agent Service (Work) + React UI + MongoDB Atlas Vector Search. | **Enterprise Python/React Stack**: FastAPI + React (Vite/TS) + PostgreSQL/pgvector (Neon) + Google ADK + MCP + A2A + Langfuse. |
| **Verification & Ground Truth** | **Citation Grounding**: Every claim `[n]` resolves to text retrieved in that exact request. Hallucinated citations fail automatically. | **Deterministic CAS Verification**: SymPy handles math validation; pure cached evaluations; pgvector for misconception exemplars. |
| **Execution Gears** | **Two explicit user-facing gears**: **Quick** (default, 1-pass search, cheap/fast) vs. **Deep** (query decomposition, multi-pass, opt-in). | **Tiered pipeline**: Low-latency deterministic check (<10 ms, cached SymPy + pre-calculated predictions) vs. deep LLM diagnostic/dialogue loop. |
| **Safety & Policy** | Fail loud on provider errors (502s), bounded execution limits, credentials isolated to Agent Service. | Zero answer leakage below Hint Level 5, deterministic Input PII Scrubber, Input Screen (canned responses), A2A Safety Guard. |
| **Evaluation Paradigm** | **One URL** (`/` and `/evals`), automated CLI benchmark (`bench.mjs`), trajectory autopsy (1 success, 1 failure). | Offline benchmark suite (42 critical cases, 150 target benchmark), Langfuse tracing, CI/CD blocking gates, human educator rubric. |

---

## 3. What in LUMINA PRD Can Be Used in AI-Math-Tutor (SolvePath)

Although SolvePath is an exhaustive, production-grade specification (3,600+ lines), several high-impact concepts, delivery mechanisms, and evaluation patterns from LUMINA can strengthen SolvePath's alignment with FDE standards:

### 3.1 Public `/evals` Dashboard & "One URL" Delivery Standard
* **Lumina Concept:** Lumina specifies a single delivery URL where `/` is the active product and `/evals` renders automated evaluation results, SLA timings, and quality metrics directly in the browser for evaluators.
* **Application to SolvePath:** SolvePath currently logs metrics to Langfuse and runs test suites in GitHub Actions CI. Adding a public, read-only `/evals` page to the frontend dashboard that visualizes:
  - 42 critical evaluation case pass rates
  - 0-leak red-team test status
  - SymPy mathematical verifier agreement ($\ge 99\%$)
  - P95 latency and SLA benchmarks
  
  This provides immediate, verifiable proof of system quality to any evaluator or teacher without requiring backend credentials.

### 3.2 Formalising the "Two Gears" (Quick vs. Deep) in Socratic Tutoring
* **Lumina Concept:** Lumina introduces **Quick** (cheap, single-pass) vs. **Deep** (decomposing, expensive, opt-in), mandating that the server never automatically escalates without a bounded reason to prevent unbounded bills.
* **Application to SolvePath:** SolvePath already implements this under the hood via the `RetrievalGate` and `DeterministicMisconceptionMatcher`. Explicitly framing this as an intentional **Two-Gear Tutoring Engine** enhances architectural clarity:
  - **Quick Gear (Deterministic / Low Latency, <50 ms):** Pure SymPy verification + cached expression check + question-bank deterministic misconception matching. Requires zero LLM calls.
  - **Deep Gear (Agentic Socratic Scaffolding, ~1.5–3 s):** Triggered only when the student shows unpredicted errors or requests deeper conceptual support; runs exemplar retrieval, LLM classification, and the dialogue/safety loop.

### 3.3 The "Five Questions" Architecture Framework (`DESIGN.md`)
* **Lumina Concept:** Lumina requires answering five core architectural questions before development:
  1. *Components* — what are the pieces, and where does each run?
  2. *Responsibilities* — what is each piece the *only* one allowed to do?
  3. *Communication* — how does each pair talk, and what happens when one is down?
  4. *State* — what is stored, where, who owns it, and what is merely a cache?
  5. *Trade-offs* — three decisions a reasonable engineer would have made differently, and what was conceded.
* **Application to SolvePath:** SolvePath answers these across Sections 9, 10, 11, 15, and 22. Summarizing these into an executive `DESIGN.md` using the FDE Five Questions rubric provides a clean entry point for technical reviewers and grading mentors.

### 3.4 End-to-End Trajectory Autopsy (1 Success, 1 Failure)
* **Lumina Concept:** Human evaluation requires reading two complete trajectories end-to-end: one successful run and one failing run, extracting concrete engineering takeaways.
* **Application to SolvePath:** SolvePath specifies the "Golden Scenario" ([PRD Section 19](file:///c:/projects/ai-math-tutor/PRD.md#L3432-L3490)), which documents a successful trajectory. SolvePath can adopt Lumina's rubric requirement by adding an explicit **"Failure / Edge-Case Trajectory Autopsy"** (e.g., handling repeated adversarial prompt injections or an unparseable notation escalating cleanly to teacher review) to demonstrate how the system fails safely and loudly.

### 3.5 "Bounded & Honest" Termination Signals in API Payloads
* **Lumina Concept:** Limits hit (timeouts, step caps) must be distinguishable from clean completion in response payloads: *"A run that stopped because it ran out, reported as though it were done, has destroyed the only signal that separates a working agent from a lucky one."*
* **Application to SolvePath:** In client-server session contracts ([PRD Section 10.4 & 15.9](file:///c:/projects/ai-math-tutor/PRD.md#L2293-L2325)), ensure explicit `termination_reason` fields (`completed`, `turn_cap_reached`, `stuck_after_transfer`, `fallback_invoked`) are directly surfaced to the UI and educator audit logs, rather than treating fallback prompts as generic tutor responses.

### 3.6 Decoupling Metrics into Single-Source JSON Files
* **Lumina Concept:** *"No thresholds appear in this document. They live in `benchmark/sla.json`, `expectations.json` and `eval/rubric.json`... A number restated in prose is a number that will be wrong by Week 2."*
* **Application to SolvePath:** SolvePath has several hardcoded quality thresholds in prose ([PRD Section 14.5](file:///c:/projects/ai-math-tutor/PRD.md#L2657-L2700)). Establishing authoritative, machine-readable JSON config files (`benchmark/sla.json`, `eval/rubric.json`) that both CI tests and PRD validation scripts ingest guarantees zero documentation drift.

---

## 4. What Should NOT Be Used from LUMINA

To protect SolvePath's locked invariants and pedagogical requirements (as specified in [AGENTS.md](file:///c:/projects/ai-math-tutor/AGENTS.md)):
1. **No Open-Ended Web Search:** SolvePath's domain is strictly curated curriculum items and pre-approved exemplars; open web search violates safety and educational alignment.
2. **No MERN Stack Migration:** SolvePath's locked stack (FastAPI, Python Google ADK, Postgres/pgvector, SymPy) outranks Lumina's MERN/MongoDB Atlas stack.
3. **No Direct Answer Synthesis:** Lumina optimizes for delivering the final answer quickly with citations; SolvePath must maintain zero answer leakage below Level 5.
