"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function PracticePage() {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answerInput, setAnswerInput] = useState("");
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
      const res = await fetch(`/api/sessions/${sessionData.session.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "submit",
          answer_text: answerInput.trim(),
          response_target: "final",
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
            event_type: "attempt_submitted",
            timestamp: new Date().toLocaleTimeString(),
            details: `Attempt #${result.attempt.attempt_number} submitted ("${answerInput}", Level ${result.attempt.hint_level}, duration: ${duration}ms)`,
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
                  <div className="input-wrapper">
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

                  {controls.includes("show_solution") && (
                    <button
                      type="button"
                      className="btn btn-secondary show-solution-btn"
                      data-testid="show-solution-btn"
                    >
                      Show Solution
                    </button>
                  )}
                </div>
              </form>
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
                          {att.counted ? `Attempt #${att.attempt_number}` : "Uncertainty Request"}
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
                        <div className="attempt-detail">
                          <span className="detail-label">Hint Level:</span>{" "}
                          <span className="detail-val">Level {att.hint_level}</span>
                        </div>
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
