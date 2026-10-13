"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function TeacherSessionReplayPage() {
  const params = useParams();
  const sessionId = params?.session_id;

  const [replayData, setReplayData] = useState(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const fetchReplay = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/teacher/sessions/${sessionId}/replay`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReplayData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplay();
  }, [sessionId]);

  const handleReviewMisconception = async (turnNumber, status) => {
    try {
      const res = await fetch(`/api/teacher/sessions/${sessionId}/misconception-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          turn_number: turnNumber,
          reviewer_status: status,
          note: `Teacher reviewed misconception as ${status}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      setActionMsg(`Misconception on Turn ${turnNumber} marked as ${status}.`);
      setTimeout(() => setActionMsg(""), 3000);
      fetchReplay();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
        Loading session replay...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "1rem", borderRadius: "8px" }}>
          Replay Access Error: {error}
        </div>
      </div>
    );
  }

  const turns = replayData?.turns || [];
  const currentTurn = turns[selectedTurnIndex] || null;
  const recommendation = replayData?.recommendations?.[0] || null;

  return (
    <div data-testid="replay-container" style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      {/* Header */}
      <header style={{ marginBottom: "1.5rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", margin: 0, color: "#f1f5f9" }}>
              Session Replay: {sessionId}
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
              Question: {replayData?.question_id} | Status: {replayData?.status} | Cohort: {replayData?.cohort_id}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span style={{ background: "#1e293b", padding: "4px 10px", borderRadius: "6px", fontSize: "0.85rem", color: "#93c5fd" }}>
              Question v{replayData?.question_version}
            </span>
            <span style={{ background: "#1e293b", padding: "4px 10px", borderRadius: "6px", fontSize: "0.85rem", color: "#a5b4fc" }}>
              Diagram v{replayData?.diagram_version}
            </span>
          </div>
        </div>
      </header>

      {actionMsg && (
        <div style={{ background: "#065f46", color: "#6ee7b7", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {actionMsg}
        </div>
      )}

      {/* Timeline Scrub / Navigation */}
      <div data-testid="turn-selector" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {turns.map((t, idx) => (
          <button
            key={t.turn_number}
            data-testid={`turn-button-${t.turn_number}`}
            onClick={() => setSelectedTurnIndex(idx)}
            style={{
              background: selectedTurnIndex === idx ? "#3b82f6" : "#1e293b",
              color: "#ffffff",
              border: "1px solid #475569",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Turn {t.turn_number}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Main Turn Details */}
        {currentTurn && (
          <div
            data-testid="turn-card"
            style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "1.5rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#e2e8f0" }}>
                Turn {currentTurn.turn_number}
              </h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span
                  data-testid="turn-verifier-status"
                  style={{
                    background: currentTurn.verifier_status === "correct" ? "#065f46" : "#7f1d1d",
                    color: currentTurn.verifier_status === "correct" ? "#6ee7b7" : "#fca5a5",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  {currentTurn.verifier_status}
                </span>
                <span
                  data-testid="turn-hint-level"
                  style={{ background: "#334155", color: "#fde047", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem" }}
                >
                  Hint Level {currentTurn.hint_level}
                </span>
              </div>
            </div>

            {/* Student Response */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Student Response</div>
              {currentTurn.body_purged ? (
                <div
                  data-testid="purged-body-notice"
                  style={{ background: "#0f172a", border: "1px dashed #64748b", padding: "0.75rem", borderRadius: "6px", color: "#94a3b8", fontSize: "0.85rem" }}
                >
                  [Message body purged in compliance with data retention policy]
                </div>
              ) : (
                <div
                  data-testid="turn-student-response"
                  style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "6px", color: "#f8fafc", fontSize: "0.95rem" }}
                >
                  {currentTurn.student_response || "None (Initial turn)"}
                </div>
              )}
            </div>

            {/* Tutor Output */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Tutor Guidance</div>
              {currentTurn.body_purged ? (
                <div style={{ background: "#0f172a", border: "1px dashed #64748b", padding: "0.75rem", borderRadius: "6px", color: "#94a3b8", fontSize: "0.85rem" }}>
                  [Tutor output purged in compliance with data retention policy]
                </div>
              ) : (
                <div
                  data-testid="turn-tutor-output"
                  style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "6px", color: "#93c5fd", fontSize: "0.95rem" }}
                >
                  {currentTurn.tutor_output}
                </div>
              )}
            </div>

            {/* Misconception & Reviewer Status */}
            <div style={{ marginBottom: "1.25rem", background: "#0f172a", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span data-testid="turn-misconception" style={{ fontWeight: 600, color: "#fca5a5" }}>
                  Misconception: {currentTurn.misconception?.code}
                </span>
                <span
                  data-testid="reviewer-status-badge"
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: currentTurn.misconception?.reviewer_status === "confirmed" ? "#065f46" : currentTurn.misconception?.reviewer_status === "rejected" ? "#7f1d1d" : "#334155",
                    color: "#f8fafc",
                  }}
                >
                  Reviewer: {currentTurn.misconception?.reviewer_status}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  data-testid="confirm-misconception-btn"
                  onClick={() => handleReviewMisconception(currentTurn.turn_number, "confirmed")}
                  style={{ background: "#10b981", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Confirm Misconception
                </button>
                <button
                  data-testid="reject-misconception-btn"
                  onClick={() => handleReviewMisconception(currentTurn.turn_number, "rejected")}
                  style={{ background: "#ef4444", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Reject Misconception
                </button>
              </div>
            </div>

            {/* Learner Model Change */}
            <div data-testid="turn-learner-delta" style={{ marginBottom: "1.25rem", fontSize: "0.85rem", color: "#94a3b8" }}>
              <strong>Learner Model Delta:</strong> Mastery: +{currentTurn.learner_model_change?.mastery_delta} | Confidence: +{currentTurn.learner_model_change?.confidence_delta}
            </div>

            {/* Turn Metadata */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #334155", paddingTop: "0.75rem" }}>
              <span>Model: {currentTurn.model} ({currentTurn.model_version})</span>
              <span>Prompt: v{currentTurn.prompt_version}</span>
              <span>Policy: v{currentTurn.policy_version}</span>
              <span>Time: {new Date(currentTurn.audit_timestamps?.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* Sidebar: Pending Draft Recommendation */}
        <div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "#cbd5e1" }}>
            Teacher Recommendation
          </h3>
          {recommendation ? (
            <div
              data-testid="pending-recommendation-card"
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "1.25rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", background: "#065f46", color: "#6ee7b7", padding: "2px 8px", borderRadius: "4px" }}>
                  Confidence: {recommendation.confidence}
                </span>
                <span style={{ fontSize: "0.75rem", background: "#334155", color: "#e2e8f0", padding: "2px 8px", borderRadius: "4px" }}>
                  {recommendation.review_status}
                </span>
              </div>
              <div style={{ fontWeight: 600, color: "#f8fafc", marginBottom: "0.5rem" }}>
                {recommendation.recommendation}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
                <strong>Reason:</strong> {recommendation.reason}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1", fontStyle: "italic", marginBottom: "0.75rem" }}>
                <strong>Limitations:</strong> {recommendation.limitations}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#38bdf8" }}>
                <strong>Suggested Action:</strong> {recommendation.suggested_action}
              </div>
            </div>
          ) : (
            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px", color: "#94a3b8" }}>
              No active recommendation.
            </div>
          )}

          {/* Tutor Notes (EDU-09 AC2) */}
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "#cbd5e1" }}>
              Tutor Observations & Notes
            </h3>
            {replayData?.tutor_notes && replayData.tutor_notes.length > 0 ? (
              <div data-testid="tutor-notes-list" style={{ display: "grid", gap: "0.5rem" }}>
                {replayData.tutor_notes.map((note) => (
                  <div
                    key={note.id}
                    data-testid="tutor-note-card"
                    style={{
                      background: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ color: "#38bdf8", fontWeight: 600, marginBottom: "0.25rem" }}>
                      Note from {note.author_id}
                    </div>
                    <div data-testid="tutor-note-body" style={{ color: "#f8fafc" }}>
                      {note.body}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px", color: "#94a3b8", fontSize: "0.85rem" }}>
                No tutor notes attached to this session.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
