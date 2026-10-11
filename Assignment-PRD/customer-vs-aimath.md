# Comparison: Customer Support PRD vs. SolvePath (AI-Math-Tutor) PRD

This document provides a comparative analysis between **Customer Support** (FDE Bootcamp Assignment 3 / Module 4 PRD) and **SolvePath / AI-Math-Tutor** (FDE Bootcamp Capstone PRD), highlighting core differences, shared engineering philosophies, and specific patterns from Customer Support that can be applied to SolvePath.

---

## 1. Document Context & Curriculum Mapping

| Property | [Customer Support PRD](file:///c:/projects/ai-math-tutor/Assignment-PRD/customersupport-prd.md) | [SolvePath PRD](file:///c:/projects/ai-math-tutor/PRD.md) |
| :--- | :--- | :--- |
| **Course Context** | FDE Agent Engineering Bootcamp, Cohort 2026-03 · Assignment 3 (Module 4, due end of Week 5). Owner: Hamza Farooq. | FDE Agent Engineering Bootcamp · Capstone Project planned across Weeks 1, 2, 3, 4, and 6. |
| **Product Domain** | E-commerce Customer Support Helpdesk (orders, returns, deliveries, account preferences). | Multi-Agent Socratic Mathematics Tutor for Years 5–6 quantitative reasoning (ratio, proportion, scale). |
| **Core Principle** | Grounded answers: facts come directly from tool calls in that turn. Tenant isolation and calibrated guards. | Socratic guidance: help students *think* and scaffold reasoning without leaking answers or methods. |
| **Document Role** | High-level briefing (~165 lines) delegating operational details to `SPEC.md`, `THRESHOLDS.md`, `TECHNICAL.md`, and `EVALS.md`. | Comprehensive master specification (~3,695 lines) with executable data contracts, FSM schemas, APIs, and curriculum mapping. |
| **Primary End User** | E-commerce shoppers, customer service managers. | Upper-primary students, mathematics tutors, teachers, and academic coordinators. |

---

## 2. Architectural & Technical Comparison

| Dimension | [Customer Support](file:///c:/projects/ai-math-tutor/Assignment-PRD/customersupport-prd.md) | [SolvePath](file:///c:/projects/ai-math-tutor/PRD.md) |
| :--- | :--- | :--- |
| **Core Orchestration** | Google ADK pipeline with declared guard stages and database tool execution. | Deterministic Finite-State Machine (FSM) first via Google ADK (`SequentialAgent`, `LoopAgent`), LLM second. |
| **Agent Protocols** | **MCP** (Toolbox for Databases) for order lookups; **A2A** for Security Judge and Data Masker services. | **MCP** for SymPy verification and pgvector retrieval; **A2A** for the Safety Guard (`solvepath-safety`). |
| **Guard Architecture & Ownership** | **Four-tier guard pipeline split by ownership:**<br>1. Cheap local check / Sanitizer (<10 ms)<br>2. Security Judge (shared A2A service owned by security)<br>3. Product Guardrail (local to product)<br>4. Data Masker (outbound PII stripper A2A service) | **Multi-tier deterministic & A2A pipeline:**<br>1. Input PII Scrubber + Input Screen (<10 ms canned responses)<br>2. Deterministic SymPy Verifier (MCP)<br>3. Deterministic Leakage Check (<10 ms inside Loop)<br>4. Safety Guard (A2A service) |
| **Verification & Ground Truth** | **Tool-Enforced Tenant Isolation:** SQL queries restrict results to authenticated customer ID in code/tool, not via model prompt. | **Deterministic CAS Verification:** SymPy engine handles math validation; pure cached evaluations; pgvector for misconception exemplars. |
| **Memory Management** | **System-managed memory (Mem0/vector):** Recalls context before the answer and persists customer preferences after the turn. | **Structured Learner Model:** `StudentStateEstimator` updates attempt history, hint dependency, and skill/misconception nodes in Postgres. |
| **Interface Strategy** | **Dual frontend over one core:** CLI program + Web UI emitting the exact same event stream and trace structure. | Full-stack Web SPA (React 18 + Vite + Tailwind + KaTeX); headless CLI runner for benchmarking and CI replay. |
| **Failure Handling** | **"Fail loud":** If a guard or tool fails or returns unparseable output, the turn halts immediately with an audit log. Never fails open silently. | **"Fail loud" & Graceful Fallback:** SymPy failure emits `cannot_verify` (never guessing); cold-start timeouts fallback in-process; loop failure triggers canned fallback. |
| **Specification of Thresholds** | **Strict separation:** Zero numbers in PRD prose; all numbers reside in an external `THRESHOLDS.md` single source of truth. | Numbers (SLA latencies, hint attempt counts, confidence levels) are embedded directly within prose across the PRD document. |
| **Evaluation Paradigm** | 100-point eval runner: attack block rate, benign pass rate (false positive testing), trace completeness, trajectory autopsy (1 success, 1 failure). | Offline benchmark suite (42 critical cases, 150 target benchmark), red-team answer extraction tests, golden scenario validation. |

---

## 3. What in Customer Support PRD Can Be Used in AI-Math-Tutor (SolvePath)

Although SolvePath is an exhaustive, production-grade specification, several high-impact concepts, guard-evaluation methodologies, and architectural patterns from Customer Support can strengthen SolvePath:

### 3.1 Calibrating "Both Sides of Every Guard" (Measuring False Blocks vs. False Passes)
* **Customer Support Concept:** Anyone can make a guard stricter; the true engineering skill is knowing what it costs. The assignment measures guards on blocking attacks **and** on *not blocking* real customer queries with apostrophes, punctuation, or benign trigger words like "drop" or "select".
* **Application to SolvePath:**
  * SolvePath’s `Input Screen`, `Deterministic Leakage Guard`, and `A2A Safety Guard` face the exact same tension.
  * An overly strict leakage guard might block a student who innocently mentions a number from the problem stem (e.g., *"There are 12 counters, so do I divide?"*), mistakenly treating stem quantities or mathematical operations as unpermitted answers.
  * SolvePath should adopt Customer Support's dual-suite benchmark methodology:
    1. **Adversarial extraction set (False Negatives / Leaks):** Prompt injection, pleading for answers, reverse-psychology jailbreaks.
    2. **Syntactically tricky student set (False Positives / False Blocks):** Legitimate math queries containing division terms, question marks, fractions, or negative numbers that must **pass** without being blocked or diverted to a generic safety rejection.

### 3.2 The "Enforcement Map" (Code vs. Prompt vs. Hybrid)
* **Customer Support Concept:** A required deliverable where every system invariant is explicitly mapped: *Is it enforced in code, in a prompt, or both, and why?* Plus documenting 1 real false block and 1 false pass discovered during testing.
* **Application to SolvePath:**
  * SolvePath has rigorous invariants ([AGENTS.md Section 1 & 3](file:///c:/projects/ai-math-tutor/AGENTS.md)). Formalizing an **Enforcement Map table** in SolvePath explicitly clarifies:
    - *Zero Answer Leakage:* Enforced in deterministic Python regex/normaliser code (`normaliser.py`), **not** trusted to system prompts.
    - *Mathematical Equivalence:* Enforced in SymPy CAS tool (`verify_expression`), **not** by the LLM.
    - *PII Protection:* Enforced in deterministic regex scrubber at API ingress, **never** reaching the model context.
    - *Socratic Tone & Scaffolding:* Enforced in ADK `LlmAgent` prompt + validated by A2A Safety Guard.
    - *Role-Based Access:* Enforced in Postgres RLS (`SET LOCAL`) and FastAPI middleware.

### 3.3 Decoupling Numerical Thresholds into `THRESHOLDS.md`
* **Customer Support Concept:** *"No thresholds appear in this document. They live in `THRESHOLDS.md`, and that file is the only place they are true. A number restated in prose is a number that will be wrong by the second week."*
* **Application to SolvePath:**
  * SolvePath has numerous performance, pedagogical, and evaluation thresholds scattered across prose (e.g., P95 turn latency $\le 3000\text{ ms}$, deterministic check $<10\text{ ms}$, 3 counted attempts before Level 5, 42 critical evaluation cases, $\ge 99\%$ SymPy accuracy).
  * Extracting these into a dedicated `THRESHOLDS.md` (or machine-readable `benchmarks/thresholds.json`) ensures that CI test assertions, Langfuse evaluators, and product documentation never drift.

### 3.4 CLI & Web Parity (One Orchestrator Core Under Two Frontends)
* **Customer Support Concept:** Build the system over the same core as both a CLI program and a Web UI, guaranteeing that both emit the exact same event stream and trace structure.
* **Application to SolvePath:**
  * SolvePath relies heavily on the React web workspace. Implementing a lightweight CLI interactive mode (`apps/api/cli.py`) that drives the exact same Google ADK FSM pipeline enables:
    - Rapid local developer iteration without needing Vite/browser dev tools running.
    - Automated terminal-based recording of golden trajectories and multi-turn student sessions for benchmarking.
    - Headless red-teaming and batch evaluation replays.

### 3.5 End-to-End Trajectory Autopsies (1 Success, 1 Failure)
* **Customer Support Concept:** Requires reading and documenting two complete traces end-to-end: one clean success and one failure/blocked turn, analyzing the exact spans and decision boundaries.
* **Application to SolvePath:**
  * SolvePath already defines the "Golden Scenario" ([PRD Section 19](file:///c:/projects/ai-math-tutor/PRD.md#L3432-L3490)) for a successful learning trajectory.
  * Adding a formal **"Failure / Edge-Case Trajectory Autopsy"** (e.g., a student repeatedly attempting prompt injection to extract the final answer, or an unparseable notation escalating cleanly to a teacher intervention queue) demonstrates operational resilience and proves that the system "fails loud" and safely.

### 3.6 Guard Ownership Split (Shared Security Services vs. Product Guardrails)
* **Customer Support Concept:**
  - *Judge & Masker* are owned by security as standalone A2A microservices that any product can reuse.
  - *Guardrail* is owned by the product team because it defines what *this* specific product is for.
* **Application to SolvePath:**
  - In SolvePath, `solvepath-safety` (A2A service) represents the reusable enterprise safety check (PII, toxicity, prompt injection).
  - The Socratic pedagogy checks (method leakage, permitted hint levels, scaffold probe selection) belong strictly to the SolvePath domain orchestrator (`HintPolicyEngine`, `DeterministicMisconceptionMatcher`). This clean separation mirrors the FDE Module 4 organizational boundary.

---

## 4. What Should NOT Be Used from Customer Support PRD

To protect SolvePath's locked invariants and pedagogical requirements (as specified in [AGENTS.md](file:///c:/projects/ai-math-tutor/AGENTS.md)):
1. **No Open-Ended Memory Writes (Mem0 Chat Memory):** Customer Support allows the model to freely recall and store arbitrary customer preferences. SolvePath must strictly maintain its deterministic, structured **Learner Model** (`mastery_level`, `consecutive_unsuccessful`, `predicted_misconceptions`) written by `StudentStateEstimator` to prevent hallucinated student profiles.
2. **No Direct Answer Retrieval:** Customer Support’s goal is to immediately retrieve and display order facts. SolvePath’s mission is the opposite: to withhold final answers and guide the student through stepwise Socratic prompts.
3. **No Unstructured Chat Input:** Customer Support supports free-form conversational messages. SolvePath strictly restricts student input to structured answer fields, keypad inputs, and reasoning options ([AGENTS.md Section 3.6](file:///c:/projects/ai-math-tutor/AGENTS.md#L112-L132)), with free text isolated strictly to teacher notes.
