# SolvePath — Architecture Note (TECH-30, PRD §15.8, §21)

## 1. Executive Summary & Orchestration Model

SolvePath is an agentic, deterministic AI mathematics tutoring platform purpose-built for Year 5–6 students undertaking selective-entry quantitative reasoning preparation. Unlike open, non-deterministic agent meshes or unconstrained ReAct loops, SolvePath employs a **deterministic hub-and-spoke workflow harness with bounded LLM stages**.

```text
                           Tutor Orchestrator (hub, deterministic)
   TX-A ──► ADK Runner ─► SequentialAgent ─────────────────────────────────────────────► TX-B
            1 ProblemContextAgent ──► 2 MathVerifierAgent ──► 3 DeterministicMisconceptionMatcher
            ──► 4 RetrievalGate ──► 5 StudentStateEstimator ──► MisconceptionClassifierAgent (conditional)
            ──► 6 HintPolicyEngine ──► 7 LoopAgent[ SocraticDialogueAgent ► DeterministicLeakCheck ► SafetyGuard ]
            ──► 8 fallback_l{level} (authored)
   spokes:  MCP (verify_expression, search_exemplars, get_question) · A2A (SafetyGuard) · LLM adapter · Postgres
   off-path: TeacherInsightAgent (cron / on demand) · ProblemParser (offline import)
```

### Core Architecture Invariants
1. **Deterministic Authority**: No model chooses a tool, route, mathematical verdict, hint level, state transition, or retry. Every educational progression is governed by deterministic finite-state machines.
2. **Stateless Pipeline Execution**: State is loaded from Neon Postgres for a single turn, processed through the harness, and persisted back to Postgres in a single atomic transaction.
3. **No Student Text in LLM Prompts**: Student free-form text never reaches LLM prompts or vendor APIs. It is screened at ingress by the Input PII Scrubber and recorded only for teacher review.
4. **Answer Protection**: The accepted answer value and solution steps are never exposed to LLM dialogue generation agents below Level 5.
5. **Fail-Closed Safety**: Any schema violation, latency timeout, or guard rejection triggers pre-approved, human-reviewed fallback probes with zero student impact.

---

## 2. Component Inventory

| Identifier | Component | Role | Runtime Model |
|---|---|---|---|
| **AG-00** | `TutorOrchestrator` | Pipeline hub, session lifecycle, and turn state transitions | Deterministic TypeScript / Python |
| **AG-01** | `ProblemContextAgent` | Question loading, PII scrubbing, input screening | Deterministic |
| **AG-02** | `MathVerifierAgent` | Mathematical equivalence checking via SymPy | Pure MCP tool + local overlay |
| **AG-03** | `DeterministicMisconceptionMatcher` | Rule-based numeric mistake mapping | Deterministic rule engine |
| **AG-04** | `RetrievalGate` | Selective exemplar retrieval for error diagnosis | Deterministic gate + MCP |
| **AG-05** | `StudentStateEstimator` | Session attempt history & momentum evaluation | Deterministic feature extractor |
| **AG-06** | `MisconceptionClassifierAgent` | Diagnosis from closed 13-item error taxonomy | Schema-bound LLM (advisory) |
| **AG-07** | `HintPolicyEngine` | 0–5 hint ladder progression & scaffold selection | Deterministic FSM |
| **AG-08** | `SocraticDialogueAgent` | Single-question Socratic phrasing (< 100 tokens) | Bounded LLM (opt-in stretch) |
| **AG-09** | `DeterministicLeakCheck` | Pre- and post-guard candidate value leakage verification | Deterministic regex / token check |
| **AG-10** | `SafetyGuard` | A2A child safety & leakage review service | A2A microservice (`solvepath-safety`) |
| **AG-11** | `TeacherInsightAgent` | Evidence-linked recommendation drafting for educators | Offline LLM batch worker |

---

## 3. Technology Stack & Infrastructure

- **Application Framework**: Next.js 14.x App Router, React 18, Node.js runtime.
- **Database**: Neon Lakebase Postgres (AWS `ap-southeast-2` Sydney for Australian data residency), pgvector for semantic question retrieval.
- **Authentication**: Clerk JWT authentication with app-layer role-based access control (Student, Teacher, Academic Coordinator, Administrator).
- **Mathematical Verifier**: SymPy mathematical engine running isolated in-process and accessible via Model Context Protocol (MCP).
- **Safety Service**: Agent-to-Agent (A2A) isolated safety microservice enforcing child safety and strict answer leakage boundaries.
- **Observability**: Langfuse Cloud for distributed trace management, W3C `traceparent` propagation, and Sentry for error tracking.
- **Background Processing**: Vercel Cron scheduled jobs (`learner-rollup`, `embedding-sync`, `insight-drafts`, `item-quality-scan`, `retention-purge`).

---

## 4. Hint Ladder & Finite State Machine

The Socratic tutoring progression follows an immutable 6-stage hint ladder:

```text
Level 0: Orientation & Restatement (authored probe)
   │ (unsuccessful attempt)
Level 1: Focus Attention on Key Relations (diagnostic probe)
   │ (unsuccessful attempt)
Level 2: Structural Representation (strip diagram / ratio table)
   │ (unsuccessful attempt)
Level 3: Strategic Scaffold (intermediate sub-question)
   │ (unsuccessful attempt)
Level 4: Permitted Calculation Scaffold (procedural step)
   │ (strict 4-condition gate: Level 4 reached + ≥3 attempts + student requests + allow_level_5=true)
Level 5: Full Worked Solution
```

If `allow_level_5` is false (the coordinator default), the system provides an isomorphic worked example with different numbers, preserving the integrity of student assessment while supporting comprehension.
