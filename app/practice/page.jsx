"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function PracticePage() {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answerInput, setAnswerInput] = useState("");
  const [selectedReasoningOption, setSelectedReasoningOption] = useState("");
  const [selectedReflectionOption, setSelectedReflectionOption] = useState("");
  const [confidenceRating, setConfidenceRating] = useState("");
  const [dialogueMode, setDialogueMode] = useState("template");
  const [allowLevel5, setAllowLevel5] = useState(false);
  const [stepInput, setStepInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());

  // Initialize session on mount
  useEffect(() => {
    async function startSession() {
      try {
        setLoading(true);
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: "ratio_share_001" }),
        });
        if (!res.ok) {
          throw new Error(`Failed to start session: ${res.statusText}`);
        }
        const data = await res.json();
        setSessionData(data);
        if (data.session?.dialogue_mode) {
          setDialogueMode(data.session.dialogue_mode);
        }
        if (data.session?.allow_level_5 !== undefined) {
          setAllowLevel5(data.session.allow_level_5);
        }
        setStartTime(Date.now());
        if (data.session) {
          setAuditLog([
            {
              event_type: "session_created",
              timestamp: new Date().toLocaleTimeString(),
              details: `Session started in state: ${data.session.state}, Level: ${data.session.hint_level}`,
            },
          ]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    startSession();
  }, []);

  // Handle "I am not sure" button
  async function handleNotSure() {
    if (!sessionData || submitting) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "not_sure",
          response_duration_ms: duration,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      // Update audit log
      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: "not_sure_escalation",
            timestamp: new Date().toLocaleTimeString(),
            details: `Escalated to Level ${result.session.hint_level} (attempt not counted, duration: ${duration}ms)`,
          },
        ]);
      }
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Answer Submission
  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!sessionData || submitting || !answerInput.trim()) return;

    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const payload = {
        event: "submit",
        answer_text: answerInput.trim(),
        response_target: "final",
        dialogue_mode: dialogueMode,
        selected_reasoning_option: selectedReasoningOption || undefined,
        confidence_rating: confidenceRating ? parseInt(confidenceRating, 10) : undefined,
        response_duration_ms: duration,
      };

      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: result.audit_event.event_type || "attempt_submitted",
            timestamp: new Date().toLocaleTimeString(),
            details: `Submitted: "${answerInput}" (Level ${result.session.hint_level}, duration: ${duration}ms)`,
          },
        ]);
      }

      setAnswerInput("");
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Option-Only Strategy Submission
  async function handleReasoningSubmit() {
    if (!sessionData || submitting || !selectedReasoningOption) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const payload = {
        event: "submit",
        selected_reasoning_option: selectedReasoningOption,
        confidence_rating: confidenceRating ? parseInt(confidenceRating, 10) : undefined,
        response_duration_ms: duration,
      };

      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: "reasoning_option_selected",
            timestamp: new Date().toLocaleTimeString(),
            details: `Strategy selected: "${selectedReasoningOption}" (duration: ${duration}ms)`,
          },
        ]);
      }
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Working Step Submission
  async function handleStepSubmit() {
    if (!sessionData || submitting || !stepInput.trim()) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const payload = {
        event: "submit",
        step_expressions: [stepInput.trim()],
        response_target: "step",
        selected_reasoning_option: selectedReasoningOption || undefined,
        confidence_rating: confidenceRating ? parseInt(confidenceRating, 10) : undefined,
        response_duration_ms: duration,
      };

      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: result.audit_event.event_type || "step_submitted",
            timestamp: new Date().toLocaleTimeString(),
            details: `Working step submitted: "${stepInput}" (duration: ${duration}ms)`,
          },
        ]);
      }

      setStepInput("");
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Note to Teacher
  async function handleSaveNote() {
    if (!sessionData || submitting || !noteInput.trim()) return;
    setSubmitting(true);

    try {
      const payload = {
        event: "note",
        note_text: noteInput.trim(),
      };

      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      setAuditLog((prev) => [
        ...prev,
        {
          event_type: "note_saved",
          timestamp: new Date().toLocaleTimeString(),
          details: `Teacher note saved: "${noteInput.trim()}"`,
        },
      ]);

      setNoteInput("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle "Show Solution" (Level 5 request)
  async function handleShowSolution() {
    if (!sessionData || submitting) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "show_solution",
          allow_level_5: allowLevel5,
          response_duration_ms: duration,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: result.audit_event.event_type,
            timestamp: new Date().toLocaleTimeString(),
            details: `Show solution response: kind=${result.tutor?.kind}, Level ${result.session.hint_level}`,
          },
        ]);
      }
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Reflection Submission
  async function handleReflectionSubmit() {
    if (!sessionData || submitting || !selectedReflectionOption) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "reflection_choice",
          option_id: selectedReflectionOption,
          response_duration_ms: duration,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        question: result.question || prev.question,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: result.audit_event.event_type || "reflection_submitted",
            timestamp: new Date().toLocaleTimeString(),
            details: `Reflection choice submitted: "${selectedReflectionOption}"`,
          },
        ]);
      }
      setSelectedReflectionOption("");
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Skip Reflection
  async function handleSkipReflection() {
    if (!sessionData || submitting) return;
    setSubmitting(true);
    const duration = Date.now() - startTime;

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "skip",
          response_duration_ms: duration,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        question: result.question || prev.question,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: result.audit_event.event_type || "reflection_skipped",
            timestamp: new Date().toLocaleTimeString(),
            details: `Reflection skipped`,
          },
        ]);
      }
      setSelectedReflectionOption("");
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Transfer Offer Acceptance
  async function handleAcceptTransfer() {
    if (!sessionData || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "accept",
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        question: result.question || prev.question,
        tutor: result.tutor,
      }));
      setAnswerInput("");

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: "transfer_accepted",
            timestamp: new Date().toLocaleTimeString(),
            details: `Accepted transfer question (new level: ${result.session.hint_level})`,
          },
        ]);
      }
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Transfer Offer Decline
  async function handleDeclineTransfer() {
    if (!sessionData || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "decline",
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const result = await res.json();
      setSessionData((prev) => ({
        ...prev,
        session: result.session,
        tutor: result.tutor,
      }));

      if (result.audit_event) {
        setAuditLog((prev) => [
          ...prev,
          {
            event_type: "transfer_declined",
            timestamp: new Date().toLocaleTimeString(),
            details: `Declined transfer question (session completed/declined)`,
          },
        ]);
      }
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="practice-container">
        <div className="practice-card" style={{ textAlign: "center", padding: "4rem" }}>
          <div className="spinner"></div>
          <p style={{ marginTop: "1.5rem", color: "var(--text-muted)" }}>
            Starting your personalized tutoring session...
          </p>
        </div>
      </main>
    );
  }

  if (error && !sessionData) {
    return (
      <main className="practice-container">
        <div className="practice-card" style={{ textAlign: "center", padding: "4rem", borderColor: "#ef4444" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "1rem" }}>Session Error</h2>
          <p style={{ color: "var(--text-muted)" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
            style={{ marginTop: "1.5rem" }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { session, question, tutor } = sessionData || {};
  const controls = tutor?.controls || [];
  const attempts = session?.attempts || [];

  return (
    <div className="practice-wrapper">
      <header className="practice-header">
        <div className="logo-container">
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="logo-badge">SP</div>
            <span className="logo-title" style={{ color: "var(--foreground)" }}>SolvePath</span>
          </Link>
          <span className="header-divider">/</span>
          <span className="header-sub">Practice Mode</span>
        </div>

        <div className="status-badges">
          <div className="status-badge" data-testid="session-state-badge">
            <span className="badge-label">State:</span>
            <span className="badge-value state-pill" data-state={session?.state}>
              {session?.state}
            </span>
          </div>

          <div className="status-badge" data-testid="hint-level-badge">
            <span className="badge-label">Hint Level:</span>
            <span className="badge-value level-pill">Level {session?.hint_level}</span>
          </div>

          <div className="status-badge" data-testid="attempt-count-badge">
            <span className="badge-label">Attempts:</span>
            <span className="badge-value attempts-pill">{session?.attempt_count}</span>
          </div>

          <div className="status-badge" data-testid="input-mode-badge">
            <span className="badge-label">Mode:</span>
            <span className="badge-value input-mode-pill">{session?.input_mode || "keypad"}</span>
          </div>

          <div className="status-badge" data-testid="session-flags-badge">
            <span className="badge-label">Flags:</span>
            <span className="badge-value flags-pill">
              {session?.flags && session.flags.length > 0 ? session.flags.join(", ") : "none"}
            </span>
          </div>

          <div className="status-badge" data-testid="dialogue-mode-badge">
            <span className="badge-label">Dialogue:</span>
            <span className="badge-value dialogue-pill">{session?.dialogue_mode || "template"}</span>
          </div>

          <div className="status-badge" data-testid="allow-level-5-badge">
            <span className="badge-label">Level 5:</span>
            <span className="badge-value level-5-pill">
              {allowLevel5 ? "Enabled" : "Disabled"}
            </span>
          </div>

          {session?.transfer_outcome && (
            <div className="status-badge" data-testid="transfer-outcome-badge">
              <span className="badge-label">Transfer:</span>
              <span className="badge-value transfer-outcome-pill">
                {session.transfer_outcome}
              </span>
            </div>
          )}

          <div className="status-badge" data-testid="mastery-confidence-badge">
            <span className="badge-label">Confidence:</span>
            <span className="badge-value confidence-pill">
              {session?.mastery_confidence !== undefined ? session.mastery_confidence.toFixed(2) : "0.00"}
            </span>
          </div>

          {session?.end_reason && (
            <div className="status-badge" data-testid="end-reason-badge">
              <span className="badge-label">End Reason:</span>
              <span className="badge-value end-reason-pill">
                {session.end_reason}
              </span>
            </div>
          )}

          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <button className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }} data-testid="practice-to-dashboard-btn">
              📊 Dashboard
            </button>
          </Link>
        </div>
      </header>

      <main className="practice-main">
        <div className="practice-grid">
          {/* Left Column: Problem Stem & Tutor Socratic Area */}
          <div className="practice-left">
            {/* Question Card */}
            <section className="problem-card" data-testid="question-card">
              <div className="problem-header">
                <span className="problem-topic">Ratio and Proportion</span>
                <span className="problem-id">{question?.question_id}</span>
              </div>
              <h2 className="problem-title">{question?.title}</h2>
              <p className="problem-stem" data-testid="problem-stem">{question?.stem}</p>
            </section>

            {/* Tutor Socratic Guidance Card */}
            <section className="tutor-card" data-testid="tutor-card">
              <div className="tutor-avatar-row">
                <div className="tutor-avatar">🤖</div>
                <div className="tutor-info">
                  <span className="tutor-name">Socratic Math Tutor</span>
                  <span className="tutor-mode">Guided Feedback</span>
                </div>
              </div>

              <div className="tutor-speech-bubble" data-testid="tutor-prompt">
                <p>{tutor?.text}</p>
              </div>

              {/* Turn Metadata Badges */}
              <div
                className="tutor-meta-row"
                data-testid="tutor-meta-row"
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                <span className="meta-pill" data-testid="turn-kind-badge">
                  Kind: {tutor?.kind || "canned"}
                </span>
                <span className="meta-pill" data-testid="turn-model-badge">
                  Model: {tutor?.model || "template"}
                </span>
                <span className="meta-pill" data-testid="turn-prompt-version-badge">
                  Prompt: v{tutor?.prompt_version || "1.0.0"}
                </span>
                <span className="meta-pill" data-testid="turn-policy-version-badge">
                  Policy: v{tutor?.policy_version || "1.0.0"}
                </span>
                <span className="meta-pill" data-testid="turn-trace-status-badge">
                  Trace: {tutor?.trace_status || "missing"}
                </span>
                {tutor?.prompt_type && (
                  <span className="meta-pill" data-testid="turn-prompt-type-badge">
                    Prompt: {tutor.prompt_type}
                  </span>
                )}
                <span className="meta-pill" data-testid="turn-safety-badge">
                  Safety: {tutor?.safety_verdict || "allow"}
                </span>
                {tutor?.single_prompt !== null && tutor?.single_prompt !== undefined && (
                  <span className="meta-pill" data-testid="turn-single-prompt-badge">
                    Single Prompt: {tutor.single_prompt ? "Passed" : "Failed"}
                  </span>
                )}
              </div>

              {/* Notice when at Level 0: No hints active */}
              {session?.hint_level === 0 && (
                <div className="no-hint-notice" data-testid="no-hint-notice">
                  <span>💡 Independent attempt phase: No hints provided yet.</span>
                </div>
              )}
            </section>

            {/* Student Working / Input Area */}
            <section className="input-card" data-testid="input-card">
              <h3 className="section-title">Your Answer</h3>
              <form onSubmit={handleSubmit} className="answer-form">
                <div className="input-row">
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    {question?.unit && <span className="unit-prefix">{question.unit}</span>}
                    <input
                      type="text"
                      className="answer-input"
                      data-testid="answer-input"
                      placeholder="Enter your answer..."
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      disabled={submitting}
                      autoFocus
                    />
                  </div>

                  <div className="confidence-wrapper" data-testid="confidence-rating-container" style={{ minWidth: "160px" }}>
                    <select
                      className="answer-input"
                      data-testid="confidence-rating-select"
                      value={confidenceRating}
                      onChange={(e) => setConfidenceRating(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Confidence (optional)</option>
                      <option value="1">1 - Guessing</option>
                      <option value="2">2 - Low</option>
                      <option value="3">3 - Medium</option>
                      <option value="4">4 - High</option>
                      <option value="5">5 - Completely sure</option>
                    </select>
                  </div>

                  <div className="mode-toggle-wrapper" data-testid="dialogue-mode-container" style={{ minWidth: "160px" }}>
                    <select
                      className="answer-input"
                      data-testid="dialogue-mode-select"
                      value={dialogueMode}
                      onChange={(e) => setDialogueMode(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="template">Mode: Template</option>
                      <option value="llm">Mode: LLM Classifier</option>
                    </select>
                  </div>

                  <div className="mode-toggle-wrapper" data-testid="allow-level-5-container" style={{ minWidth: "160px" }}>
                    <select
                      className="answer-input"
                      data-testid="allow-level-5-select"
                      value={allowLevel5 ? "true" : "false"}
                      onChange={(e) => setAllowLevel5(e.target.value === "true")}
                      disabled={submitting}
                    >
                      <option value="false">L5: Disabled (Default)</option>
                      <option value="true">L5: Enabled (Coordinator)</option>
                    </select>
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    type="submit"
                    className="btn btn-primary submit-btn"
                    data-testid="submit-attempt-btn"
                    disabled={submitting || !answerInput.trim()}
                  >
                    {submitting ? "Checking..." : "Submit Attempt"}
                  </button>

                  {controls.includes("not_sure") && (
                    <button
                      type="button"
                      className="btn btn-secondary not-sure-btn"
                      data-testid="not-sure-btn"
                      onClick={handleNotSure}
                      disabled={submitting}
                    >
                      🤔 I am not sure
                    </button>
                  )}

                  {controls.includes("show_solution") && session?.state !== "transfer_active" && (
                    <button
                      type="button"
                      className="btn btn-secondary show-solution-btn"
                      data-testid="show-solution-btn"
                      onClick={handleShowSolution}
                      disabled={submitting}
                    >
                      Show Solution
                    </button>
                  )}

                  {(controls.includes("accept") || session?.state === "transfer_offered") && (
                    <button
                      type="button"
                      className="btn btn-primary accept-transfer-btn"
                      data-testid="accept-transfer-btn"
                      onClick={handleAcceptTransfer}
                      disabled={submitting}
                    >
                      Accept Transfer
                    </button>
                  )}

                  {(controls.includes("decline") || session?.state === "transfer_offered") && (
                    <button
                      type="button"
                      className="btn btn-secondary decline-transfer-btn"
                      data-testid="decline-transfer-btn"
                      onClick={handleDeclineTransfer}
                      disabled={submitting}
                    >
                      Decline Transfer
                    </button>
                  )}
                </div>
              </form>

              {/* Structured Reflection Section */}
              {session?.state === "reflection" && tutor?.choices && tutor.choices.length > 0 && (
                <div
                  className="reflection-section"
                  data-testid="reflection-section"
                  style={{
                    marginTop: "1.5rem",
                    padding: "1.25rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "rgba(99, 102, 241, 0.04)",
                  }}
                >
                  <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--accent)" }}>
                    Reflect on your method:
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {tutor.choices
                      .filter((opt) => opt.option_id !== "skip")
                      .map((opt) => (
                        <label
                          key={opt.option_id}
                          data-testid={`reflection-option-${opt.option_id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            cursor: "pointer",
                            padding: "0.6rem 0.8rem",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: selectedReflectionOption === opt.option_id ? "rgba(99, 102, 241, 0.12)" : "var(--card-bg, #fff)",
                          }}
                        >
                          <input
                            type="radio"
                            name="reflection_choice"
                            value={opt.option_id}
                            checked={selectedReflectionOption === opt.option_id}
                            onChange={(e) => setSelectedReflectionOption(e.target.value)}
                            disabled={submitting}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid="submit-reflection-btn"
                      onClick={handleReflectionSubmit}
                      disabled={submitting || !selectedReflectionOption}
                    >
                      Submit Reflection
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-testid="skip-reflection-btn"
                      onClick={handleSkipReflection}
                      disabled={submitting}
                    >
                      Skip Reflection
                    </button>
                  </div>
                </div>
              )}

              {/* Structured Reasoning Options Section */}
              {question?.reasoning_options && question.reasoning_options.length > 0 && (
                <div
                  className="reasoning-section"
                  data-testid="reasoning-section"
                  style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}
                >
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Choose Your Strategy / Reasoning Option:
                  </h4>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      className="answer-input"
                      data-testid="reasoning-option-select"
                      value={selectedReasoningOption}
                      onChange={(e) => setSelectedReasoningOption(e.target.value)}
                      disabled={submitting}
                      style={{ flex: 1, minWidth: "220px" }}
                    >
                      <option value="">-- Pick reasoning strategy --</option>
                      {question.reasoning_options.map((opt) => (
                        <option key={opt.option_id} value={opt.option_id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-testid="submit-reasoning-btn"
                      onClick={handleReasoningSubmit}
                      disabled={submitting || !selectedReasoningOption}
                    >
                      Submit Strategy
                    </button>
                  </div>
                </div>
              )}

              {/* Working Step Expression Input */}
              <div
                className="step-working-section"
                data-testid="step-working-section"
                style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}
              >
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Optional Working Step (one calculation):
                </h4>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="text"
                    className="answer-input"
                    data-testid="step-expression-input"
                    placeholder="e.g. 2 + 3 or 60 / 5"
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="submit-step-btn"
                    onClick={handleStepSubmit}
                    disabled={submitting || !stepInput.trim()}
                  >
                    Submit Step
                  </button>
                </div>
              </div>

              {/* Private Teacher Note */}
              <div
                className="note-section"
                data-testid="note-section"
                style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}
              >
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Private Note for Teacher:
                </h4>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <textarea
                    className="answer-input"
                    data-testid="student-note-input"
                    placeholder="Write a note or question for your teacher..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    disabled={submitting}
                    rows={2}
                    style={{ flex: 1, resize: "vertical" }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="save-note-btn"
                    onClick={handleSaveNote}
                    disabled={submitting || !noteInput.trim()}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Attempt History & Audit Log */}
          <div className="practice-right">
            <section className="drawer-card" data-testid="attempts-history-card">
              <h3 className="drawer-title">Attempt History</h3>
              {attempts.length === 0 ? (
                <p className="drawer-empty" data-testid="empty-attempts-notice">
                  No attempts submitted yet. Try taking your first shot!
                </p>
              ) : (
                <ul className="attempts-list" data-testid="attempts-list">
                  {attempts.map((att, idx) => (
                    <li key={att.attempt_id || idx} className="attempt-item" data-testid="attempt-item">
                      <div className="attempt-item-header">
                        <span className="attempt-number">
                          {att.response_type === "reasoning_option"
                            ? "Reasoning Choice"
                            : att.counted
                            ? `Attempt #${att.attempt_number}`
                            : "Uncertainty Request"}
                        </span>
                        <span className={`counted-badge ${att.counted ? "counted-yes" : "counted-no"}`}>
                          {att.counted ? "Counted" : "Not Counted"}
                        </span>
                      </div>
                      <div className="attempt-item-body">
                        {att.answer_text && (
                          <div className="attempt-detail">
                            <span className="detail-label">Answer:</span>{" "}
                            <span className="detail-val">{att.answer_text}</span>
                          </div>
                        )}
                        {att.step_expressions && att.step_expressions.length > 0 && (
                          <div className="attempt-detail">
                            <span className="detail-label">Step:</span>{" "}
                            <span className="detail-val" data-testid="attempt-step-val">
                              {att.step_expressions.join(", ")}
                            </span>
                          </div>
                        )}
                        {att.selected_reasoning_option && (
                          <div className="attempt-detail">
                            <span className="detail-label">Strategy:</span>{" "}
                            <span className="detail-val" data-testid="attempt-reasoning-val">
                              {att.selected_reasoning_option}
                            </span>
                          </div>
                        )}
                        {att.confidence_rating !== null && att.confidence_rating !== undefined && (
                          <div className="attempt-detail">
                            <span className="detail-label">Confidence:</span>{" "}
                            <span className="detail-val" data-testid="attempt-confidence-val">
                              {att.confidence_rating}/5
                            </span>
                          </div>
                        )}
                        <div className="attempt-detail">
                          <span className="detail-label">Hint Level:</span>{" "}
                          <span className="detail-val">Level {att.hint_level}</span>
                        </div>
                        {att.prompt_type && (
                          <div className="attempt-detail">
                            <span className="detail-label">Prompt Type:</span>{" "}
                            <span className="detail-val" data-testid="attempt-prompt-type">
                              {att.prompt_type}
                            </span>
                          </div>
                        )}
                        {att.misconception_code && (
                          <div className="attempt-detail">
                            <span className="detail-label">Misconception:</span>{" "}
                            <span className="detail-val" data-testid="attempt-misconception-code">
                              {att.misconception_code}
                            </span>
                          </div>
                        )}
                        {att.reviewer_status && (
                          <div className="attempt-detail">
                            <span className="detail-label">Reviewer Status:</span>{" "}
                            <span className="detail-val" data-testid="attempt-reviewer-status">
                              {att.reviewer_status}
                            </span>
                          </div>
                        )}
                        <div className="attempt-detail">
                          <span className="detail-label">Duration:</span>{" "}
                          <span className="detail-val">{att.duration_ms}ms</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Teacher Diagnostic / Misconception Events Card */}
            {session?.misconception_events && session.misconception_events.length > 0 && (
              <section className="drawer-card" data-testid="misconception-events-card" style={{ marginTop: "1.5rem" }}>
                <h3 className="drawer-title">Teacher Diagnostic Events</h3>
                <ul className="attempts-list" data-testid="misconception-events-list">
                  {session.misconception_events.map((evt, idx) => (
                    <li key={evt.id || idx} className="attempt-item" data-testid="misconception-event-item">
                      <div className="attempt-item-header">
                        <span className="attempt-number" data-testid="event-taxonomy-code">
                          {evt.code}
                        </span>
                        <span className="counted-badge counted-no" data-testid="event-reviewer-status">
                          {evt.reviewer_status}
                        </span>
                      </div>
                      <div className="attempt-item-body">
                        <div className="attempt-detail">
                          <span className="detail-label">Confidence:</span>{" "}
                          <span className="detail-val" data-testid="event-confidence">
                            {evt.confidence}
                          </span>
                        </div>
                        <div className="attempt-detail">
                          <span className="detail-label">Recommended Prompt:</span>{" "}
                          <span className="detail-val" data-testid="event-prompt-type">
                            {evt.recommended_prompt_type}
                          </span>
                        </div>
                        <div className="attempt-detail">
                          <span className="detail-label">Evidence:</span>{" "}
                          <span className="detail-val" data-testid="event-evidence">
                            {evt.evidence}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="drawer-card" data-testid="audit-log-card">
              <h3 className="drawer-title">Session Audit Trail</h3>
              <ul className="audit-list" data-testid="audit-list">
                {auditLog.map((log, idx) => (
                  <li key={idx} className="audit-item" data-testid="audit-item">
                    <div className="audit-time">{log.timestamp}</div>
                    <div className="audit-type">{log.event_type}</div>
                    <div className="audit-details">{log.details}</div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
