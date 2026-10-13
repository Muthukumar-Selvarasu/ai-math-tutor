# SolvePath — Customer Handover Brief (PRD §15.8, §22)

## 1. Executive Briefing & Target Audience

SolvePath is an intelligent, deterministic Socratic tutoring platform engineered for mathematics tutoring organisations preparing Year 5–6 learners for high-stakes selective-entry and scholarship quantitative reasoning examinations (e.g., Victorian Selective Entry, NSW Selective High School Placement Test, and ACER Scholarship exams).

### The Core Problem Solved
Traditional unconstrained AI chatbots (such as ChatGPT) fail in primary mathematics tutoring: they lecture at length, provide direct answers prematurely, hallucinate calculations, and deprive students of the cognitive struggle essential for mastering proportional reasoning. SolvePath constrains AI behind deterministic mathematical verification and finite-state hint ladders, ensuring students develop authentic multiplicative problem-solving capacity.

---

## 2. Curriculum Standards Alignment

In Australian state curricula, formal ratio concepts belong to Year 7. SolvePath frames ratio and proportional reasoning as **selective-entry accelerated stretch content** building upon Year 6 multiplicative foundations:

- **Year 6 Multiplicative Foundation**:
  - Australian Curriculum v9: `AC9M6N07` (familiar fractions, decimals, percentages of quantities).
  - Victorian Curriculum 2.0 (VCAA): `VC2M6N07` (multiplicative relationships & proportions).
- **Year 7 Selective Transition (Ratio & Scale)**:
  - Australian Curriculum v9: `AC9M7N08` (recognise, represent, and solve problems involving ratios).
  - Victorian Curriculum 2.0 (VCAA): `VC2M7N09` (ratio representations, part-to-part, part-to-whole).

---

## 3. What the Customer Receives

1. **Guided Practice Environment for Students**:
   - One question at a time with verified step-by-step working.
   - Interactive SVG visual representations (strip diagrams and ratio tables).
   - Deterministic 0–5 hint ladder that never gives away the answer unearned.
2. **Educator Oversight & Intervention Console**:
   - Actionable review queue highlighting students needing teacher assistance.
   - Evidence-backed draft intervention summaries citing student attempt history.
   - Full turn-by-turn session replay with verifier outcomes, hint levels, and notes.
3. **Enterprise Governance & Safety Harness**:
   - Zero-leakage mathematical verifier (SymPy engine).
   - Comprehensive audit logging of all educator reviews, overrides, and exports.
   - Multi-tier data retention purging student text while retaining learning longitudinal metadata.

---

## 4. Strict High-Stakes Decision Boundaries (PRD §12.2)

To protect young learners, SolvePath operates under strict, non-negotiable boundaries:
- **NO Autonomous Grading**: The system does not assign final grades or summative marks.
- **NO Placement or Admissions Decisions**: AI outputs never determine selective school eligibility or class streaming.
- **NO Autonomous Communications**: The platform never contacts parents or students directly.
- **Human-in-the-Loop Requirement**: Every AI-generated recommendation is strictly an advisory draft. Teachers maintain 100% decision authority to accept, reject, or override any intervention.

---

## 5. Live Pilot Readiness Checklist

Before transitioning from the synthetic demonstration environment to a live classroom or tutoring centre pilot, the following operational prerequisites must be completed:

- [ ] **Consent Flows**: Active parental and institutional consent mechanisms in compliance with the OAIC Children's Privacy Guidelines.
- [ ] **Data Residency**: Production deployment configured with Neon Postgres in AWS Sydney (`ap-southeast-2`).
- [ ] **Enterprise Model Agreement**: Commercial enterprise contract with Google Vertex AI (`australia-southeast1`) guaranteeing zero prompt training or retention.
- [ ] **Controlled Tracing**: Langfuse instance dedicated to the customer with automated 90-day PII purging.
- [ ] **Educator Training**: Completion of the 30-minute teacher orientation on reviewing and overriding draft recommendations.
