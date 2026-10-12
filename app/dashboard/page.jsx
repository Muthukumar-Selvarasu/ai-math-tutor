"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";

export default function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentId, setStudentId] = useState("student_default");
  const [isPending, startTransition] = useTransition();

  function fetchDashboard(id) {
    setLoading(true);
    fetch(`/api/me/dashboard?student_id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard");
        return res.json();
      })
      .then((data) => {
        setDashboard(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlStudentId = params.get("student_id");
      if (urlStudentId) {
        setStudentId(urlStudentId);
        fetchDashboard(urlStudentId);
        return;
      }
    }
    fetchDashboard(studentId);
  }, [studentId]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header>
        <div className="logo-container">
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem", color: "inherit" }}>
            <div className="logo-badge">SP</div>
            <span className="logo-title">SolvePath</span>
          </Link>
        </div>
        <nav className="auth-nav" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link href="/practice" style={{ textDecoration: "none" }}>
            <button className="btn btn-secondary" data-testid="nav-practice-btn">
              🎯 Practice
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label htmlFor="student-select" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Student:
            </label>
            <input
              id="student-select"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
                padding: "0.3rem 0.6rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                width: "140px",
              }}
              data-testid="student-id-input"
            />
          </div>
        </nav>
      </header>

      <main style={{ display: "block", maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "2rem 1.5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }} data-testid="dashboard-loading">
            Loading your progress dashboard...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#f87171" }} data-testid="dashboard-error">
            Error: {error}
          </div>
        ) : !dashboard ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Header Banner & Rollup Freshness Info */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                padding: "1.25rem 1.75rem",
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "16px",
              }}
            >
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  My Learning Progress
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
                  Celebrate your accomplishments, see how you are improving, and discover your next steps.
                </p>
              </div>

              {/* Rollup Freshness (AC2) */}
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  color: "#93c5fd",
                }}
                data-testid="rollup-timestamp"
              >
                <strong>Hourly Rollup:</strong>{" "}
                {dashboard.rollup_at
                  ? new Date(dashboard.rollup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
                    " (" +
                    new Date(dashboard.rollup_at).toLocaleDateString() +
                    ")"
                  : "Pending first scheduled run"}
              </div>
            </div>

            {/* Empty State (AC4) */}
            {dashboard.empty_state ? (
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "20px",
                  padding: "3.5rem 2.5rem",
                  textAlign: "center",
                }}
                data-testid="dashboard-empty-state"
              >
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌟</div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                  Welcome to Your Learning Journey!
                </h2>
                <p style={{ color: "var(--text-muted)", maxWidth: "560px", margin: "0 auto 2rem auto", lineHeight: "1.6" }}>
                  You haven&apos;t completed any practice questions yet. Try your first question to begin exploring
                  mathematical concepts with supportive Socratic guidance.
                </p>

                {dashboard.first_question && (
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "12px",
                      padding: "1.5rem",
                      maxWidth: "500px",
                      margin: "0 auto 2rem auto",
                      textAlign: "left",
                    }}
                    data-testid="first-question-card"
                  >
                    <div style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600, marginBottom: "0.25rem" }}>
                      FIRST QUESTION
                    </div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      {dashboard.first_question.title}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                      {dashboard.first_question.stem}
                    </p>
                  </div>
                )}

                <Link
                  href={`/practice?question_id=${dashboard.first_question?.question_id || "ratio_share_001"}&student_id=${encodeURIComponent(studentId)}`}
                  style={{ textDecoration: "none" }}
                >
                  <button className="btn btn-primary" style={{ padding: "0.85rem 2.2rem", fontSize: "1.05rem" }} data-testid="start-first-question-btn">
                    🚀 Start First Question
                  </button>
                </Link>
              </div>
            ) : (
              <>
                {/* Next Practice Recommendation Card */}
                {dashboard.next_practice && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "16px",
                      padding: "1.75rem 2rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1.5rem",
                    }}
                    data-testid="next-practice-card"
                  >
                    <div style={{ flex: "1 1 400px" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#60a5fa", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Recommended Next Practice
                      </div>
                      <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0.35rem 0" }} data-testid="next-practice-title">
                        {dashboard.next_practice.title}
                      </h2>
                      <p style={{ color: "var(--foreground)", fontSize: "0.95rem", marginBottom: "0.5rem" }} data-testid="next-practice-stem">
                        {dashboard.next_practice.stem}
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }} data-testid="next-practice-reason">
                        💡 {dashboard.next_practice.reason}
                      </p>
                    </div>
                    <div>
                      <Link
                        href={`/practice?question_id=${dashboard.next_practice.question_id}&student_id=${encodeURIComponent(studentId)}`}
                        style={{ textDecoration: "none" }}
                      >
                        <button
                          className="btn btn-primary"
                          style={{ padding: "0.85rem 1.75rem", fontSize: "1rem", whiteSpace: "nowrap" }}
                          data-testid="start-next-practice-btn"
                        >
                          Continue Practice →
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Overview Metrics Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
                  {/* Independent Success */}
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "14px",
                      padding: "1.5rem",
                    }}
                    data-testid="independent-success-card"
                  >
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
                      Independent Success
                    </div>
                    <div
                      style={{ fontSize: "2.25rem", fontWeight: 700, color: "#34d399", margin: "0.5rem 0" }}
                      data-testid="independent-success-value"
                    >
                      {Math.round(dashboard.independent_success_rate * 100)}%
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                      Questions solved accurately on your very first independent try.
                    </p>
                  </div>

                  {/* Transfer Results */}
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "14px",
                      padding: "1.5rem",
                    }}
                    data-testid="transfer-results-card"
                  >
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
                      Transfer Questions
                    </div>
                    <div
                      style={{ fontSize: "2.25rem", fontWeight: 700, color: "#60a5fa", margin: "0.5rem 0" }}
                      data-testid="transfer-results-count"
                    >
                      {dashboard.transfer_results.length} Completed
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                      Similar problems attempted to solidify understanding and concept connections.
                    </p>
                  </div>

                  {/* Hint Trend */}
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "14px",
                      padding: "1.5rem",
                    }}
                    data-testid="hint-trend-card"
                  >
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
                      Support Dependency Trend
                    </div>
                    <div
                      style={{ fontSize: "2.25rem", fontWeight: 700, color: "#c084fc", margin: "0.5rem 0" }}
                      data-testid="hint-trend-value"
                    >
                      {dashboard.hint_trend.length > 0
                        ? `L${Math.round(
                            dashboard.hint_trend.reduce((acc, t) => acc + (t.hint_level || 0), 0) /
                              dashboard.hint_trend.length
                          )} Avg`
                        : "0 Hints"}
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                      Average level of tutor hints required across recent practice sessions.
                    </p>
                  </div>
                </div>

                {/* Strengths & Next Focus */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
                  {/* Strengths */}
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "16px",
                      padding: "1.75rem",
                    }}
                    data-testid="strengths-section"
                  >
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>✨</span> Current Strengths
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} data-testid="strengths-list">
                      {dashboard.strengths.length > 0 ? (
                        dashboard.strengths.map((str, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(52, 211, 153, 0.08)",
                              border: "1px solid rgba(52, 211, 153, 0.2)",
                              borderRadius: "10px",
                              padding: "0.85rem 1rem",
                            }}
                            data-testid="strength-item"
                          >
                            <div style={{ fontWeight: 600, color: "#6ee7b7", fontSize: "0.95rem" }}>
                              {str.skill_name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--foreground)", marginTop: "0.25rem" }}>
                              {str.summary}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                          Practise questions to unlock your strengths!
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Next Focus */}
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "16px",
                      padding: "1.75rem",
                    }}
                    data-testid="next-focus-section"
                  >
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>🎯</span> Next Focus Areas
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} data-testid="next-focus-list">
                      {dashboard.next_focus.length > 0 ? (
                        dashboard.next_focus.map((foc, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(139, 92, 246, 0.08)",
                              border: "1px solid rgba(139, 92, 246, 0.2)",
                              borderRadius: "10px",
                              padding: "0.85rem 1rem",
                            }}
                            data-testid="next-focus-item"
                          >
                            <div style={{ fontWeight: 600, color: "#c4b5fd", fontSize: "0.95rem" }}>
                              {foc.skill_name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--foreground)", marginTop: "0.25rem" }}>
                              {foc.recommended_action}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                          All current skills are progressing well.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Skills List */}
                <div
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "16px",
                    padding: "1.75rem",
                  }}
                  data-testid="current-skills-section"
                >
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.25rem" }}>
                    Curriculum Skills & Mastery
                  </h3>
                  <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}
                    data-testid="current-skills-list"
                  >
                    {dashboard.current_skills.map((skill) => (
                      <div
                        key={skill.skill_id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "12px",
                          padding: "1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                        data-testid="skill-card"
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "1rem" }}>{skill.skill_name}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{skill.skill_id}</div>
                          </div>
                          <span
                            style={{
                              padding: "0.2rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background:
                                skill.status === "Proficient"
                                  ? "rgba(52, 211, 153, 0.15)"
                                  : "rgba(96, 165, 250, 0.15)",
                              color: skill.status === "Proficient" ? "#34d399" : "#60a5fa",
                            }}
                            data-testid="skill-status"
                          >
                            {skill.status}
                          </span>
                        </div>

                        {/* Mastery Estimate Bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem", color: "var(--text-muted)" }}>
                            <span>Mastery Estimate</span>
                            <span data-testid="skill-mastery">{Math.round(skill.mastery_estimate * 100)}%</span>
                          </div>
                          <div
                            style={{
                              height: "6px",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                            aria-label={`Mastery estimate: ${Math.round(skill.mastery_estimate * 100)} percent`}
                          >
                            <div
                              style={{
                                width: `${Math.round(skill.mastery_estimate * 100)}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #3b82f6, #34d399)",
                                borderRadius: "3px",
                              }}
                            />
                          </div>
                        </div>

                        {/* Confidence Badge */}
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                          <span>Confidence Level</span>
                          <span data-testid="skill-confidence">
                            {Math.round(skill.mastery_confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Sessions List */}
                <div
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "16px",
                    padding: "1.75rem",
                  }}
                  data-testid="recent-sessions-section"
                >
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.25rem" }}>
                    Recent Practice Sessions
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} data-testid="recent-sessions-list">
                    {dashboard.recent_sessions.map((sess) => (
                      <div
                        key={sess.session_id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "10px",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                        data-testid="session-row"
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{sess.question_title}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                            {sess.question_id} • {sess.skill_id} • {new Date(sess.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              background: "rgba(255, 255, 255, 0.05)",
                              color: "var(--text-muted)",
                            }}
                          >
                            Level {sess.hint_level}
                          </span>

                          {sess.transfer_outcome && (
                            <span
                              style={{
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background:
                                  sess.transfer_outcome === "correct"
                                    ? "rgba(52, 211, 153, 0.15)"
                                    : "rgba(239, 68, 68, 0.15)",
                                color: sess.transfer_outcome === "correct" ? "#34d399" : "#f87171",
                              }}
                              data-testid="transfer-outcome-badge"
                            >
                              Transfer: {sess.transfer_outcome}
                            </span>
                          )}

                          <span
                            style={{
                              padding: "0.25rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              background:
                                sess.state === "completed"
                                  ? "rgba(52, 211, 153, 0.15)"
                                  : "rgba(96, 165, 250, 0.15)",
                              color: sess.state === "completed" ? "#34d399" : "#60a5fa",
                            }}
                            data-testid="session-state-badge"
                          >
                            {sess.state}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
