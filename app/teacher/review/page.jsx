"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function TeacherReviewQueuePage() {
  const [reviewList, setReviewList] = useState([]);
  const [filter, setFilter] = useState("all"); // "all", "needs_review", "not_enough_evidence", "on_track"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const fetchReviewList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/teacher/review-list", {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReviewList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewList();
  }, []);

  const filteredStudents = reviewList.filter((item) => {
    if (filter === "needs_review") return item.flagged;
    if (filter === "not_enough_evidence") return item.evidence_status === "not_enough_evidence_yet";
    if (filter === "on_track") return item.evidence_status === "on_track";
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
              Student Review Queue
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
              Direct educator triage for students needing support (EDU-01)
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link
              href="/teacher/flags"
              style={{
                background: "#334155",
                color: "#e2e8f0",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Flag Explanations
            </Link>
            <button
              onClick={fetchReviewList}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Notice: Not a leaderboard */}
        <div
          data-testid="non-leaderboard-notice"
          style={{
            marginTop: "1rem",
            background: "#1e293b",
            borderLeft: "4px solid #3b82f6",
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            color: "#94a3b8",
            fontSize: "0.875rem",
          }}
        >
          <strong>Pedagogical Guidance Note:</strong> This view is strictly ordered by educational intervention need. It is not a leaderboard, performance rank, or grading scale.
        </div>
      </header>

      {error && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1.5rem" }}>
          Error: {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {[
          { id: "all", label: `All Assigned (${reviewList.length})` },
          { id: "needs_review", label: `Needs Review (${reviewList.filter((r) => r.flagged).length})` },
          { id: "not_enough_evidence", label: `Not Enough Evidence (${reviewList.filter((r) => r.evidence_status === "not_enough_evidence_yet").length})` },
          { id: "on_track", label: `On Track (${reviewList.filter((r) => r.evidence_status === "on_track").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: filter === tab.id ? "#3b82f6" : "#1e293b",
              color: filter === tab.id ? "#ffffff" : "#94a3b8",
              cursor: "pointer",
              fontWeight: filter === tab.id ? "600" : "normal",
              fontSize: "0.875rem",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          Loading student review data from persisted attempts...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: "#1e293b", borderRadius: "8px", color: "#94a3b8" }}>
          No students found matching current filter.
        </div>
      ) : (
        <div style={{ background: "#1e293b", borderRadius: "8px", overflow: "hidden", border: "1px solid #334155" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Student</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem" }}>Matching Reason / Rule</th>
                <th style={{ padding: "0.75rem 1rem" }}>Relevant Attempts</th>
                <th style={{ padding: "0.75rem 1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((item) => {
                const isNeedsReview = item.flagged;
                const isNotEnough = item.evidence_status === "not_enough_evidence_yet";

                return (
                  <tr
                    key={item.student_id}
                    data-testid={`student-row-${item.student_id}`}
                    style={{
                      borderBottom: "1px solid #334155",
                      background: isNeedsReview ? "rgba(239, 68, 68, 0.05)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "1rem", fontWeight: "600", color: "#f8fafc" }}>
                      {item.student_id}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      {isNeedsReview ? (
                        <span
                          data-testid="badge-needs-review"
                          style={{
                            background: "#7f1d1d",
                            color: "#fca5a5",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          Needs Review
                        </span>
                      ) : isNotEnough ? (
                        <span
                          data-testid="badge-not-enough-evidence"
                          style={{
                            background: "#334155",
                            color: "#94a3b8",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          Not Enough Evidence
                        </span>
                      ) : (
                        <span
                          data-testid="badge-on-track"
                          style={{
                            background: "#065f46",
                            color: "#6ee7b7",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          On Track
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "1rem", color: isNeedsReview ? "#fca5a5" : "#94a3b8" }}>
                      {item.reason}
                    </td>
                    <td style={{ padding: "1rem", color: "#cbd5e1" }}>
                      {item.relevant_attempts_count} attempt{item.relevant_attempts_count === 1 ? "" : "s"}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link
                          href={`/teacher/flags?student_id=${item.student_id}`}
                          style={{
                            color: "#60a5fa",
                            textDecoration: "underline",
                            fontSize: "0.8rem",
                          }}
                        >
                          Drill-Down
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
