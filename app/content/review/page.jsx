"use client";

import React, { useState, useEffect } from "react";

export default function ContentReviewPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [userRole, setUserRole] = useState("content_reviewer");

  const reviewerToken = JSON.stringify({
    sub: "user_2test_con_001",
    role: userRole,
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/content/review-items", {
        headers: {
          Authorization: `Bearer ${reviewerToken}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [userRole]);

  const handleDecision = async (itemId, decision) => {
    try {
      setError(null);
      const res = await fetch(`/api/content/review-items/${itemId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${reviewerToken}`,
        },
        body: JSON.stringify({
          decision,
          note: `Content decision: ${decision}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      setActionMsg(`Item ${itemId} successfully marked as ${decision}.`);
      setTimeout(() => setActionMsg(""), 3000);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
              Content Quality & Item Review Queue
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
              Review flagged questions, verify diagrams, and approve or reject content before student delivery (EDU-06, FR-14)
            </p>
          </div>
          <div>
            <label style={{ fontSize: "0.85rem", color: "#94a3b8", marginRight: "0.5rem" }}>
              Active View Role:
            </label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid #475569",
                borderRadius: "4px",
                padding: "4px 8px",
              }}
            >
              <option value="content_reviewer">Content Reviewer</option>
              <option value="teacher">Teacher (Read-only)</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>
        </div>
      </header>

      {userRole === "teacher" && (
        <div
          data-testid="read-only-notice"
          style={{ background: "#1e293b", border: "1px solid #38bdf8", color: "#38bdf8", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}
        >
          Teacher Read-Only Mode: You may inspect content quality flags and supporting evidence, but decision actions are reserved for content reviewers.
        </div>
      )}

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
        <div style={{ color: "#94a3b8" }}>Loading content review queue...</div>
      ) : (
        <div data-testid="review-queue-list" style={{ display: "grid", gap: "1rem" }}>
          {items.map((item) => (
            <div
              key={item.id}
              data-testid={`review-item-${item.id}`}
              style={{
                background: "#1e293b",
                border: item.flagged ? "1px solid #f59e0b" : "1px solid #334155",
                borderRadius: "8px",
                padding: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: "600", margin: 0, color: "#f8fafc" }}>
                    {item.title || item.question_id}
                  </h2>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    ID: {item.question_id} | Skill: {item.skill_id}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {item.flagged && (
                    <span
                      data-testid="flag-badge"
                      style={{ fontSize: "0.75rem", background: "#78350f", color: "#fcd34d", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}
                    >
                      FLAGGED FOR REVIEW
                    </span>
                  )}
                  <span
                    data-testid="publication-badge"
                    style={{
                      fontSize: "0.75rem",
                      background: item.publication_status === "published" ? "#065f46" : "#334155",
                      color: item.publication_status === "published" ? "#6ee7b7" : "#cbd5e1",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    Publication: {item.publication_status}
                  </span>
                  <span
                    data-testid="validation-badge"
                    style={{
                      fontSize: "0.75rem",
                      background: item.validation_status === "approved" ? "#065f46" : item.validation_status === "rejected" ? "#7f1d1d" : "#334155",
                      color: "#f8fafc",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    Validation: {item.validation_status}
                  </span>
                </div>
              </div>

              {/* Flag reason and supporting evidence (EDU-06 AC1) */}
              {item.flagged && (
                <div
                  style={{
                    background: "#0f172a",
                    border: "1px solid #78350f",
                    borderRadius: "6px",
                    padding: "0.75rem 1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.9rem", color: "#fbbf24", marginBottom: "0.25rem" }}>
                    <strong>Flag Reason:</strong> <span data-testid="flag-reason">{item.flag_reason || "Content quality flag"}</span>
                  </div>
                  {item.evidence && (
                    <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                      <strong>Supporting Evidence:</strong>{" "}
                      <span data-testid="flag-evidence">
                        {typeof item.evidence === "string" ? item.evidence : JSON.stringify(item.evidence)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions for content reviewer / admin (EDU-06 AC2, AC3) */}
              {userRole !== "teacher" && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    data-testid="approve-item-btn"
                    onClick={() => handleDecision(item.id, "approved")}
                    style={{ background: "#10b981", color: "#ffffff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "500" }}
                  >
                    Approve
                  </button>
                  <button
                    data-testid="reject-item-btn"
                    onClick={() => handleDecision(item.id, "rejected")}
                    style={{ background: "#ef4444", color: "#ffffff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "500" }}
                  >
                    Reject
                  </button>
                  <button
                    data-testid="deprecate-item-btn"
                    onClick={() => handleDecision(item.id, "deprecated")}
                    style={{ background: "#64748b", color: "#ffffff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "500" }}
                  >
                    Deprecate
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
