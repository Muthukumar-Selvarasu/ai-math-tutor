"use client";

import React, { useState, useEffect } from "react";

export default function TeacherFlagsPage() {
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch flagged students
      const flagsRes = await fetch("/api/teacher/flagged-students", {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (!flagsRes.ok) throw new Error(`HTTP ${flagsRes.status}`);
      const flagsJson = await flagsRes.json();
      setFlaggedStudents(flagsJson);
      if (flagsJson.length > 0 && !selectedStudent) {
        setSelectedStudent(flagsJson[0]);
      }

      // Fetch recommendations
      const recsRes = await fetch("/api/teacher/recommendations", {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (recsRes.ok) {
        const recsJson = await recsRes.json();
        setRecommendations(recsJson);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReviewDecision = async (recId, decision, customRationale = null) => {
    try {
      setError(null);
      const rationaleText = customRationale || (decision === "overridden" ? "Teacher clinical review override" : `Teacher decision: marked as ${decision}`);
      const res = await fetch(`/api/teacher/recommendations/${recId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          decision,
          note: rationaleText,
          rationale: rationaleText,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      setActionMsg(`Recommendation successfully marked as ${decision}.`);
      setTimeout(() => setActionMsg(""), 3000);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
          Flag Explanation & Educator Oversight
        </h1>
        <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
          Detailed evidence drill-down for student flags and pending recommendations (EDU-02)
        </p>
      </header>

      {actionMsg && (
        <div style={{ background: "#065f46", color: "#6ee7b7", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {actionMsg}
        </div>
      )}

      {error && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#94a3b8" }}>Loading flagged student evidence...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* Flagged Students List */}
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#cbd5e1" }}>
              Flagged Students ({flaggedStudents.length})
            </h2>
            {flaggedStudents.length === 0 ? (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "8px", color: "#94a3b8" }}>
                No active student flags found.
              </div>
            ) : (
              flaggedStudents.map((s) => (
                <div
                  key={s.student_id}
                  data-testid="flagged-student-card"
                  onClick={() => setSelectedStudent(s)}
                  style={{
                    background: selectedStudent?.student_id === s.student_id ? "#334155" : "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginBottom: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{s.student_id}</span>
                    <span style={{ fontSize: "0.75rem", background: "#b91c1c", color: "#fef2f2", padding: "2px 8px", borderRadius: "4px" }}>
                      {s.flags.length} Flag{s.flags.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {s.flags.map((f) => (
                      <span key={f} style={{ fontSize: "0.7rem", background: "#0f172a", color: "#93c5fd", padding: "2px 6px", borderRadius: "4px" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Recommendations Section */}
            <div style={{ marginTop: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#cbd5e1" }}>
                Pending Recommendations ({recommendations.length})
              </h2>
              {recommendations.length === 0 ? (
                <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px", color: "#94a3b8" }}>
                  No pending recommendations.
                </div>
              ) : (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    data-testid="recommendation-card"
                    style={{
                      background: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span
                        data-testid="confidence-badge"
                        style={{
                          fontSize: "0.75rem",
                          background: rec.is_low_confidence ? "#854d0e" : "#065f46",
                          color: rec.is_low_confidence ? "#fef08a" : "#a7f3d0",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: 500,
                        }}
                      >
                        Confidence: {rec.confidence} {rec.is_low_confidence && "(Preliminary indicator only)"}
                      </span>
                      <span
                        data-testid="review-status"
                        style={{ fontSize: "0.75rem", background: "#334155", color: "#e2e8f0", padding: "2px 8px", borderRadius: "4px" }}
                      >
                        Status: {rec.review_status}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
                      {rec.recommendation}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
                      <strong>Reason:</strong> {rec.reason}
                    </div>
                    <div
                      data-testid="limitations-note"
                      style={{ fontSize: "0.8rem", color: "#cbd5e1", fontStyle: "italic", marginBottom: "0.75rem" }}
                    >
                      <strong>Limitations:</strong> {rec.limitations}
                    </div>

                    {rec.review_status === "pending_review" && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          data-testid="accept-btn"
                          onClick={() => handleReviewDecision(rec.id, "accepted")}
                          style={{ background: "#10b981", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          Accept
                        </button>
                        <button
                          data-testid="reject-btn"
                          onClick={() => handleReviewDecision(rec.id, "rejected")}
                          style={{ background: "#ef4444", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          Reject
                        </button>
                        <button
                          data-testid="override-btn"
                          onClick={() => handleReviewDecision(rec.id, "overridden")}
                          style={{ background: "#f59e0b", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          Override
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Drill-Down Evidence Details View */}
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#cbd5e1" }}>
              Flag Evidence Drill-Down
            </h2>
            {selectedStudent ? (
              <div style={{ background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem 0", color: "#f1f5f9" }}>
                  Student: {selectedStudent.student_id}
                </h3>

                {/* Flag Reasons (Non-shaming) */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Flag Explanation</h4>
                  {selectedStudent.flag_explanations.map((exp, idx) => (
                    <div
                      key={idx}
                      data-testid="flag-reason"
                      style={{ background: "#0f172a", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.25rem", color: "#fca5a5", fontSize: "0.85rem" }}
                    >
                      • {exp}
                    </div>
                  ))}
                </div>

                {/* Evidence: Attempts */}
                <div data-testid="evidence-attempts" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>
                    Attempts ({selectedStudent.evidence.attempts.length})
                  </h4>
                  <div style={{ background: "#0f172a", borderRadius: "6px", padding: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                    {selectedStudent.evidence.attempts.map((a, i) => (
                      <div key={i} style={{ fontSize: "0.8rem", padding: "4px 0", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
                        <span>Input: <strong>{a.input_value || "None"}</strong></span>
                        <span>Verdict: <span style={{ color: a.verdict === "correct" ? "#34d399" : "#f87171" }}>{a.verdict}</span></span>
                        <span>Hint Level: {a.hint_level}</span>
                        <span>{a.duration_ms}ms</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence: Skills */}
                <div data-testid="evidence-skills" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Target Skills</h4>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {selectedStudent.evidence.skills.map((sk) => (
                      <span key={sk} style={{ background: "#0f172a", color: "#a5b4fc", padding: "4px 10px", borderRadius: "4px", fontSize: "0.85rem" }}>
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Evidence: Timing */}
                <div data-testid="evidence-timing" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Timing</h4>
                  <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem", color: "#cbd5e1" }}>
                    <div>Total Response Time: {Math.round(selectedStudent.evidence.timing.total_duration_ms / 1000)}s</div>
                    <div>Average Response Time: {Math.round(selectedStudent.evidence.timing.average_duration_ms / 1000)}s</div>
                  </div>
                </div>

                {/* Evidence: Hint Levels */}
                <div data-testid="evidence-hint-levels" style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Hint Levels Reached</h4>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {selectedStudent.evidence.hint_levels.map((lvl) => (
                      <span key={lvl} style={{ background: "#0f172a", color: "#fde047", padding: "4px 8px", borderRadius: "4px", fontSize: "0.85rem" }}>
                        Level {lvl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Evidence: Sessions */}
                <div data-testid="evidence-sessions">
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Sessions</h4>
                  <div style={{ background: "#0f172a", borderRadius: "6px", padding: "0.5rem" }}>
                    {selectedStudent.evidence.sessions.map((sess) => (
                      <div key={sess.session_id} style={{ fontSize: "0.8rem", padding: "4px 0", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
                        <span>ID: {sess.session_id.slice(0, 18)}...</span>
                        <span>State: {sess.state}</span>
                        <span>Question: {sess.question_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "8px", color: "#94a3b8" }}>
                Select a student to view evidence drill-down.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
