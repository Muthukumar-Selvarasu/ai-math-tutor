# Product Requirements Document

# SolvePath — Multi-Agent Socratic Mathematics Tutor

| Field | Value |
| --- | --- |
| **Document status** | Draft v1.2 for capstone MVP (tech stack aligned; user stories restructured) |
| **Product type** | AI-powered educational technology platform |
| **Primary audience** | Upper-primary mathematics learners, tutors, academic coordinators, and teachers |
| **Initial market focus** | Australian Years 5–6 learners preparing for selective-entry style mathematics and quantitative-reasoning assessments |
| **Initial curriculum scope** | Ratio, proportion, scale, and multiplicative reasoning |
| **Product principle** | The tutor should help students *think*, not simply supply answers. |

### Locked technology stack (summary)

| Concern | Choice |
| --- | --- |
| Agent framework | **Google ADK** (Agent Development Kit, Python) |
| Backend API | **Python + FastAPI** |
| Frontend | **React** (TypeScript) |
| Relational + vector data | **PostgreSQL with pgvector** |
| Object storage | **Vercel Blob** (Vercel object store) |
| LLM observability and evals | **Langfuse** |
| Background jobs | **Vercel Cron Jobs** (Vercel jobs) |
| CI/CD | **GitHub Actions** |
| Hosting | **Vercel** (web and API) |
| Secrets | **Vercel Environment Variables** |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem statement](#2-problem-statement)
3. [Product vision](#3-product-vision)
4. [Goals and success metrics](#4-goals-and-success-metrics)
5. [Users and personas](#5-users-and-personas)
6. [User stories](#6-user-stories)
7. [Scope](#7-scope)
8. [Functional requirements](#8-functional-requirements)
9. [Multi-agent design (Google ADK)](#9-multi-agent-design-google-adk)
10. [Data model](#10-data-model)
11. [Non-functional requirements](#11-non-functional-requirements)
12. [Safety and policy requirements](#12-safety-and-policy-requirements)
13. [Teacher intervention recommendations](#13-teacher-intervention-recommendations)
14. [Evaluation plan](#14-evaluation-plan)
15. [Technical architecture](#15-technical-architecture)
16. [Repository, environments, and configuration](#16-repository-environments-and-configuration)
17. [CI/CD with GitHub Actions](#17-cicd-with-github-actions)
18. [Delivery roadmap](#18-delivery-roadmap)
19. [Capstone demonstration scenario](#19-capstone-demonstration-scenario)
20. [Risks and mitigations](#20-risks-and-mitigations)
21. [Launch criteria](#21-launch-criteria)
22. [Open decisions](#22-open-decisions)
23. [Capstone portfolio statement](#23-capstone-portfolio-statement)

---

## 1. Executive summary

**SolvePath** is a multi-agent, evidence-driven Socratic mathematics tutor that guides students through problems using calibrated questions, step validation, misconception diagnosis, and adaptive hints.

Unlike a generic chatbot, SolvePath does not respond to "I don't understand" by immediately providing a full worked answer. It first assesses the student's current attempt, identifies the likely point of confusion, asks the smallest useful next question, verifies the student's response using deterministic mathematics tools, and updates a structured learner model.

The MVP focuses on **ratio and proportional reasoning** for Years 5–6. It supports text and selected diagram-based problems, tracks student mastery and hint dependency, and provides teachers or academic coordinators with evidence-backed learner insights.

The system is built with **Google ADK** for agent orchestration, **FastAPI** for the backend, **React** for the student and educator UI, **Postgres + pgvector** for domain and vector data, **Vercel Blob** for diagrams and assets, **Langfuse** for tracing and evaluation, **Vercel Cron Jobs** for background work, **GitHub Actions** for CI/CD, and **Vercel** for hosting and secrets.

The capstone demonstrates end-to-end Forward Deployed Engineer capability:

- Customer problem discovery and problem framing
- Domain modelling and curriculum alignment
- AI orchestration with bounded agents
- Deterministic mathematics validation
- Multi-agent workflow design
- Secure, auditable application development
- Evaluation harnesses and AI quality controls
- Teacher-facing operational dashboards
- Deployment, monitoring, and operational handover

Socratic tutoring systems are intended to guide learners using tailored questioning and feedback rather than only giving answers; this supports adaptive learning and makes student reasoning observable.

---

## 2. Problem statement

### 2.1 Current problem

Students preparing for selective-entry or advanced mathematics assessments often receive:

- Static question banks with answer explanations
- Generic hints that do not respond to their misconception
- Immediate worked solutions that encourage answer copying
- Practice reports showing only total scores or topic accuracy
- Limited feedback on *why* they made an error
- No clear measure of whether they can transfer learning to a similar problem

Teachers, tutors, and academic coordinators face a separate operational problem:

- They cannot efficiently review every student's reasoning process.
- They lack structured visibility into recurring misconceptions.
- They cannot easily distinguish a conceptual gap from a calculation error.
- They struggle to identify students who appear correct only because they depend heavily on hints.
- They need a safe way to use AI without allowing it to make high-stakes decisions or expose student data.

### 2.2 Opportunity

SolvePath converts a mathematics practice session into structured learning evidence.

Instead of storing only:

```text
Question: Incorrect
Student score: 0
```

the system captures:

```text
Skill: Ratio and proportional reasoning
Likely misconception: Additive comparison instead of multiplicative scaling
Student attempt: Partially correct
Hint level needed: Level 2
Math verification: Correct after guided prompt
Transfer question: Correct independently
Updated mastery: Improving, moderate confidence
Recommended next action: Visual ratio-model practice
```

This gives students more useful help and gives educators an interpretable evidence trail.

---

## 3. Product vision

### 3.1 Vision statement

Help students build durable mathematical reasoning by providing guided, adaptive, evidence-based tutoring that asks the right question at the right time.

### 3.2 Product promise

SolvePath will:

- Encourage active student reasoning before revealing methods or answers.
- Identify likely misconceptions from student work and explanations.
- Give one focused Socratic question at a time.
- Use deterministic tools to verify mathematics wherever possible.
- Progress from low-support prompts to worked guidance only when needed.
- Assess whether learning transfers to a similar but new problem.
- Give teachers actionable learner evidence without automating high-stakes educational decisions.

### 3.3 Non-goals

SolvePath is **not** intended to replace a teacher, provide final high-stakes grading, decide student placement, determine admissions suitability, diagnose learning disabilities, or send parent communications without human review.

UNESCO guidance on generative AI in education emphasises human-centred use, privacy, appropriate oversight, equity, and educator capacity rather than unbounded automation.

---

## 4. Goals and success metrics

### 4.1 MVP goals

| Goal | Description |
| --- | --- |
| Guided reasoning | Students receive Socratic prompts before answer disclosure |
| Mathematical correctness | Student responses and tutor feedback are validated using deterministic mathematics checks |
| Misconception insight | The system labels common misconception patterns with confidence and evidence |
| Adaptive help | Hint level adapts to the student's response and prior support requirement |
| Learning evidence | The system records mastery, hint dependency, time, attempts, and transfer outcomes |
| Teacher visibility | Teachers can review session summaries, learner trends, and intervention suggestions |
| Safe operation | Role-based access, audit records, data controls, and human approval boundaries are included |
| FDE showcase quality | Architecture, evaluation, deployment, observability, and handover artefacts are documented |

### 4.2 Product success metrics

The MVP should establish measurement infrastructure rather than claim educational impact before a controlled study.

| Area | Metric | MVP target |
| --- | --- | --- |
| Tutoring behaviour | Percentage of incorrect/uncertain attempts where tutor asks a question before showing a solution | At least 90% |
| Mathematics correctness | Tutor feedback aligned with deterministic verifier | At least 99% for supported problem types |
| Answer leakage | Percentage of sessions where final answer is exposed before permitted hint stage | Less than 2% |
| Hint calibration | Percentage of tutor prompts matching the configured hint policy | At least 95% |
| Citation/provenance | Percentage of teacher-facing claims linked to source events | At least 95% |
| Student completion | Percentage of started practice sessions completed | Baseline metric; no target before pilot |
| Transfer assessment | Percentage of completed tutoring sessions followed by a transfer problem | At least 80% |
| Quality review | Percentage of AI tutor turns eligible for replay and audit | 100% (every turn traced in Langfuse and persisted in Postgres) |
| Availability | Successful API requests during demo environment operation | At least 99% |
| Security | Authorisation tests passing for all supported roles | 100% |

### 4.3 Evaluation metrics

| Evaluation type | What will be measured |
| --- | --- |
| Mathematics correctness | Correctness of calculation checks, accepted equivalent expressions, units, rounding, and solution paths |
| Socratic quality | Whether prompts are focused, age-appropriate, non-leading, and aligned with the learner's current state |
| Misconception accuracy | Whether labelled misconceptions match human reviewer judgement |
| Hint quality | Whether the system gives the least revealing useful prompt |
| Learning evidence | Whether the learner model accurately reflects observed student behaviour |
| Transfer | Whether a student can solve a structurally similar follow-up item with less support |
| Safety | Prompt-injection resistance, answer-leakage rate, inappropriate output rate, and access-control compliance |
| Operational reliability | Latency, tool failure handling, retry success, and audit completeness |

---

## 5. Users and personas

### 5.1 Primary persona: Student

**Name:** Aisha, Year 6 learner
**Context:** Preparing for selective-entry-style mathematics and quantitative reasoning assessments

**Needs:**
- Clear guidance without being given the full answer too early
- Feedback on where their thinking went wrong
- Encouragement that does not feel judgmental
- Practice suited to their current level
- Visual representations when appropriate
- A clear way to understand progress over time

**Pain points:**
- Cannot tell whether mistakes are conceptual or careless.
- Reads explanations but cannot solve a similar question later.
- Feels discouraged when a question seems unfamiliar.
- May use AI to obtain answers rather than practise reasoning.

### 5.2 Secondary persona: Tutor or teacher

**Name:** Daniel, mathematics tutor
**Context:** Supports 20–40 learners across several mathematics topics

**Needs:**
- Identify common learning gaps across students
- Review student reasoning without reading entire transcripts
- Know which students require targeted intervention
- Review questionable AI tutor interactions
- Identify content items that are confusing or ineffective
- Use AI recommendations as support, not as a replacement for professional judgment

### 5.3 Secondary persona: Academic coordinator

**Name:** Priya, learning-programme coordinator
**Context:** Reviews cohort outcomes and intervention effectiveness

**Needs:**
- Cohort-level mastery and misconception trends
- Students requiring review
- Evidence supporting recommendations
- Clear distinction between low accuracy, slow pace, excessive hint use, and failed transfer
- A way to measure intervention outcomes
- Privacy-preserving and auditable processes

### 5.4 Administrative persona

**Name:** Platform administrator

**Needs:**
- Manage users, roles, curriculum scope, content, and access policies
- Monitor system health, model usage, errors, and evaluations
- View audit records
- Configure retention and consent policies
- Review flagged content and safety incidents

---

## 6. User stories

### 6.1 Story conventions

**Format.** Every story uses: *As a [role], I want [capability], so that [benefit].* The "so that" clause is mandatory because it states the intent, which lets engineers and designers make good trade-offs.

**Quality check (INVEST).** Each story must be Independent where possible, Negotiable (describes the outcome, not the implementation), Valuable, Estimable, Small enough for one sprint, and Testable. Stories that fail "Small" are split before they enter a sprint.

**Fields on every story.**

| Field | Purpose |
| --- | --- |
| ID and title | Traceability to tickets, tests, and requirements |
| Story statement | As a / I want / so that |
| Epic | Groups related stories |
| Priority | **P0** = must ship in MVP; **P1** = should ship in MVP; **P2** = post-MVP or stretch |
| Linked requirements | Detailed specification in Section 8 |
| Acceptance criteria | Given / When / Then; includes happy path, edge or failure case, permission rule, and audit event where relevant |
| Dependencies | What must exist first |
| Out of scope | Explicit boundary to prevent scope creep |
| Success metric | How we know the story delivered value (see Section 4) |
| Non-functional notes | Performance, accessibility, security, and privacy needs specific to the story |

**Acceptance criteria style.** Criteria describe observable behaviour, not implementation. Where a criterion can be checked automatically (leakage, authorisation, schema validity), it must map to a test in the CI evaluation suite (Section 14 and Section 17).

### 6.2 Epics

| Epic | Name | Stories |
| --- | --- | --- |
| E1 | Guided practice and Socratic tutoring | STU-01, STU-02, STU-03, STU-04, STU-05, STU-06, STU-08 |
| E2 | Learner progress and educator insight | STU-07, EDU-01, EDU-02, EDU-05, EDU-07 |
| E3 | Review, replay, and human oversight | EDU-03, EDU-04, EDU-06 |
| E4 | Governance, security, and platform operations | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05 |

### 6.3 Definition of Ready and Definition of Done

**Definition of Ready (a story may enter a sprint when):**

- The "so that" benefit and priority are stated.
- Acceptance criteria are written in Given / When / Then form and agreed with the product owner.
- Linked requirements and dependencies are identified and not blocked.
- Any UX design or diagram reference needed is attached.
- Test data needs are known (synthetic students, seed questions, evaluation cases).
- The story is small enough to complete within one sprint.

**Definition of Done (a story is complete when):**

- All acceptance criteria pass, with automated tests where the criterion is automatable.
- Code is peer-reviewed and merged through the GitHub Actions pipeline with all required checks green.
- Authorisation tests cover every role touched by the story.
- Answer-leakage, schema, and verifier regression tests pass for any story touching tutoring behaviour.
- Audit events and Langfuse traces are emitted for the behaviour described in the criteria.
- Accessibility checks (keyboard, labels, contrast, diagram text alternatives) pass for any new UI.
- Documentation (API, ADR, runbook, or user guidance) is updated where affected.
- The change is deployed to a Vercel preview environment and verified with synthetic data only.
- The product owner has accepted the story.

### 6.4 Student stories

#### STU-01: Attempt before guidance
**As a** student, **I want** to attempt a question before receiving guidance, **so that** I practise recalling and applying the method myself.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-03, FR-05, FR-06 (level 0)
- **Acceptance criteria:**
  - **Given** I open a published question, **when** the session starts, **then** the tutor asks for my first attempt or current thinking and shows no hint.
  - **Given** I select "I am not sure where to start", **when** I submit, **then** the tutor moves to the next permitted hint level instead of refusing to help.
  - **Given** I submit an attempt, **then** it is stored with attempt number, hint level at submission, and response duration, and an audit event is recorded.
- **Dependencies:** Question delivery (FR-02), session state machine
- **Out of scope:** Timed or exam-mode practice
- **Success metric:** At least 90% of incorrect or uncertain attempts receive a question before any solution is shown
- **Non-functional notes:** Question loads in under 2 seconds

#### STU-02: One focused hint at a time
**As a** student, **I want** one focused hint at a time, **so that** I am not overwhelmed and can act on each step.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-05, FR-06, Section 9.5
- **Acceptance criteria:**
  - **Given** any tutor turn, **then** the message contains exactly one question or request, validated against the agent output schema.
  - **Given** the Socratic Dialogue Agent returns more than one question or exceeds the hint level, **when** the Safety Guard checks it, **then** the turn is revised or replaced by the deterministic fallback prompt.
  - **Given** a tutor turn is delivered, **then** hint level, model, prompt version, and policy version are stored and linked to the Langfuse trace.
- **Dependencies:** Hint Policy Engine, Safety Guard
- **Out of scope:** Multi-step lesson mode
- **Success metric:** At least 95% of tutor prompts match the configured hint policy
- **Non-functional notes:** Tutor response targets under 5 seconds, streamed where possible

#### STU-03: Submit working, not only a final answer
**As a** student, **I want** the tutor to understand my working, **so that** it can find where my reasoning went wrong rather than only marking the final answer.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-03, FR-04
- **Acceptance criteria:**
  - **Given** I submit a numeric, fraction, decimal, percentage, free-text, or multiple-choice response, **then** it is accepted and parsed.
  - **Given** I submit an equivalent answer in a different format (for example 3/4 and 0.75), **then** the verifier treats it as equivalent.
  - **Given** my response cannot be parsed, **then** the tutor asks me to rephrase and does not mark me wrong.
  - **Given** the verifier returns `cannot_verify`, **then** the tutor does not claim the answer is incorrect and the turn is flagged for review if ambiguity persists.
- **Dependencies:** Deterministic verifier
- **Out of scope:** Handwritten or image-based working
- **Success metric:** At least 99% alignment between tutor feedback and verifier result for supported problem types
- **Non-functional notes:** Deterministic answer check under 500 ms

#### STU-04: Feedback on why my answer is incorrect
**As a** student, **I want** feedback on why my answer is incorrect, **so that** I can fix my thinking and not just retry.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-04, FR-07, Section 12.1
- **Acceptance criteria:**
  - **Given** my answer is incorrect and the misconception confidence is above the configured threshold, **then** the tutor addresses that misconception in plain, age-appropriate language.
  - **Given** misconception confidence is below the threshold, **then** the tutor asks a diagnostic question and does not state the misconception as fact.
  - **Given** any feedback, **then** it contains no shaming, comparative, or ability-labelling language (checked by the Safety Guard).
- **Dependencies:** Misconception Classifier, verifier
- **Out of scope:** Showing misconception codes to students
- **Success metric:** Misconception labels agree with human reviewer judgement at the agreed evaluation threshold
- **Non-functional notes:** Tutor language is plain English

#### STU-05: Full solution only after meaningful effort
**As a** student, **I want** to see a full worked solution only after meaningful effort or configured support steps, **so that** I learn the method instead of copying the answer.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-05, FR-06, Section 12.1
- **Acceptance criteria:**
  - **Given** I ask for the answer below hint level 5, **when** the Hint Policy Engine evaluates the request, **then** the tutor gives the next permitted hint and does not reveal the answer.
  - **Given** the policy conditions for level 5 are met, **when** I request the solution, **then** a worked solution is shown and a transfer question follows.
  - **Given** a solution is shown, **then** the audit log records hint level, attempt count, and policy version.
  - **Given** I try to bypass the policy through prompt injection, **then** the request is blocked and logged as a safety event.
- **Dependencies:** Hint Policy Engine, Safety Guard
- **Out of scope:** Teacher-configured per-student policy overrides
- **Success metric:** Answer exposed before the permitted stage in fewer than 2% of sessions
- **Non-functional notes:** Leakage check runs deterministically on every tutor turn

#### STU-06: Test understanding with a similar question
**As a** student, **I want** to try a similar question after finishing, **so that** I can check I can solve it without help.

- **Epic:** E1 | **Priority:** P0 | **Linked requirements:** FR-10
- **Acceptance criteria:**
  - **Given** I complete a problem, **then** a near-transfer question is offered with different context or values, drawn only from approved questions.
  - **Given** I start the transfer question, **then** no hints are given before my first independent attempt.
  - **Given** I complete or decline the transfer question, **then** the outcome (correct, incorrect, or skipped) is recorded, and a skipped transfer does not raise learner confidence.
- **Dependencies:** Question bank, pgvector candidate retrieval, learner model
- **Out of scope:** Student choice of transfer difficulty
- **Success metric:** At least 80% of completed sessions are followed by a transfer problem
- **Non-functional notes:** Transfer item selection is deterministic after the pgvector shortlist

#### STU-07: See my progress
**As a** student, **I want** to see my progress, **so that** I know what to practise next and can see I am improving.

- **Epic:** E2 | **Priority:** P1 | **Linked requirements:** FR-08, FR-11
- **Acceptance criteria:**
  - **Given** I open my dashboard, **then** I see recent sessions, current skills, independent success rate, hint usage trend, transfer results, and recommended next practice.
  - **Given** any dashboard text, **then** it uses encouraging, non-comparative language and no labels such as "weak" or "low ability".
  - **Given** I have no completed sessions, **then** I see a friendly empty state with a suggested first question.
  - **Given** I am a student, **then** I can only see my own data.
- **Dependencies:** Learner model, `learner-rollup` job
- **Out of scope:** Leaderboards or peer comparison
- **Success metric:** Baseline engagement measured; no target before pilot
- **Non-functional notes:** Accessible charts with text alternatives

#### STU-08: Diagrams that help
**As a** student, **I want** diagrams when they help solve the question, **so that** I can see the relationships in the problem.

- **Epic:** E1 | **Priority:** P1 | **Linked requirements:** FR-09
- **Acceptance criteria:**
  - **Given** a question requires a diagram, **then** an approved, validated SVG is shown with a text description.
  - **Given** the diagram fails validation or has no approved version, **then** the question is withheld and flagged for review.
  - **Given** I use a screen reader or keyboard only, **then** the diagram has a text alternative and meaning does not depend on colour alone.
- **Dependencies:** Diagram service, Vercel Blob storage
- **Out of scope:** Student-drawn diagrams
- **Success metric:** 100% of served diagrams have a stored validation result and version
- **Non-functional notes:** Meets the accessibility requirements in Section 11.4

### 6.5 Teacher and tutor stories

#### EDU-01: See students needing review
**As a** teacher, **I want** to see which students need review, **so that** I spend my time where it matters most.

- **Epic:** E2 | **Priority:** P0 | **Linked requirements:** FR-12
- **Acceptance criteria:**
  - **Given** I open the cohort view, **then** students are prioritised using evidence such as repeated misconceptions, low transfer success, or high hint dependency, with the reason shown.
  - **Given** a student has too little evidence, **then** the view says "not enough evidence yet" instead of flagging them.
  - **Given** I am a teacher, **then** I only see students assigned to me.
- **Dependencies:** Learner model, cohort assignment
- **Out of scope:** Automated notifications to parents or students
- **Success metric:** Teacher review time per flagged student (measured in pilot)
- **Non-functional notes:** Loads in under 3 seconds for 150 synthetic students

#### EDU-02: Understand why a student was flagged
**As a** teacher, **I want** every flag to show its evidence, **so that** I can judge it with my own professional knowledge.

- **Epic:** E2 | **Priority:** P0 | **Linked requirements:** FR-12, FR-15, Section 13.2
- **Acceptance criteria:**
  - **Given** a flagged student, **then** the flag lists linked attempts, skills, timing, hint levels, and sessions.
  - **Given** any recommendation, **then** it shows confidence, limitations, suggested action, and review status.
  - **Given** a recommendation has low confidence, **then** it is labelled as such and not presented as established fact.
- **Dependencies:** `insight-drafts` job, audit event store
- **Out of scope:** Placement, grading, or admissions suggestions
- **Success metric:** At least 95% of teacher-facing claims link to source events
- **Non-functional notes:** Evidence links respect role-based access

#### EDU-03: Replay a tutoring session
**As a** teacher, **I want** to replay a tutoring session, **so that** I can see how the student's reasoning developed without reading raw transcripts.

- **Epic:** E3 | **Priority:** P0 | **Linked requirements:** FR-13
- **Acceptance criteria:**
  - **Given** I open a session replay for my student, **then** I see question version, diagram version, student responses, verifier result, hint level, tutor output, misconception classification, and learner-model changes per turn.
  - **Given** I am not assigned to the student, **when** I request the replay, **then** access is denied and the denial is logged.
  - **Given** I am an administrator or authorised reviewer, **then** each turn also links to its Langfuse trace.
- **Dependencies:** Persisted turns, audit events, Langfuse trace IDs
- **Out of scope:** Editing past session records
- **Success metric:** 100% of tutor turns are replayable
- **Non-functional notes:** Student data in traces is pseudonymised

#### EDU-04: Override a recommendation
**As a** teacher, **I want** to override a recommendation, **so that** my professional judgement always has the final say.

- **Epic:** E3 | **Priority:** P0 | **Linked requirements:** FR-12, FR-15, Section 12.2
- **Acceptance criteria:**
  - **Given** I override a recommendation, **then** a rationale is required.
  - **Given** the override is saved, **then** the original recommendation and evidence remain stored and unchanged.
  - **Given** the override is saved, **then** an audit event records who, when, and why.
  - **Given** I do not hold the teacher role for this student, **then** I cannot override.
- **Dependencies:** Recommendation records, RBAC, audit service
- **Out of scope:** Bulk overrides
- **Success metric:** 100% of overrides are audit-logged (critical regression test)
- **Non-functional notes:** Override action is idempotent

#### EDU-05: Group students with similar needs
**As a** teacher, **I want** students grouped by skill and misconception pattern, **so that** I can plan small-group activities efficiently.

- **Epic:** E2 | **Priority:** P1 | **Linked requirements:** FR-12, Section 13
- **Acceptance criteria:**
  - **Given** I open the groups view, **then** each group shows its skill, misconception pattern, number of students and attempts, and confidence.
  - **Given** a group rests on very little evidence, **then** it carries a visible evidence-limit warning.
  - **Given** I am a teacher, **then** groups contain only my assigned students.
- **Dependencies:** Misconception events, `learner-rollup` job
- **Out of scope:** Automatic scheduling of group sessions
- **Success metric:** Teacher-rated usefulness in pilot feedback
- **Non-functional notes:** Groups are recomputed by background job, not per page load

#### EDU-06: Review content quality
**As a** teacher, **I want** to see questions flagged for quality problems, **so that** confusing or incorrect items are fixed before they harm learning.

- **Epic:** E3 | **Priority:** P1 | **Linked requirements:** FR-02, FR-14
- **Acceptance criteria:**
  - **Given** a question is flagged (answer-key inconsistency, ambiguity, unexpected difficulty, duplicate, and so on), **then** it appears in the review queue with the reason and supporting evidence.
  - **Given** a content reviewer approves, rejects, or deprecates an item, **then** the decision is recorded and the item's publication status updates accordingly.
  - **Given** an item is flagged, **then** it is not served to students until cleared.
  - **Given** an item is modified, **then** it is not republished without approval.
- **Dependencies:** `item-quality-scan` job, pgvector duplicate detection
- **Out of scope:** Autonomous question regeneration for learners
- **Success metric:** Time from flag to review decision
- **Non-functional notes:** Only content reviewers and administrators can change publication status

#### EDU-07: Export an intervention summary
**As a** teacher, **I want** to export an intervention summary, **so that** I can prepare human-approved communication or notes.

- **Epic:** E2 | **Priority:** P2 | **Linked requirements:** FR-12, Section 12.2
- **Acceptance criteria:**
  - **Given** I export a summary, **then** it is labelled as an AI-drafted summary requiring human review and includes evidence and limitations.
  - **Given** I export, **then** an audit event records the export.
  - **Given** an export, **then** nothing is sent to parents or students automatically.
- **Dependencies:** Recommendation records, Vercel Blob (if stored)
- **Out of scope:** Automated parent messaging
- **Success metric:** Not applicable for MVP
- **Non-functional notes:** Exports are not stored at publicly guessable URLs

### 6.6 Platform administration stories

#### ADM-01: Manage roles
**As an** administrator, **I want** to manage roles and assignments, **so that** people only access the data their role and cohort allow.

- **Epic:** E4 | **Priority:** P0 | **Linked requirements:** FR-01
- **Acceptance criteria:**
  - **Given** I assign a role or cohort, **then** server-side permissions reflect it immediately.
  - **Given** a user requests data outside their scope, **then** the request is denied and logged.
  - **Given** the Parent role, **then** it exists as reserved but grants no access in the MVP.
- **Dependencies:** Identity provider, RBAC layer
- **Out of scope:** Self-service role requests
- **Success metric:** 100% of authorisation tests pass for all roles
- **Non-functional notes:** Authorisation enforced in the API and database layer

#### ADM-02: Audit trail
**As an** administrator, **I want** an audit trail, **so that** every access, AI action, and human decision can be reviewed.

- **Epic:** E4 | **Priority:** P0 | **Linked requirements:** FR-15
- **Acceptance criteria:**
  - **Given** any listed event (login, record access, question selection, attempt, verifier result, model call, tool call, hint decision, override, export, error), **then** an append-only audit record is created.
  - **Given** I try to update or delete an audit record through the application, **then** the action is impossible.
  - **Given** I search the audit viewer, **then** I can filter by user, student, event type, and time.
- **Dependencies:** Audit service, append-only table
- **Out of scope:** External SIEM integration
- **Success metric:** Audit completeness at 100% of defined events
- **Non-functional notes:** Audit writes must not be skippable by feature code

#### ADM-03: Review AI quality issues
**As an** administrator, **I want** to review AI quality issues, **so that** I can find and fix tutoring problems quickly.

- **Epic:** E4 | **Priority:** P1 | **Linked requirements:** Section 11.2, Section 14.4
- **Acceptance criteria:**
  - **Given** a verifier mismatch, answer-leakage event, schema failure, or safety incident occurs, **then** it appears in the quality-issue list with a link to its trace.
  - **Given** I mark an issue as triaged, **then** the decision and notes are recorded.
- **Dependencies:** Langfuse scores, safety events
- **Out of scope:** Automatic prompt rollback
- **Success metric:** Mean time to triage flagged AI issues
- **Non-functional notes:** Access limited to administrators and authorised reviewers

#### ADM-04: Content publishing controls
**As an** administrator, **I want** only validated and approved questions to be available to students, **so that** learners never see unreviewed content.

- **Epic:** E4 | **Priority:** P0 | **Linked requirements:** FR-02, FR-14
- **Acceptance criteria:**
  - **Given** a question is draft, rejected, deprecated, flagged, or pending review, **then** it is never served to students.
  - **Given** a question is published, **then** it has `validation_status = approved`, `publication_status = published`, and an enabled curriculum scope.
  - **Given** vector search or the practice planner returns candidates, **then** unapproved items are filtered out.
- **Dependencies:** Question versioning, review workflow
- **Out of scope:** Bulk auto-publishing
- **Success metric:** Zero unapproved questions delivered (critical regression test)
- **Non-functional notes:** Publication status changes are audit-logged

#### ADM-05: Model and prompt traceability
**As an** administrator, **I want** every AI-generated tutor turn to record its model, prompt, and policy versions, **so that** I can explain and reproduce any tutoring decision.

- **Epic:** E4 | **Priority:** P0 | **Linked requirements:** Section 9.6, Section 15.5
- **Acceptance criteria:**
  - **Given** a tutor turn is generated, **then** it stores model name and version, prompt template version, hint-policy version, tool results, and the Langfuse trace ID.
  - **Given** I open a turn, **then** I can navigate from the stored record to its trace.
  - **Given** a prompt or model changes, **then** the evaluation suite runs before production deployment.
- **Dependencies:** Langfuse prompt management, CI evaluation gate
- **Out of scope:** Automated A/B routing
- **Success metric:** 100% of tutor turns have complete trace metadata
- **Non-functional notes:** Trace data is pseudonymised

### 6.7 Story summary and release map

| ID | Title | Epic | Priority | Linked requirements |
| --- | --- | --- | --- | --- |
| STU-01 | Attempt before guidance | E1 | P0 | FR-03, FR-05, FR-06 |
| STU-02 | One focused hint at a time | E1 | P0 | FR-05, FR-06 |
| STU-03 | Submit working, not only a final answer | E1 | P0 | FR-03, FR-04 |
| STU-04 | Feedback on why my answer is incorrect | E1 | P0 | FR-04, FR-07 |
| STU-05 | Full solution only after meaningful effort | E1 | P0 | FR-05, FR-06 |
| STU-06 | Test understanding with a similar question | E1 | P0 | FR-10 |
| STU-07 | See my progress | E2 | P1 | FR-08, FR-11 |
| STU-08 | Diagrams that help | E1 | P1 | FR-09 |
| EDU-01 | See students needing review | E2 | P0 | FR-12 |
| EDU-02 | Understand why a student was flagged | E2 | P0 | FR-12, FR-15 |
| EDU-03 | Replay a tutoring session | E3 | P0 | FR-13 |
| EDU-04 | Override a recommendation | E3 | P0 | FR-12, FR-15 |
| EDU-05 | Group students with similar needs | E2 | P1 | FR-12 |
| EDU-06 | Review content quality | E3 | P1 | FR-02, FR-14 |
| EDU-07 | Export an intervention summary | E2 | P2 | FR-12 |
| ADM-01 | Manage roles | E4 | P0 | FR-01 |
| ADM-02 | Audit trail | E4 | P0 | FR-15 |
| ADM-03 | Review AI quality issues | E4 | P1 | Sections 11.2, 14.4 |
| ADM-04 | Content publishing controls | E4 | P0 | FR-02, FR-14 |
| ADM-05 | Model and prompt traceability | E4 | P0 | Sections 9.6, 15.5 |

---

## 7. Scope

### 7.1 MVP in scope

**Curriculum and learning scope**

- Years 5–6 mathematics
- Ratio and proportional reasoning
- Scale and map problems
- Simple rates and unit-rate reasoning
- Multiplicative comparison
- Percentages only where directly related to proportional reasoning
- Text-based and selected diagram-supported questions
- 40–60 validated seed problems
- 10–15 common misconception labels

**Student capabilities**

- Secure login
- Select or receive a recommended mathematics problem
- Submit answer and working in structured text format
- Receive progressive Socratic prompts
- View optional visual representation when appropriate
- See final worked solution under controlled conditions
- Complete a transfer question
- View personal progress dashboard

**Educator capabilities**

- Cohort overview
- Student learning profile
- Session replay
- Misconception trends
- Intervention recommendations
- Question quality flags
- Manual review, acceptance, rejection, and override capability

**AI and workflow capabilities**

- Structured problem parser
- Student-state estimator
- Misconception classifier
- Socratic dialogue generator
- Hint-policy enforcement
- Deterministic verifier
- Tutor-session state machine
- Learner-model update service
- Audit and telemetry service

**Technical capabilities**

- React (TypeScript) student and educator web application
- FastAPI secure API layer
- Google ADK agent orchestration with schema-validated outputs
- PostgreSQL-backed domain data model with pgvector similarity search
- LLM API integration through ADK (Gemini; model configurable via environment variables)
- Deterministic mathematics validation service (SymPy + custom domain rules)
- Role-based access control enforced server-side
- Vercel Blob object storage for diagrams and exports
- Langfuse tracing, prompt versioning, scoring, and evaluation datasets
- Vercel Cron Jobs for scheduled background processing
- GitHub Actions CI/CD with evaluation gates
- Evaluation harness and regression test suite
- Hosting on Vercel; secrets in Vercel Environment Variables

### 7.2 Out of scope for MVP

- Full Years 5–10 mathematics coverage
- Automated marking of high-stakes assessments
- Automated admissions or placement recommendations
- Diagnosing learning difficulties, disability, or behavioural conditions
- Open-ended image or handwritten-work recognition
- Voice tutoring
- Parent accounts and automated parent messaging
- Autonomous content publishing
- Autonomous question generation for immediate learner delivery
- Live group classes
- Native iOS and Android applications
- Full LMS integration
- Multi-language tutoring
- Fully adaptive IRT engine in the first release

---

## 8. Functional requirements

### 8.1 FR-01: Authentication and role-based access

The system shall support the following roles:

| Role | Core permissions |
| --- | --- |
| Student | Access own questions, sessions, progress, recommendations |
| Parent | Not included in MVP; reserved role only |
| Tutor | View assigned students, review sessions, provide notes |
| Teacher | View assigned students and cohorts, review recommendations, override decisions |
| Academic coordinator | View cohort summaries, intervention insights, item-quality indicators |
| Content reviewer | Review and approve/reject questions and diagrams |
| Administrator | Manage users, roles, content policy, system configuration, evaluations, and audit logs |

**Requirements:**

- Users must authenticate before accessing student data.
- A user must only see records within their assigned scope.
- Student data must not be available to unauthorised users.
- Authorisation checks must occur server-side (FastAPI dependency layer; optionally reinforced with Postgres row-level security).
- The system shall log access attempts, including denied requests.

### 8.2 FR-02: Question delivery

The system shall deliver only questions marked as:

```text
validation_status = approved
publication_status = published
curriculum_scope = enabled
```

Every question must include:

- Unique question ID
- Curriculum mapping
- Skill and subskill
- Target difficulty
- Solution path
- Accepted answer specification
- Misconception tags
- Socratic prompt metadata
- Diagram requirement flag
- Validation status
- Version number

The system must not serve questions that are draft, rejected, deprecated, flagged, or pending human review.

### 8.3 FR-03: Student attempt capture

The student shall be able to submit:

- Numeric answer
- Fraction
- Decimal
- Percentage
- Algebraic expression where enabled
- Free-text explanation
- Selected multiple-choice answer where applicable
- "I am not sure where to start" signal
- Confidence rating, optional for MVP

Each attempt shall capture:

```text
student_id
session_id
question_id
timestamp
attempt_number
response_type
response_value
response_duration
confidence_rating
hint_level_at_submission
```

### 8.4 FR-04: Deterministic mathematics verification

The verifier shall evaluate student work before the conversational tutor produces feedback. The verifier is implemented in Python (SymPy plus custom ratio/proportion rules) and exposed to ADK agents as **function tools**; it contains no LLM calls.

Supported validation checks for MVP:

- Integer, decimal, fraction, and percentage equivalence
- Ratio simplification and equivalence
- Proportional scaling
- Unit conversion where included in supported question types
- Valid numeric tolerance and rounding logic
- Correct use of required units
- Accepted alternate answer formats
- Partial-step checking for supported solution paths
- Internal consistency between question data, answer key, and solution plan

The verifier must return a structured result:

```json
{
  "status": "correct | incorrect | partially_correct | cannot_verify",
  "confidence": 0.98,
  "matched_solution_step": "calculate_unit_part",
  "error_category": "none | arithmetic | unit_error | ratio_reversal | incomplete",
  "accepted_answer": false,
  "explanation_constraints": [
    "Do not reveal final answer at current hint level"
  ]
}
```

If the system cannot verify the answer deterministically, it must:

- State that it needs clarification or use a bounded fallback.
- Avoid falsely claiming the student is wrong.
- Escalate the interaction for review if the response remains ambiguous.

### 8.5 FR-05: Socratic tutoring workflow

The tutor shall use a controlled state machine.

```text
Session started
  ↓
Question presented
  ↓
Student first attempt requested
  ↓
Student response captured
  ↓
Mathematics verifier evaluates response
  ↓
Student-state estimator updates learner state
  ↓
Hint-policy engine selects permitted hint level
  ↓
Socratic tutor generates one bounded prompt
  ↓
Student responds
  ↓
Repeat until independent solution, supported completion, or escalation
  ↓
Transfer problem offered
  ↓
Learner model updated
  ↓
Session summary saved
```

The tutor must:

- Ask only one focused question or request per turn.
- Avoid providing the final answer before the policy permits it.
- Use age-appropriate language.
- Acknowledge correct reasoning even when arithmetic is incomplete.
- Identify and address a misconception where evidence is sufficient.
- Avoid claiming certainty when evidence is weak.
- Encourage the student to explain or check their reasoning.
- Offer a transfer question after successful completion or full explanation.

### 8.6 FR-06: Hint policy

The system shall implement the following hint ladder.

| Level | Name | Behaviour |
| --- | --- | --- |
| 0 | Independent attempt | Ask the learner to identify a first step or explain current thinking |
| 1 | Attention orientation | Direct attention to relevant quantities, labels, or relationships |
| 2 | Conceptual scaffold | Ask a focused question about the underlying mathematical concept |
| 3 | Representation support | Offer table, bar model, diagram, number line, or structured setup |
| 4 | Partial worked step | Provide a verified intermediate step and ask the learner to continue |
| 5 | Full worked solution | Provide explanation only after configured conditions, then require retrieval or transfer |

The hint policy must consider:

- Number of attempts
- Student's current answer quality
- Identified misconception
- Time spent
- Prior hint level
- Learner age/year level
- Historical hint dependency
- Teacher-configured support settings
- Whether a student requests the answer directly

The policy must not allow an LLM alone to decide when to reveal answers. The Hint Policy Engine is deterministic Python code (not an LLM agent) and its decision is passed to the Socratic Dialogue Agent as a hard constraint.

### 8.7 FR-07: Misconception classification

The system shall assign misconception labels only from an approved taxonomy (enforced by a Pydantic enum used as the ADK agent's `output_schema`).

Initial example taxonomy:

| Code | Misconception |
| --- | --- |
| `ratio_additive_interpretation` | Treats ratio as an additive relationship rather than multiplicative relationship |
| `ratio_reversal` | Reverses the order of quantities in a ratio |
| `whole_to_part_confusion` | Confuses total quantity with a single ratio part |
| `unit_rate_error` | Calculates or applies unit rate incorrectly |
| `scale_direction_error` | Uses multiplication where division is required, or vice versa |
| `unit_conversion_error` | Applies incorrect conversion between units |
| `arithmetic_error_after_correct_setup` | Correct method but incorrect calculation |
| `irrelevant_operation` | Uses an operation inconsistent with the task |
| `diagram_misread` | Misinterprets relevant visual information |
| `premature_rounding` | Rounds before completing necessary calculation |
| `incomplete_reasoning` | Gives answer without sufficient justification |
| `answer_guessing` | Response pattern indicates unsupported guess; use cautiously |

Each classification shall include:

- Misconception code
- Confidence score
- Supporting evidence
- Alternative plausible labels
- Recommended Socratic prompt type
- Reviewer status where human review occurs

The classifier may retrieve similar labelled examples from **pgvector** (misconception exemplar store) to ground its judgement. The system must not present a low-confidence misconception label as established fact.

### 8.8 FR-08: Learner model

The learner model shall maintain skill-level information separately from individual question results.

Required learner-model fields:

```json
{
  "student_id": "uuid",
  "skill_id": "ratio.proportional_reasoning",
  "mastery_estimate": 0.0,
  "mastery_confidence": 0.0,
  "recent_accuracy": 0.0,
  "median_response_seconds": 0,
  "attempt_count": 0,
  "independent_success_rate": 0.0,
  "hint_dependency_profile": {},
  "misconception_distribution": {},
  "transfer_success_rate": 0.0,
  "recommended_next_skill": "string",
  "last_updated_at": "timestamp"
}
```

The MVP may use a transparent rules-based mastery estimator rather than a full IRT or Bayesian Knowledge Tracing model.

Example MVP rule:

```text
Increase mastery modestly when the student solves a target-skill item independently.
Increase mastery slightly when the student solves after Level 1–2 support.
Do not treat Level 4–5 guided completion as independent mastery.
Require successful transfer before marking stronger confidence.
Reduce confidence, not necessarily mastery, when recent evidence is inconsistent.
```

### 8.9 FR-09: Diagram support

For questions marked `has_diagram = true`, the system shall:

- Retrieve an approved diagram or generate from a validated diagram specification.
- Render the diagram deterministically as SVG.
- Validate labels, visual structure, mathematical constraints, and accessibility text.
- Present the diagram with a textual description.
- Store version, hash, and validation result (SVG file in **Vercel Blob**; metadata in Postgres).

The diagram service must not publish an image directly from an unvalidated LLM response.

### 8.10 FR-10: Transfer question

After a student completes a problem, the system shall offer a near-transfer question that:

- Assesses the same learning objective.
- Uses a different context, values, representation, or surface wording.
- Does not repeat the original answer pattern exactly.
- Is not so different that it requires unintroduced skills.
- Is independently attempted before further tutoring.

Candidate transfer items are shortlisted by **pgvector similarity** (same skill and learning objective, different surface features) from the approved question bank, then filtered and selected by deterministic rules. The transfer outcome shall affect learner confidence and next-practice recommendation.

### 8.11 FR-11: Student dashboard

The student dashboard shall display:

- Recent practice sessions
- Skills currently being practised
- Strengths and next focus areas
- Independent success rate
- Hint usage trend
- Transfer-question results
- Recommended next practice
- Encouraging, non-comparative progress language

The student dashboard must not:

- Rank students publicly
- Present labels such as "weak," "failing," or "low ability"
- Make unsupported claims about ability or future educational outcomes

### 8.12 FR-12: Teacher dashboard

The teacher dashboard shall show:

- Students requiring review
- Skill mastery by learner and cohort
- Common misconception clusters
- Hint dependency patterns
- Recent transfer performance
- Recent tutoring sessions
- Intervention suggestions with evidence
- Content items flagged for review
- Educator review and override controls

Each recommendation must include:

```text
Recommendation
Supporting evidence
Confidence level
Limitations
Suggested next action
Review status
Human reviewer decision
```

### 8.13 FR-13: Session replay

Teachers and authorised reviewers shall be able to replay a tutoring session.

A session replay shall display:

- Question and question version
- Diagram version, if used
- Student responses
- Verifier result per turn
- Hint level
- Tutor output
- Misconception classification
- Learner-model changes
- Model and prompt version
- Teacher comments and overrides
- Audit timestamps
- Deep link to the corresponding Langfuse trace (for admins and authorised reviewers only)

### 8.14 FR-14: Content quality and item assurance

The system shall flag question items for review when there is evidence of:

- Answer-key inconsistency
- Mathematical-verifier failure
- Ambiguous wording
- Unclear diagram
- Excessive student confusion unrelated to target difficulty
- Unexpected difficulty pattern
- Non-functional distractors
- Potential duplication (detected by pgvector near-duplicate search)
- Incorrect curriculum mapping
- Inappropriate language or context
- Insufficient explanation quality

The system shall not automatically publish regenerated or modified questions without approval.

### 8.15 FR-15: Auditability

The system shall create immutable event records for:

- Authentication events
- Access to student records
- Question selection
- Student attempt submissions
- Verifier results
- AI model calls
- Tool calls
- Generated prompts
- Hint-level decisions
- Content flags
- Teacher reviews
- Overrides
- Exports
- Errors and safety incidents

Audit events are stored in an append-only Postgres table (updates and deletes blocked by database permissions/triggers). Langfuse traces complement, but do not replace, the Postgres audit log.

NIST's AI RMF highlights the importance of documenting system limitations, intended use, and human oversight mechanisms; this is directly relevant to an educational AI workflow.

### 8.16 FR-16: Background processing (Vercel Cron Jobs)

The system shall run scheduled jobs via Vercel Cron Jobs that call protected FastAPI endpoints. Initial job catalogue:

| Job | Purpose | Suggested cadence |
| --- | --- | --- |
| `learner-rollup` | Recompute aggregated learner-skill state from recent events | Hourly |
| `insight-drafts` | Generate draft teacher intervention recommendations (Teacher Insight Agent) | Daily |
| `item-quality-scan` | Flag questions with verifier mismatches, difficulty anomalies, or duplicates | Daily |
| `embedding-sync` | Embed new/changed approved questions and misconception exemplars into pgvector | Hourly |
| `retention-purge` | Apply retention policy to chat logs, attempts, traces, and blobs | Daily |
| `eval-nightly` | Optional: trigger nightly regression eval run and push scores to Langfuse | Nightly |

Requirements:

- Every cron endpoint requires the `CRON_SECRET` bearer token; unauthenticated calls are rejected and logged.
- Jobs must be **idempotent** and record runs in a `job_run` table (start, end, status, processed counts).
- Jobs must process work in bounded batches so they finish within the function duration limit and can resume on the next invocation.
- Job failures raise an alert (Langfuse score and/or log alert) and are visible to administrators.
- If a job outgrows cron-style execution, the open decision in [Section 22](#22-open-decisions) covers moving it to a queue-based mechanism.

---

## 9. Multi-agent design (Google ADK)

### 9.1 Design principle

The term "multi-agent" must not mean autonomous agents independently changing data or tutoring policy. SolvePath uses agents as bounded, schema-driven services coordinated by a deterministic orchestration layer.

The live tutoring flow must use explicit state transitions, tool permissions, timeouts, and fallbacks.

### 9.2 How Google ADK is used

| ADK concept | SolvePath usage |
| --- | --- |
| `LlmAgent` | Student-State Agent, Misconception Classifier, Socratic Dialogue Agent, Safety Guard (LLM check), Diagram Agent, Teacher Insight Agent |
| Custom `BaseAgent` (no LLM) | Mathematics Verifier, Hint Policy Engine, Practice Planner, Problem Context loader: deterministic Python steps wrapped as agents |
| `SequentialAgent` | The per-turn tutoring pipeline (fixed order, no agent autonomy over routing) |
| `LoopAgent` | Bounded regenerate-on-block loop (max 2 iterations) between Socratic Dialogue Agent and Safety Guard, then deterministic fallback prompt |
| `output_schema` (Pydantic) | Every LLM agent returns schema-validated JSON; orchestrator rejects anything invalid |
| `output_key` + session state | Hands structured results between steps (e.g. `verifier_result`, `hint_decision`, `misconception`) |
| Function tools | SymPy verifier calls, question lookup, pgvector retrieval, diagram render request |
| Callbacks (`before_model`, `after_model`, `before_tool`) | Prompt-injection screening, answer-leakage checks, tool allow-listing, Langfuse span metadata |
| `Runner` + session service | Run one turn per API request; session state persisted in Postgres so serverless invocations stay stateless |

> **Note:** An ADK `LlmAgent` that uses `output_schema` cannot call tools. Design accordingly: deterministic tools run in earlier pipeline steps and write results into session state; LLM agents read them from state.

### 9.3 Per-turn pipeline

```text
FastAPI endpoint (authenticated, authorised)
  ↓
Tutor Orchestrator (deterministic Python: loads session, enforces state machine)
  ↓  invokes ADK Runner with SequentialAgent:
  1. ProblemContextAgent          (BaseAgent, no LLM)  → question, solution plan, accepted answer spec
  2. MathVerifierAgent            (BaseAgent, no LLM)  → verifier_result
  3. StudentStateAgent            (LlmAgent, schema)   → student_state
  4. MisconceptionClassifierAgent (LlmAgent, schema)   → misconception (taxonomy enum only)
  5. HintPolicyEngine             (BaseAgent, no LLM)  → hint_decision (level, reveal permissions)
  6. LoopAgent (max 2):
       SocraticDialogueAgent      (LlmAgent, schema)   → candidate tutor turn
       SafetyGuard                (callback + LlmAgent)→ allow | block | revise | escalate
  7. Deterministic fallback prompt if loop exhausts without an allowed turn
  ↓
Orchestrator validates schema again → persists turn + audit events → returns response
```

### 9.4 Agent responsibilities

| Agent/service | Type | Primary responsibility | Allowed actions | Prohibited actions |
| --- | --- | --- | --- | --- |
| Tutor Orchestrator | Deterministic Python | Controls session flow and state transitions | Route requests, call ADK runner, persist approved state | Override verifier, bypass hint policy |
| Problem Parser | LlmAgent (offline/ingest) or deterministic | Convert question into structured representation | Extract entities, givens, target, conditions | Change question content |
| Mathematics Verifier | Deterministic (SymPy) | Validate answers and intermediate steps | Run calculation and equivalence checks | Generate pedagogical advice without constraints |
| Student-State Agent | LlmAgent | Estimate understanding and current barriers | Produce structured evidence and confidence | Determine high-stakes educational outcome |
| Misconception Classifier | LlmAgent | Identify likely misconception from approved taxonomy | Suggest label and remediation type | Invent unsupported labels |
| Socratic Dialogue Agent | LlmAgent | Produce one natural-language prompt | Generate schema-valid question based on policy | Reveal answer before permitted level |
| Hint Policy Engine | Deterministic | Determine allowable assistance level | Select hint tier and next action type | Generate content |
| Diagram Agent | LlmAgent + deterministic renderer | Produce/retrieve validated visual representation | Create diagram specification, request rendering | Publish unvalidated image |
| Practice Planner | Deterministic + pgvector | Recommend approved next item | Select from question bank | Generate unreviewed questions for student |
| Safety Guard | Callbacks + LlmAgent | Validate output and detect policy issues | Allow, block, revise, escalate | Modify learner records directly |
| Teacher Insight Agent | LlmAgent (cron-driven) | Summarise evidence for educator review | Generate draft summary | Make placement, grading, or admissions decision |

### 9.5 Agent communication standard

Every agent response must use a versioned JSON schema (Pydantic models shared between agents, API, and tests).

Example Socratic Dialogue Agent response:

```json
{
  "schema_version": "1.0",
  "action": "ask_socratic_question",
  "hint_level": 2,
  "message": "If 5 equal parts represent 450 g, what calculation could find the value of one part?",
  "expected_response_types": [
    "numeric_expression",
    "free_text_explanation"
  ],
  "target_skill": "ratio.unitising",
  "target_misconception": "whole_to_part_confusion",
  "answer_reveal_risk": "low",
  "requires_safety_review": false
}
```

The orchestrator must reject outputs that fail schema validation or violate policy constraints.

### 9.6 Model configuration

- Models are accessed through ADK (Gemini via Google AI Studio API key or Vertex AI credentials).
- Model names are **environment variables** per agent (for example `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`) so cheaper/faster models can be used for classification and stronger models for dialogue.
- Model version, prompt template version, and policy version are recorded on every tutor turn (ADM-05).
- Prompts are versioned in Langfuse Prompt Management and fetched at runtime with a pinned version label per environment.

---

## 10. Data model

### 10.1 Core entities

| Entity | Description |
| --- | --- |
| User | Authenticated person using the system |
| Role | Permission profile assigned to user |
| Student profile | Student learning identity and non-sensitive profile metadata |
| Cohort | Group of students assigned to teacher/tutor/programme |
| Skill | Curriculum-aligned knowledge or reasoning component |
| Question | Approved mathematics assessment/practice item |
| Question version | Versioned question content and validation information |
| Question embedding | pgvector embedding of an approved question version (similarity, dedup, transfer candidates) |
| Misconception exemplar | Labelled example with embedding used for classifier grounding |
| Diagram asset | Validated visual representation (metadata in Postgres; SVG in Vercel Blob) |
| Tutoring session | A student's interaction around one question |
| Student attempt | A discrete submitted response or working step |
| Tutor turn | AI-generated, policy-checked tutor prompt (includes `langfuse_trace_id`) |
| Verifier result | Deterministic validation outcome |
| Misconception event | Evidence-based misconception classification |
| Learner-skill state | Aggregated mastery and confidence for student/skill |
| Transfer attempt | Result from a near-transfer item |
| Intervention recommendation | Teacher-reviewable suggested action |
| Content-review item | Flagged question, diagram, or explanation |
| Audit event | Immutable record of system activity |
| Job run | Record of each Vercel Cron job execution |
| Evaluation case | Labelled test case used for offline and regression evaluation (mirrored as a Langfuse dataset) |

### 10.2 pgvector usage

| Use | Table / column | Notes |
| --- | --- | --- |
| Near-duplicate question detection | `question_embedding.embedding` | Cosine similarity threshold flags items for review (FR-14) |
| Transfer-question candidates | `question_embedding.embedding` | Same skill/objective, different surface features; final choice made by deterministic rules (FR-10) |
| Misconception exemplar retrieval | `misconception_exemplar.embedding` | Top-k labelled examples given to the classifier as context (FR-07) |
| Curriculum/solution-method lookup (optional) | `curriculum_chunk.embedding` | Only if needed for teacher-facing explanations |

Implementation notes:

- Enable with `CREATE EXTENSION IF NOT EXISTS vector;` in the first Alembic migration.
- Fix the embedding dimension to match the chosen embedding model; changing models requires a re-embedding migration (`embedding-sync` job supports this).
- Use an HNSW or IVFFlat index appropriate to dataset size (the MVP dataset is small; exact search is acceptable initially).
- Vector search never bypasses publication status: results are always joined to `validation_status = approved` and `publication_status = published`.

### 10.3 Minimal question schema

```json
{
  "question_id": "ratio_0147",
  "version": 1,
  "publication_status": "published",
  "validation_status": "approved",
  "curriculum": {
    "jurisdiction": "Victoria",
    "year_level": 6,
    "topic": "Number",
    "subtopic": "Ratio and proportion"
  },
  "learning_objective": "Use multiplicative reasoning to solve ratio problems.",
  "difficulty": {
    "band": "medium",
    "estimated_difficulty": 0.55,
    "reasoning_depth": "multi_step_application"
  },
  "problem_type": "word_problem",
  "stem": "A recipe uses flour and sugar in the ratio 5:2...",
  "accepted_answer_spec": {
    "type": "numeric",
    "value": 180,
    "unit": "g",
    "tolerance": 0
  },
  "solution_steps": [
    "identify_ratio_parts",
    "calculate_unit_part",
    "scale_sugar_quantity",
    "verify_ratio"
  ],
  "misconception_tags": [
    "ratio_additive_interpretation",
    "ratio_reversal",
    "whole_to_part_confusion"
  ],
  "socratic_prompt_set_id": "ratio_unitising_v1",
  "diagram_id": null
}
```

### 10.4 Minimal tutoring-session schema

```json
{
  "session_id": "uuid",
  "student_id": "uuid",
  "question_id": "ratio_0147",
  "question_version": 1,
  "state": "active",
  "current_hint_level": 2,
  "attempt_count": 2,
  "current_skill_state": {
    "skill_id": "ratio.proportional_reasoning",
    "mastery_estimate": 0.58,
    "confidence": 0.71
  },
  "identified_misconceptions": [
    {
      "code": "whole_to_part_confusion",
      "confidence": 0.81
    }
  ],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## 11. Non-functional requirements

### 11.1 Security and privacy

| Requirement | Description |
| --- | --- |
| Authentication | All users must authenticate through a secure identity provider (see [open decisions](#22-open-decisions)) |
| Authorisation | Enforce role and cohort-based access at API and database layer |
| Least privilege | Grant only permissions required for assigned role |
| Encryption | Encrypt data in transit (HTTPS everywhere) and at rest (managed Postgres and Vercel Blob) |
| Secrets management | All API keys and credentials stored as **Vercel Environment Variables** (mark sensitive values as Sensitive); never exposed in client code or committed to Git |
| Data minimisation | Collect only information necessary for learning and operations |
| Synthetic demo data | Public capstone environment must use synthetic student identities and records |
| Telemetry privacy | Pseudonymous student IDs only in Langfuse; no names, emails, or free-text PII; apply a masking function before export |
| Audit logs | Maintain reviewable records of access, model actions, and human overrides |
| Retention controls | Define retention duration for chat logs, attempts, model traces, and diagrams; enforced by `retention-purge` job |
| Blob access | Vercel Blob objects served via controlled routes; do not expose student-specific exports at guessable public URLs |
| Incident response | Document incident reporting, access revocation, and data deletion procedures |

### 11.2 AI safety and quality

| Requirement | Description |
| --- | --- |
| No unsupported claims | Tutor must not assert facts about a student's ability without evidence |
| No answer leakage | Final answers restricted by hint policy; deterministic leakage check on every tutor turn |
| Math verification first | Deterministic verifier evaluated before AI feedback is generated |
| Bounded output | Agents must return schema-validated structured outputs |
| Prompt-injection controls | Retrieved content and student input treated as untrusted data; ADK callbacks screen input and restrict tools |
| Model traceability | Store model/provider/version and prompt template version (Postgres + Langfuse) |
| Human review | Teachers can inspect, correct, reject, and override recommendations |
| Fail safely | If validation fails, provide a limited fallback and flag for review |
| Content governance | Students see only approved content |
| Transparent limits | Educators can see limitations and confidence of recommendations |

### 11.3 Performance

| Area | MVP requirement |
| --- | --- |
| Initial question load | Under 2 seconds under normal demo load |
| Deterministic answer check | Under 500 ms for supported question types |
| Tutor response | Target under 5 seconds for standard interaction (stream tokens to the UI where possible) |
| Dashboard load | Under 3 seconds for a cohort of up to 150 synthetic students |
| Session persistence | Each turn persisted before response is returned |
| Tool timeout | External model/tool calls bounded by configurable timeout |
| Retry behaviour | Idempotent retries for safe read operations only |
| Serverless fit | Cold-start and bundle-size budgets tracked in CI (see [risks](#20-risks-and-mitigations)) |

### 11.4 Accessibility

The application should support:

- Keyboard navigation
- Accessible labels and form controls
- Clear colour contrast
- Text alternatives for diagrams
- Responsive layout
- Plain English tutor language
- Avoidance of colour-only meaning
- Accessible equation display (for example KaTeX/MathML output)
- Screen-reader compatible navigation where feasible

---

## 12. Safety and policy requirements

### 12.1 Tutor behavioural policy

The tutor must:

- Encourage effort and constructive thinking.
- Use respectful, non-shaming language.
- Ask one manageable question at a time.
- Avoid overly verbose explanations during active problem-solving.
- State uncertainty when it cannot confidently interpret a response.
- Encourage students to verify solutions.
- Avoid fabricated curriculum claims.
- Avoid comparisons with other students.
- Avoid making claims about intelligence, future success, or suitability for selective-entry placement.

The tutor must not:

- Provide the answer immediately after a student asks.
- Complete a high-stakes assessment on behalf of a student.
- Ask for unnecessary personal information.
- Give mental-health, medical, legal, or safeguarding advice beyond directing the student to a trusted adult or designated support channel.
- Use punitive, humiliating, manipulative, or overly persuasive language.
- Promise that using the tool guarantees examination success.
- Use student data to infer sensitive attributes.

### 12.2 High-stakes decision boundary

SolvePath must not autonomously:

- Grade formal school assessments.
- Determine academic placement.
- Determine selective-school admissions readiness.
- Recommend student exclusion, discipline, or remedial classification.
- Send parent communications.
- Make welfare or safeguarding decisions.

The system can prepare a **draft, evidence-linked educator summary**, but a qualified adult must make any consequential decision.

### 12.3 Input safety

The system shall detect and handle:

- Requests to reveal answers
- Prompt-injection attempts
- Requests to bypass tutoring policy
- Inappropriate or abusive language
- Personal information in free-text responses
- Student requests for help with an active, high-stakes assessment
- Requests to impersonate the student in submitted work

---

## 13. Teacher intervention recommendations

### 13.1 Recommendation types

The system may recommend:

- A small-group activity on a specific skill
- A visual representation or model
- Untimed practice before timed practice
- Retrieval practice after guided completion
- A teacher review of repeated high-hint sessions
- A question-bank review if an item appears defective
- A transfer assessment to confirm learning
- A lower- or higher-complexity approved question set

### 13.2 Recommendation format

Every recommendation must use a standard template:

```text
Recommendation:
Use a 15-minute small-group visual-ratio activity.

Reason:
Four students repeatedly treated ratios as additive comparisons.

Evidence:
- 9 relevant attempts across 4 students
- 67% of errors labelled ratio_additive_interpretation
- 3 students required Hint Level 3 or above
- Transfer-question success rate: 25%

Confidence:
Moderate

Limitations:
Evidence is from a small number of recent practice items and should
be reviewed alongside teacher observation.

Suggested educator action:
Review the flagged student sessions and assign approved bar-model
ratio activities.
```

Recommendations are generated as drafts by the `insight-drafts` Vercel Cron job and remain in "pending review" status until a human accepts, rejects, or overrides them.

---

## 14. Evaluation plan

### 14.1 Offline evaluation dataset

Create a labelled evaluation suite containing at least:

| Test category | Initial target cases |
| --- | --- |
| Correct answers in varied formats | 40 |
| Incorrect arithmetic after correct method | 20 |
| Ratio reversal | 20 |
| Additive-ratio misconception | 20 |
| Unit conversion mistakes | 15 |
| Partially correct working | 20 |
| Ambiguous student messages | 15 |
| Multiple valid solution methods | 15 |
| Requests for direct answers | 15 |
| Prompt-injection attempts | 15 |
| Diagram-dependent questions | 15 |
| Unsupported or malformed questions | 10 |
| Teacher-summary accuracy cases | 20 |
| Access-control test cases | 20 |

The suite is stored in the repository (versioned JSONL) and mirrored to **Langfuse Datasets** so experiment runs can be compared across prompt, model, and policy versions.

### 14.2 Human evaluation rubric

Human reviewers score randomly sampled tutor turns from 1–5 (scores recorded in Langfuse via annotation queues or API).

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Mathematical accuracy | Incorrect or misleading | Mostly correct with minor issue | Fully correct and verifier-aligned |
| Socratic quality | Gives answer or vague response | Some guiding value | Targets the exact next reasoning step |
| Hint calibration | Too much or too little help | Reasonable but imperfect | Minimum effective support |
| Misconception alignment | Misidentifies error | Plausible but uncertain | Accurately addresses evidenced misconception |
| Clarity | Confusing | Understandable | Simple, precise, age-appropriate |
| Tone | Discouraging or inappropriate | Neutral | Supportive and confidence-building |
| Safety | Policy breach | Minor concern | Fully policy-compliant |

### 14.3 Regression testing

A deployment must fail if any critical regression test shows:

- Incorrect mathematical feedback
- Answer leakage before allowed stage
- Access to unauthorised student data
- Invalid diagram published
- AI output outside schema
- Unlogged teacher override
- Unapproved question delivered
- Misconception label presented as certain despite low confidence

### 14.4 Automated scoring in Langfuse

| Score name | Source | Type |
| --- | --- | --- |
| `verifier_agreement` | Compare tutor feedback to verifier result | Deterministic |
| `answer_leakage` | Check tutor message for final answer / forbidden reveal | Deterministic |
| `hint_policy_match` | Compare generated hint level to `hint_decision` | Deterministic |
| `schema_valid` | Pydantic validation of agent outputs | Deterministic |
| `socratic_quality` | LLM-as-judge using rubric above (spot-checked by humans) | Model-based |
| `tone_safety` | LLM-as-judge | Model-based |
| `human_rubric_*` | Human reviewers | Manual |

Critical deterministic scores gate the CI/CD pipeline (see [Section 17](#17-cicd-with-github-actions)).

---

## 15. Technical architecture

### 15.1 Technology stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Student and teacher UI | **React 18 + TypeScript** (Vite SPA) | React Router, TanStack Query, Tailwind CSS, KaTeX for equations, accessible component library (for example Radix primitives) |
| Authentication | Clerk, Auth0, or equivalent OIDC provider | Open decision; JWT verified in FastAPI |
| API layer | **Python 3.12 + FastAPI** | Pydantic v2 models, async endpoints, SSE streaming for tutor responses; deployed as Vercel Python Functions |
| Agent orchestration | **Google ADK (Python)** | `SequentialAgent`, `LoopAgent`, `LlmAgent`, custom `BaseAgent`, callbacks, function tools |
| LLM provider | Gemini via ADK (Google AI Studio key or Vertex AI) | Model names configured through env vars |
| Relational data | **PostgreSQL** (managed, via Vercel Marketplace, for example Neon) | SQLAlchemy 2 + Alembic migrations; use pooled connection string for serverless |
| Vector search | **pgvector** extension in the same Postgres | Question, exemplar, and optional curriculum embeddings |
| Mathematics verification | Python module using **SymPy** plus custom ratio/proportion rules | Exposed to agents as function tools |
| Diagrams | Structured diagram specification rendered deterministically to SVG | SVG files stored in Vercel Blob |
| Object storage | **Vercel Blob** | Diagrams, content imports, teacher exports |
| Observability and evals | **Langfuse** (Cloud or self-hosted) | Tracing via OpenTelemetry/OpenInference instrumentation for ADK; prompt management; datasets; scores |
| Background jobs | **Vercel Cron Jobs** → protected FastAPI endpoints | Idempotent, batched jobs recorded in `job_run` |
| CI/CD | **GitHub Actions** | Lint, test, eval gate, migrate, deploy |
| Hosting | **Vercel** | Two Vercel projects from one monorepo (web and api) |
| Secrets | **Vercel Environment Variables** | Per-environment values; GitHub Secrets only for CI deployment credentials |

### 15.2 Architecture flow

```text
Browser (React SPA on Vercel)
        ↓  HTTPS (same-origin /api/* rewrite to API project)
FastAPI on Vercel Python Functions
  ├─ Auth middleware (JWT verification, role + cohort scope)
  ├─ Audit middleware (append-only audit events)
  ↓
Tutor Orchestrator / State Machine (deterministic)
        ↓
Google ADK Runner  ──────────────►  Langfuse (traces, prompts, scores)
  ├─ Problem Context loader
  ├─ Mathematics Verifier (SymPy tools)
  ├─ Student-State Agent
  ├─ Misconception Classifier  ◄──── pgvector exemplar retrieval
  ├─ Hint Policy Engine
  ├─ Socratic Dialogue Agent + Safety Guard (bounded loop)
  ├─ Learner Model Service
  └─ Audit Event Service
        ↓
PostgreSQL (+ pgvector)      Vercel Blob (diagrams, exports)
        ↑
Vercel Cron Jobs → /api/jobs/* (learner-rollup, insight-drafts, item-quality-scan,
                    embedding-sync, retention-purge, eval-nightly)
        ↓
Teacher Dashboard and Review Workflows (React)
```

### 15.3 Architecture principle

For live tutoring, use a **state machine first** and LLMs second.

The system should not use autonomous loops such as:

```text
Agent decides what to do
  ↓
Agent calls another agent
  ↓
Agent keeps debating
  ↓
Agent writes to production data
```

Instead:

```text
Orchestrator applies policy
  ↓
Calls one bounded service
  ↓
Validates structured result
  ↓
Persists event
  ↓
Moves to approved next state
```

This design is more testable, cost-controlled, auditable, and appropriate for educational use.

### 15.4 Vercel deployment topology

| Project | Root directory | Contents | Notes |
| --- | --- | --- | --- |
| `solvepath-web` | `apps/web` | React SPA | SPA fallback rewrite to `index.html`; rewrite `/api/:path*` to the API project so the browser sees one origin (no CORS) |
| `solvepath-api` | `apps/api` | FastAPI + ADK + verifier | Entrypoint `api/index.py` exposing `app`; `vercel.json` defines function duration and cron schedules |

Environments: **Development** (local `vercel env pull`), **Preview** (one per pull request, pointing at a Postgres branch or a dedicated preview database and a Langfuse preview project/environment tag), **Production** (synthetic data only for the public capstone).

Sample `apps/api/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }],
  "functions": {
    "api/index.py": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/jobs/learner-rollup",   "schedule": "0 * * * *" },
    { "path": "/jobs/embedding-sync",   "schedule": "15 * * * *" },
    { "path": "/jobs/insight-drafts",   "schedule": "0 18 * * *" },
    { "path": "/jobs/item-quality-scan","schedule": "30 18 * * *" },
    { "path": "/jobs/retention-purge",  "schedule": "0 19 * * *" }
  ]
}
```

> Cron frequency, function duration, and bundle-size limits depend on the Vercel plan. Confirm limits against the current Vercel documentation before finalising schedules (for example, hourly crons are not available on the free tier).

### 15.5 Langfuse observability design

| Aspect | Design |
| --- | --- |
| Instrumentation | OpenTelemetry/OpenInference instrumentation for Google ADK exports spans to Langfuse's OTLP endpoint |
| Trace unit | One trace per tutor turn; `session_id` = tutoring session ID; `user_id` = pseudonymous student ID |
| Spans | One span per ADK agent step and tool call (verifier, retrieval, hint policy, safety guard) |
| Metadata | `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment` |
| Prompt management | System prompts and Socratic prompt sets stored and versioned in Langfuse; production pins a labelled version |
| Scores | Deterministic and model-based scores attached to traces (see [Section 14.4](#144-automated-scoring-in-langfuse)) |
| Datasets and experiments | Evaluation cases run as Langfuse experiments from CI; results compared with baseline |
| Cost and latency | Per-agent token usage, cost, and latency tracked; budgets alert when exceeded |
| Privacy | Masking function strips PII before export; no real student identities in public environments |
| Flush behaviour | Always flush the Langfuse client before the serverless function returns, otherwise spans can be lost |

### 15.6 Serverless design constraints

- **Stateless functions:** persist ADK session state in Postgres (database-backed session service); never rely on in-memory state between requests.
- **Connection pooling:** use the pooled Postgres connection string for request handlers and the unpooled string for migrations.
- **Streaming:** use Server-Sent Events from FastAPI for tutor responses to keep perceived latency low.
- **Bundle size and cold starts:** ADK, SymPy, and SQLAlchemy dependencies can be heavy; monitor deploy size and cold-start time in CI, and lazy-import heavy modules.
- **Time limits:** all LLM/tool calls use explicit timeouts well below the function duration limit; long work moves to cron-driven batched jobs.
- **Fallback hosting:** if Vercel limits are hit, the FastAPI app is container-friendly and can move to a container host without code changes (see [open decisions](#22-open-decisions)).

---

## 16. Repository, environments, and configuration

### 16.1 Proposed monorepo structure

```text
solvepath/
├─ apps/
│  ├─ web/                         # React + TypeScript (Vite)
│  │  ├─ src/
│  │  │  ├─ features/student/      # practice, tutor chat, progress dashboard
│  │  │  ├─ features/educator/     # cohort, learner profile, replay, review queue
│  │  │  ├─ features/admin/        # audit viewer, content review, config
│  │  │  └─ lib/                   # api client, auth, KaTeX components
│  │  └─ vercel.json
│  └─ api/                         # FastAPI + Google ADK
│     ├─ api/index.py              # Vercel entrypoint (exports FastAPI app)
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ core/                  # config, security, rbac, audit, langfuse setup
│     │  ├─ routers/               # sessions, questions, dashboards, review, jobs, admin
│     │  ├─ agents/                # ADK agents, pipelines, callbacks, schemas
│     │  ├─ verifier/              # SymPy + ratio/proportion rules (no LLM)
│     │  ├─ policy/                # hint policy engine, safety rules
│     │  ├─ learner_model/         # rules-based mastery estimator
│     │  ├─ diagrams/              # spec → SVG renderer + validators
│     │  ├─ db/                    # SQLAlchemy models, Alembic migrations, pgvector helpers
│     │  └─ jobs/                  # cron job handlers
│     ├─ tests/                    # unit, integration, authz, leakage, eval runner
│     ├─ pyproject.toml
│     └─ vercel.json
├─ content/
│  ├─ questions/                   # seed question JSON (reviewed via PR)
│  ├─ misconceptions/              # taxonomy + exemplars
│  └─ eval/                        # labelled evaluation cases (JSONL)
├─ docs/
│  ├─ PRD.md
│  ├─ adr/                         # architecture decision records
│  ├─ threat-model.md
│  └─ runbook.md
└─ .github/workflows/              # CI/CD pipelines
```

### 16.2 Environment variables and secrets

All secrets live in **Vercel Environment Variables**, scoped per environment (Development, Preview, Production). Only variables prefixed `VITE_` are exposed to the browser, and they must never contain secrets.

| Variable | Used by | Purpose | Secret |
| --- | --- | --- | --- |
| `APP_ENV` | api, web | `development`, `preview`, `production` | No |
| `DATABASE_URL` | api | Pooled Postgres connection string | Yes |
| `DATABASE_URL_UNPOOLED` | api (migrations) | Direct Postgres connection | Yes |
| `BLOB_READ_WRITE_TOKEN` | api | Vercel Blob access | Yes |
| `GOOGLE_API_KEY` | api | Gemini access via Google AI Studio (or Vertex credentials via `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) | Yes |
| `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING` | api | Per-agent model selection | No |
| `LANGFUSE_PUBLIC_KEY` | api | Langfuse project key | Yes |
| `LANGFUSE_SECRET_KEY` | api | Langfuse project secret | Yes |
| `LANGFUSE_HOST` | api | Langfuse base URL (Cloud region or self-hosted) | No |
| `LANGFUSE_PROMPT_LABEL` | api | Prompt version label to use (for example `production`) | No |
| `CRON_SECRET` | api | Bearer token validating Vercel Cron requests | Yes |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` | api | JWT verification settings | No |
| `AUTH_SECRET_KEY` (provider-specific) | api | Identity provider server key | Yes |
| `HINT_POLICY_VERSION` | api | Active hint policy version recorded on each turn | No |
| `LLM_TIMEOUT_SECONDS` | api | Upper bound for model/tool calls | No |
| `VITE_API_BASE_URL` | web | API base path (typically `/api`) | No |
| `VITE_AUTH_PUBLISHABLE_KEY` | web | Public identity-provider key | No |

Rules:

- No secret is ever committed to Git; `.env*` files are git-ignored and `.env.example` documents names only.
- Developers use `vercel env pull` to populate local `.env.local`.
- Preview environments use separate database and Langfuse credentials from Production.
- Rotate `CRON_SECRET`, Langfuse keys, and LLM keys on a documented schedule and after any suspected exposure.
- GitHub Secrets hold only CI deployment credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, project IDs) and CI-time evaluation keys.

---

## 17. CI/CD with GitHub Actions

### 17.1 Pipelines

| Workflow | Trigger | Steps |
| --- | --- | --- |
| `ci.yml` | Pull request | Lint and type-check (Ruff, mypy, ESLint, `tsc`); unit tests; authorisation tests; schema tests; verifier tests; build web and api; bundle-size check |
| `eval.yml` | Pull request touching `apps/api/app/agents`, `policy`, `verifier`, prompts, or `content/eval` (and nightly) | Run evaluation suite against Langfuse dataset; compute `verifier_agreement`, `answer_leakage`, `hint_policy_match`, `schema_valid`; fail if critical thresholds are breached |
| `deploy-preview.yml` | Pull request | Run migrations against preview DB; deploy web and api to Vercel Preview; post preview URLs to the PR |
| `deploy-prod.yml` | Merge to `main` | Re-run critical tests; apply Alembic migrations; deploy to Vercel Production; run smoke tests; tag release |
| `content-validate.yml` | Pull request touching `content/questions` | Validate question schema, run verifier consistency check (answer key vs solution plan), duplicate check |

### 17.2 Gates

A merge or production deploy is blocked if any of the following occur (mirrors [Section 14.3](#143-regression-testing)):

- Any critical regression test fails
- Answer-leakage rate in the eval suite exceeds the threshold
- Authorisation test failures
- Question content fails validation
- Deploy bundle exceeds the agreed size budget

### 17.3 Example production workflow (skeleton)

```yaml
name: deploy-prod
on:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e "apps/api[dev]"
      - run: pytest apps/api/tests -m "critical"

      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --global vercel@latest

      - name: Run migrations
        working-directory: apps/api
        env:
          DATABASE_URL_UNPOOLED: ${{ secrets.PROD_DATABASE_URL_UNPOOLED }}
        run: alembic upgrade head

      - name: Deploy API
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_API_PROJECT_ID }}
        run: |
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy Web
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_WEB_PROJECT_ID }}
        run: |
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Smoke test
        run: pytest apps/api/tests/smoke --base-url ${{ vars.PROD_BASE_URL }}
```

> Each `vercel pull/build/deploy` step should run from the respective app directory (or use a matrix over `apps/web` and `apps/api`) so the correct project settings are used. Alternatively, rely on Vercel's Git integration for deployments and use GitHub Actions purely as the quality gate (required status checks); this is a simpler variant and an open decision.

---

## 18. Delivery roadmap

### Phase 1: Discovery, design, and project bootstrap

**Duration:** 1 week

Deliverables:

- Customer problem statement
- Student, tutor, and coordinator personas
- Current-state and future-state workflow
- Initial curriculum map
- Skill graph for ratio and proportion
- Misconception taxonomy
- Hint-policy definition
- Architecture decision records (ADRs) for the locked stack
- Data and privacy assessment
- MVP success metrics
- Monorepo created with web and api apps, linting, formatting, and pre-commit hooks
- Two Vercel projects connected to GitHub; environment variables defined for Development, Preview, and Production
- Managed Postgres provisioned with pgvector enabled; first Alembic migration applied
- Vercel Blob store created
- Langfuse project created; ADK tracing "hello world" confirmed
- GitHub Actions `ci.yml` running on an empty but working skeleton

### Phase 2: Tutor foundation

**Duration:** 1–2 weeks

Deliverables:

- Authentication and role scaffolding (JWT verification, RBAC dependencies, audit middleware)
- Question-bank schema and import tooling
- 40–60 validated seed questions
- Student practice interface in React
- Session state machine
- Answer submission
- Deterministic ratio/proportion verifier (SymPy) with test suite
- Basic event logging (Postgres audit table)

### Phase 3: Socratic intelligence

**Duration:** 1–2 weeks

Deliverables:

- Google ADK per-turn pipeline (`SequentialAgent` + bounded `LoopAgent`)
- Student-state estimation
- Misconception classifier with pgvector exemplar retrieval
- Hint-policy engine
- Socratic Dialogue Agent and Safety Guard callbacks
- Structured agent schemas (Pydantic, versioned)
- Fallback logic
- Transfer-question workflow (pgvector shortlist + deterministic selection)
- Learner-model updates
- Langfuse traces, prompt versions, and first deterministic scores on every turn

### Phase 4: Teacher operations

**Duration:** 1 week

Deliverables:

- Student learning profile
- Cohort dashboard
- Session replay (with Langfuse trace links for authorised roles)
- Intervention recommendation cards
- Teacher override capability
- Item-quality review queue
- Vercel Cron jobs: `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync`

### Phase 5: Governance and reliability

**Duration:** 1 week

Deliverables:

- Role-based authorisation tests
- Audit-event viewer
- Prompt-injection tests
- Answer-leakage tests
- Evaluation harness (150+ labelled cases) wired into GitHub Actions and Langfuse datasets
- Model/prompt traceability end to end
- Monitoring dashboard (Langfuse dashboards plus Vercel logs and alerts)
- Error handling and retry policy
- `retention-purge` job and retention policy

### Phase 6: Capstone Presentation & Showcase

**Duration:** 1 week

Deliverables:

- Complete CI/CD pipeline with eval and security gates
- Threat model
- Architecture diagram
- Evaluation report
- Operating runbook
- 6–8 minute demo video
- Customer case study
- GitHub README and setup documentation

### Immediate starter backlog (first working session)

1. Create the GitHub repository and monorepo skeleton from [Section 16.1](#161-proposed-monorepo-structure).
2. Create the `solvepath-web` and `solvepath-api` Vercel projects and link them to the repository.
3. Provision Postgres (with pgvector) and a Vercel Blob store; add connection variables to Vercel.
4. Create the Langfuse project and add keys to Vercel; verify a traced ADK agent call.
5. Add a FastAPI `/health` endpoint and deploy it to Vercel to validate the Python runtime.
6. Add the first Alembic migration: users, roles, skills, questions, question versions, audit events.
7. Implement the SymPy verifier for one problem type (unit-part scaling) with tests.
8. Implement the hint-policy engine as pure Python with table-driven tests.
9. Build the first ADK pipeline with `MathVerifierAgent` and `SocraticDialogueAgent` only, returning a schema-valid response.
10. Add `ci.yml` with lint, tests, and a placeholder leakage test.

---

## 19. Capstone demonstration scenario

### Scenario title

**Helping a Year 6 student understand proportional scaling**

### Student problem

A map has a scale of 1 cm to 4 km. Two towns are 7.5 cm apart on the map. What is the actual distance between the towns?

### Demonstration flow

1. Student submits: "I think it is 11.5 km."
2. Mathematics verifier identifies incorrect operation but no arithmetic-only explanation.
3. Student-State Agent identifies a likely scaling misconception.
4. Hint Policy Engine authorises Level 1 support.
5. Tutor asks: *"What does every 1 cm on the map represent in real distance?"*
6. Student answers correctly: "4 km."
7. Tutor asks a Level 2 conceptual question: *"If there are 7.5 groups of 1 cm, what calculation would find the real distance?"*
8. Student responds: 7.5 × 4.
9. Verifier confirms setup.
10. Student calculates 30 km.
11. Tutor requests a reasonableness check: *"How can you estimate whether 30 km is sensible without doing the full multiplication again?"*
12. Student explains that 7 cm would be 28 km, so 7.5 cm should be slightly more.
13. System presents a transfer item with a different scale context.
14. Teacher dashboard updates:

```text
Skill: Scale and multiplicative reasoning
Initial misconception: Under-scaling / additive interpretation
Support required: Levels 1–2
Final solution: Correct
Transfer result: Correct independently
Mastery impact: Positive, moderate confidence
Recommended next practice: Reverse scale problem
```

**Demo additions for the stack:** show the Langfuse trace for one tutor turn (verifier span → hint decision → Socratic agent → safety guard), the prompt version used, the deterministic scores attached, the session replay linking to that trace, and the GitHub Actions eval gate blocking a deliberately leaky prompt change.

---

## 20. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tutor gives incorrect mathematics feedback | High | Deterministic verifier before LLM feedback; regression suite; human review |
| Tutor reveals answer too early | High | Server-side hint policy; deterministic answer-leakage check; answer-leakage tests in CI; structured output constraints |
| Misconception misclassification | Medium | Confidence thresholds, alternative labels, teacher review, do not present low-confidence labels as fact |
| Student becomes dependent on hints | Medium | Track hint dependency; require transfer items; reduce support gradually |
| Diagram is visually plausible but mathematically incorrect | High | Structured specification, deterministic rendering, validation checks, human approval |
| Sensitive student data is exposed | High | Role-based access, synthetic demo data, encryption, audit logs, retention controls, PII masking before Langfuse export |
| Excessive LLM cost or latency | Medium | Smaller models for classification, caching, bounded prompts, tool-first verification, rate limits, Langfuse cost dashboards and alerts |
| Over-engineered multi-agent system | Medium | Start with a controlled orchestration layer and only necessary agent roles; deterministic steps stay non-LLM |
| Content quality is inconsistent | High | Offline content-validation pipeline, item review, versioning, publication controls |
| Teachers over-rely on recommendations | Medium | Explicit confidence, source evidence, limitations, override controls, non-autonomous policy |
| Prompt injection in student input or retrieved content | Medium | Treat inputs as data, isolate system instructions, output schemas, tool allowlists via ADK callbacks, adversarial testing |
| **Vercel Python function limits** (bundle size, duration, cold starts) with ADK + SymPy dependencies | High | Track bundle size and cold start in CI; lazy imports; stream responses; batch background work; keep FastAPI container-portable as fallback |
| **Vercel Cron limitations** (plan-based frequency, no built-in retries or queue semantics) | Medium | Idempotent batched jobs, `job_run` table, resume-on-next-run, alerting; move to a queue/workflow mechanism if needed |
| **Serverless database connection exhaustion** | Medium | Pooled connection string, small pool size, short-lived sessions, load test before demo |
| **Telemetry leakage** (student data in Langfuse traces) | High | Pseudonymous IDs, masking function, no free-text PII, access control on Langfuse, separate projects per environment |
| **Langfuse spans lost in serverless** | Low | Explicit flush before response, trace-ID persisted in Postgres, tests verifying trace creation |
| **Vector retrieval returns unapproved or stale content** | Medium | Always join to approved/published versions; `embedding-sync` job re-embeds on version change |
| **LLM provider/model deprecation or behaviour change** | Medium | Per-agent model env vars, pinned versions, eval suite re-run on every model change |

---

## 21. Launch criteria

The MVP may be demonstrated when all of the following are true:

- [ ] At least 40 approved ratio/proportion questions are available.
- [ ] At least 10 common misconception labels are supported.
- [ ] Deterministic verifier supports all MVP problem formats.
- [ ] Tutor uses a working 0–5 hint policy.
- [ ] Answer leakage test suite passes.
- [ ] Student session data persists correctly.
- [ ] Transfer-question workflow works.
- [ ] Student dashboard works for test users.
- [ ] Teacher dashboard displays learner evidence and session replay.
- [ ] Teacher override is recorded in audit logs.
- [ ] Role-based access-control tests pass.
- [ ] Synthetic data is used in all public/demo environments.
- [ ] Evaluation harness has at least 150 labelled cases.
- [ ] Critical mathematics and safety regression tests pass.
- [ ] Deployment monitoring captures latency, errors, and model/tool failures (Langfuse and Vercel).
- [ ] Every tutor turn has a Langfuse trace linked from the replay view.
- [ ] Vercel Cron jobs run on schedule, are idempotent, and report status.
- [ ] All secrets are stored in Vercel Environment Variables; no secrets in the repository or client bundle.
- [ ] GitHub Actions pipeline enforces lint, tests, evals, and deploy gates.
- [ ] All P0 user stories meet the Definition of Done ([Section 6.3](#63-definition-of-ready-and-definition-of-done)).
- [ ] Documentation includes architecture, threat model, evaluation report, and operational runbook.

---

## 22. Open decisions

| # | Decision | Options | Suggested default |
| --- | --- | --- | --- |
| 1 | Identity provider | Clerk, Auth0, Microsoft Entra ID, or equivalent | Clerk or Auth0 (fast to integrate; JWT verified in FastAPI) |
| 2 | LLM access path | Google AI Studio API key vs Vertex AI | AI Studio key for the capstone; Vertex AI if enterprise controls are needed |
| 3 | Postgres provider | Neon (via Vercel Marketplace), Supabase, or other managed Postgres with pgvector | Neon via Vercel Marketplace |
| 4 | Langfuse hosting | Langfuse Cloud vs self-hosted | Langfuse Cloud with a separate project per environment |
| 5 | Deployment trigger | Vercel Git integration with GitHub Actions as quality gate vs full deploy from GitHub Actions | Start with Git integration plus required status checks; move to Actions-driven deploys if migrations must be ordered |
| 6 | Background-job mechanism beyond cron | Stay on Vercel Cron vs adopt a Vercel queue/workflow capability or external worker | Cron for MVP; revisit if jobs exceed duration limits or need guaranteed retries |
| 7 | Backend hosting fallback | Stay on Vercel Python Functions vs container host | Vercel for MVP; keep container-portable |
| 8 | Embedding model and dimension | Gemini embedding model vs alternative | Use the Gemini embedding model matching `MODEL_EMBEDDING`; fix dimension in the first migration |
| 9 | Frontend build tool | Vite SPA vs a React meta-framework | Vite SPA (simplest fit with a separate FastAPI backend) |

---

## 23. Capstone portfolio statement

SolvePath is a secure multi-agent Socratic mathematics tutor for upper-primary learners. It combines a controlled tutoring state machine built on Google ADK, deterministic mathematics verification, misconception-aware guidance, progressive hint policies, validated diagram support, learner modelling, and educator analytics. The system is designed to make student reasoning visible while keeping teachers in control of educational decisions through evidence, auditability, role-based access, and human override workflows.

It is delivered on a modern, production-style stack: a React front end and FastAPI backend hosted on Vercel, Postgres with pgvector for domain and vector data, Vercel Blob for assets, Langfuse for tracing, prompt versioning, and evaluation, Vercel Cron Jobs for background processing, GitHub Actions for gated CI/CD, and Vercel Environment Variables for secrets management.

This PRD positions the project as more than an AI tutor. It is an **education operations and learning-intelligence platform** that demonstrates customer discovery, domain modelling, safe agent orchestration, software engineering, security, AI evaluation, operational deployment, and human-centred product design.
