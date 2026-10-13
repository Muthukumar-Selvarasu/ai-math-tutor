# SolvePath — Threat Model v0 (TECH-55, PRD §15.8, §21.1 #32)

## 1. System Context & Asset Inventory

SolvePath serves primary-aged students (ages 10–12) preparing for selective-entry quantitative examinations. The primary threat assets are:
1. **Child Safety & Well-being**: Preventing exposure to toxic, shaming, suggestive, or predatory AI-generated text.
2. **Pedagogical Integrity (Anti-Leakage)**: Preventing extraction of final numerical answers, step calculations, or unearned worked solutions.
3. **Student Privacy & PII**: Enforcing the Australian Privacy Act 1988 (Cth) and OAIC Children's Privacy Guidelines against leakage of names, transcripts, or personal disclosures.
4. **Platform Availability & Budget Safeguards**: Preventing denial-of-service or runaway model-spend exhaustion beyond the USD 20/month ceiling.

---

## 2. Trust Boundaries & Data Flow

```text
 [Untrusted Student Browser]
              │
      (HTTPS / Clerk JWT)
              ▼
   ┌───────────────────────┐
   │ 1. Ingress Boundary   │  ◄── Input PII Scrubber + Input Screen (Canned Short-circuit)
   └──────────┬────────────┘
              │ (Scrubbed, Normalized Numbers Only)
              ▼
   ┌───────────────────────┐
   │ 2. Tutor Orchestrator │  ◄── Deterministic FSM + State Machine
   └──────────┬────────────┘
              │ (Allowed Keys Only — NO Free Text)
              ▼
   ┌───────────────────────┐
   │ 3. Isolated Spokes    │  ◄── SymPy MCP / A2A Safety Guard / Provider Adapter
   └──────────┬────────────┘
              │ (Candidate Generation)
              ▼
   ┌───────────────────────┐
   │ 4. Egress Boundary    │  ◄── DeterministicLeakCheck + SafetyGuard + Output Filter
   └───────────────────────┘
```

---

## 3. Threat Analysis & Mitigations

| Threat Vector | STRIDE | Severity | Architectural Mitigation |
|---|---|---|---|
| **Prompt Injection / Jailbreak** | Tampering / Elevation | High | Deterministic Input Screen matches injection patterns against `content/safety/input_lexicon.json`. Offending input never reaches LLM stages; short-circuits to canned response with security audit event. |
| **Answer / Value Leakage** | Information Disclosure | High | `DeterministicLeakCheck` inspects all generated tokens for forbidden digits and solution values. `SafetyGuard` independently reviews candidates against hashed `forbidden_strings`. Authored templates used if candidate fails. |
| **Student PII Exfiltration** | Information Disclosure | Critical | Free-form student text is completely stripped from prompts sent to LLMs (`PROMPT_CAPTURE_GUARD` asserts zero student text in prompts). Telemetry logs use pseudonymous UUIDs. |
| **Unauthorised Data Access (Multi-Tenant)** | Elevation / Disclosure | High | Role-Based Access Control enforced at API layer. Teachers are strictly restricted to assigned cohorts (`403 Forbidden` for unassigned access). Postgres RLS policies ensure data isolation. |
| **Langfuse Trace Exposure** | Information Disclosure | Medium | Raw model execution traces are restricted exclusively to administrators possessing explicit `trace_review` grants. Regular teachers and students never receive trace links. Traces purged at 90 days. |
| **Model Service Denial / Spend Exhaustion** | Denial of Service | Medium | Hard rate limits of 60 turns/hour per student, 12-turn session limits, and a strict USD 20 monthly provider spend cap with automated alert at USD 16. |
| **Service Impersonation (MCP / A2A)** | Spoofing | High | Internal microservices communicate using short-lived (≤ 60s), audience-scoped HMAC service bearer tokens with distinct per-target secrets. |

---

## 4. Compliance & Regulatory Controls

- **Australian Privacy Principles (APP 8 & APP 11)**: All production deployments mandate Australian data residency (Neon AWS Sydney `ap-southeast-2` and Google Cloud Vertex AI `australia-southeast1`).
- **Commercial Enterprise Data Protection**: Models operate under zero-retention / no-training enterprise agreements. Free-tier consumer APIs are strictly barred from processing student interactions.
- **Incident Escalation**: Any detected safety breach or candidate leakage triggers automatic session quarantining and Sev-1 operator alert within 15 minutes.
