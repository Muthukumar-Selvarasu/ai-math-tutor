"use client";

import React, { useState, useEffect } from "react";

export default function QualityIssuesPage() {
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [triageNote, setTriageNote] = useState("");

  const adminToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  const fetchIssues = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/quality-issues", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setIssues(json);
      if (json.length > 0 && !selectedIssue) {
        setSelectedIssue(json[0]);
      } else if (selectedIssue) {
        const updated = json.find((i) => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleTriage = async (issueId, decision) => {
    try {
      setError(null);
      setActionMsg(`Submitting triage decision (${decision})...`);
      const res = await fetch(`/api/admin/quality-issues/${issueId}/triage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision,
          note: triageNote || `Triage action: ${decision}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      setSelectedIssue(updated);
      setTriageNote("");
      setActionMsg(`Issue ${issueId} successfully marked as ${decision}.`);
      setTimeout(() => setActionMsg(""), 3000);
      fetchIssues();
    } catch (err) {
      setError(err.message);
      setActionMsg("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
          AI Quality Issues Review
        </h1>
        <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
          Triage verifier mismatches, candidate leakage, schema failures, and safety incidents (ADM-03)
        </p>
      </header>

      {actionMsg && (
        <div style={{ background: "#065f46", color: "#6ee7b7", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {actionMsg}
        </div>
      )}

      {error && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#94a3b8" }}>Loading AI quality issues...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          {/* Issue List */}
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#cbd5e1" }}>
              Reported Issues ({issues.length})
            </h2>
            {issues.length === 0 ? (
              <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px", color: "#94a3b8" }}>
                No AI quality issues reported.
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  data-testid="quality-issue-item"
                  onClick={() => setSelectedIssue(issue)}
                  style={{
                    background: selectedIssue?.id === issue.id ? "#334155" : "#1e293b",
                    border: `1px solid ${selectedIssue?.id === issue.id ? "#60a5fa" : "#475569"}`,
                    borderRadius: "8px",
                    padding: "1rem",
                    marginBottom: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span
                      data-testid="issue-type-badge"
                      style={{
                        fontSize: "0.75rem",
                        background:
                          issue.issue_type === "safety_incident" || issue.issue_type === "leakage_event"
                            ? "#7f1d1d"
                            : "#854d0e",
                        color:
                          issue.issue_type === "safety_incident" || issue.issue_type === "leakage_event"
                            ? "#fecaca"
                            : "#fef08a",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {issue.issue_type}
                    </span>
                    <span
                      data-testid="issue-status"
                      style={{
                        fontSize: "0.75rem",
                        background: issue.status === "triaged" ? "#065f46" : "#475569",
                        color: issue.status === "triaged" ? "#a7f3d0" : "#e2e8f0",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {issue.status} {issue.triage_decision && `(${issue.triage_decision})`}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                    {issue.description}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Trace: <code>{issue.trace_id}</code>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Issue Detail & Triage */}
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#cbd5e1" }}>
              Triage & Trace Review
            </h2>
            {selectedIssue ? (
              <div
                data-testid="quality-issue-detail"
                style={{
                  background: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  padding: "1.5rem",
                }}
              >
                <div style={{ marginBottom: "1rem" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "#f8fafc", fontSize: "1.1rem" }}>
                    Issue: {selectedIssue.id}
                  </h3>
                  <div style={{ color: "#cbd5e1", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    {selectedIssue.description}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    Type: <strong>{selectedIssue.issue_type}</strong> | Severity: <strong>{selectedIssue.severity}</strong>
                  </div>
                </div>

                {/* Langfuse Trace Link */}
                <div style={{ marginBottom: "1.5rem", background: "#0f172a", padding: "1rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Langfuse Observability Trace:
                  </div>
                  <a
                    data-testid="langfuse-trace-link"
                    href={selectedIssue.trace_link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#60a5fa",
                      textDecoration: "underline",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedIssue.trace_link}
                  </a>
                </div>

                {/* Structured Details */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
                    Structured Event Details:
                  </div>
                  <pre
                    style={{
                      background: "#0f172a",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      color: "#cbd5e1",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(selectedIssue.details, null, 2)}
                  </pre>
                </div>

                {/* Triage Decision Section */}
                <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#f1f5f9", fontSize: "0.95rem" }}>
                    Triage Decision
                  </h4>
                  {selectedIssue.status === "triaged" ? (
                    <div
                      data-testid="triaged-status-box"
                      style={{
                        background: "#0f172a",
                        padding: "1rem",
                        borderRadius: "6px",
                        marginBottom: "1rem",
                      }}
                    >
                      <div style={{ color: "#34d399", fontWeight: 600, fontSize: "0.9rem" }}>
                        Decision: {selectedIssue.triage_decision.toUpperCase()}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                        Note: {selectedIssue.triage_note || "None"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        Triaged by {selectedIssue.triaged_by} at {new Date(selectedIssue.triaged_at).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                          Triage Note / Remediation:
                        </label>
                        <input
                          data-testid="triage-note-input"
                          type="text"
                          value={triageNote}
                          onChange={(e) => setTriageNote(e.target.value)}
                          placeholder="e.g. Quarantined prompt template; patched verifier boundary"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #475569",
                            background: "#0f172a",
                            color: "#f8fafc",
                            fontSize: "0.85rem",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          data-testid="triage-dismiss-btn"
                          onClick={() => handleTriage(selectedIssue.id, "dismiss")}
                          style={{
                            background: "#64748b",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          Dismiss
                        </button>
                        <button
                          data-testid="triage-escalate-btn"
                          onClick={() => handleTriage(selectedIssue.id, "escalate")}
                          style={{
                            background: "#f59e0b",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          Escalate
                        </button>
                        <button
                          data-testid="triage-quarantine-btn"
                          onClick={() => handleTriage(selectedIssue.id, "quarantine")}
                          style={{
                            background: "#ef4444",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Quarantine
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "8px", color: "#94a3b8" }}>
                Select an issue to inspect details and trace.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
