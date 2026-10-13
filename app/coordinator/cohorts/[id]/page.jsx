"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CoordinatorCohortSummaryPage() {
  const params = useParams();
  const cohortId = params?.id || "cohort_ratio_foundation";

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingSetting, setSavingSetting] = useState(false);
  const [settingMessage, setSettingMessage] = useState("");

  const coordinatorToken = JSON.stringify({
    sub: "user_2test_coord_001",
    role: "coordinator",
  });

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/coordinator/cohorts/${cohortId}/summary`, {
        headers: { Authorization: `Bearer ${coordinatorToken}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cohortId) {
      loadSummary();
    }
  }, [cohortId]);

  const toggleAllowLevel5 = async () => {
    if (!summary) return;
    try {
      setSavingSetting(true);
      setSettingMessage("");
      const nextVal = !summary.allow_level_5;
      const res = await fetch(`/api/coordinator/cohorts/${cohortId}/settings`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${coordinatorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allow_level_5: nextVal }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      setSummary((prev) => (prev ? { ...prev, allow_level_5: nextVal } : null));
      setSettingMessage(`Level 5 hints are now ${nextVal ? "enabled" : "disabled"} for this cohort.`);
      setTimeout(() => setSettingMessage(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSetting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
              Cohort Progress Summary: <span style={{ color: "#38bdf8" }}>{summary?.name || cohortId}</span>
            </h1>
            <p style={{ color: "#94a3b8", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Academic Coordinator Oversight & Support Configuration (Non-leaderboard)
            </p>
          </div>
          <button
            onClick={() => loadSummary()}
            style={{
              background: "#1e293b",
              border: "1px solid #3b82f6",
              color: "#38bdf8",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          Loading cohort summary...
        </div>
      )}

      {error && (
        <div
          data-testid="error-banner"
          style={{
            background: "#450a0a",
            border: "1px solid #ef4444",
            borderRadius: "0.5rem",
            padding: "1rem",
            color: "#fca5a5",
            marginBottom: "2rem",
          }}
        >
          <strong>Access Notice:</strong> {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Cohort Control Card */}
          <div
            data-testid="cohort-control-card"
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.125rem", margin: 0, color: "#f8fafc" }}>Cohort Support Settings</h2>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#94a3b8" }}>
                Active learners: <strong style={{ color: "#f8fafc" }}>{summary.active_students_count}</strong> | Total sessions: <strong style={{ color: "#f8fafc" }}>{summary.total_sessions_count}</strong>
              </p>
              {settingMessage && (
                <div style={{ marginTop: "0.5rem", color: "#34d399", fontSize: "0.875rem" }}>
                  {settingMessage}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.875rem", color: "#cbd5e1" }}>Level 5 Hints:</div>
                <div
                  data-testid="level-5-status-badge"
                  style={{
                    fontWeight: "bold",
                    color: summary.allow_level_5 ? "#34d399" : "#94a3b8",
                  }}
                >
                  {summary.allow_level_5 ? "Allowed" : "Restricted (Default)"}
                </div>
              </div>
              <button
                data-testid="toggle-level-5-btn"
                onClick={toggleAllowLevel5}
                disabled={savingSetting}
                style={{
                  background: summary.allow_level_5 ? "#dc2626" : "#059669",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  fontWeight: 600,
                  cursor: savingSetting ? "not-allowed" : "pointer",
                }}
              >
                {savingSetting ? "Saving..." : summary.allow_level_5 ? "Disable Level 5" : "Enable Level 5"}
              </button>
            </div>
          </div>

          {/* Cohort Skill Mastery */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Cohort Aggregate Skill Mastery
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
              {summary.cohort_mastery.map((m) => (
                <div
                  key={m.skill_id}
                  data-testid={`cohort-mastery-${m.skill_id}`}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                  }}
                >
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "#f8fafc" }}>{m.skill_name}</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                    <span style={{ color: "#94a3b8" }}>Average Mastery:</span>
                    <span style={{ fontWeight: 600, color: "#38bdf8" }}>{(m.average_mastery * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ background: "#0f172a", borderRadius: "9999px", height: "8px", overflow: "hidden", marginBottom: "0.75rem" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, m.average_mastery * 100))}%`,
                        background: "#38bdf8",
                        height: "100%",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Active learners: {m.active_learners}</span>
                    <span>Proficient: {m.status_distribution?.proficient || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Intervention Insights & Recommendation Outcomes */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Intervention Insights & Recommendation Transfer Outcomes
            </h2>
            {summary.intervention_insights?.length === 0 ? (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "0.5rem", color: "#94a3b8" }}>
                No active intervention recommendations drafted yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {summary.intervention_insights.map((rec) => (
                  <div
                    key={rec.recommendation_id}
                    data-testid={`rec-insight-${rec.recommendation_id}`}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "0.5rem",
                      padding: "1.25rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: "bold", color: "#f8fafc" }}>Recommendation #{rec.recommendation_id}</span>
                        <span
                          style={{
                            background: rec.review_status === "accepted" ? "#065f46" : "#334155",
                            color: rec.review_status === "accepted" ? "#6ee7b7" : "#cbd5e1",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          Status: {rec.review_status}
                        </span>
                      </div>
                      <p style={{ margin: "0.25rem 0", color: "#cbd5e1", fontSize: "0.875rem" }}>
                        {rec.suggested_action}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Later Transfer Outcome:</div>
                      <div
                        data-testid="later-transfer-outcome"
                        style={{
                          fontWeight: 600,
                          color: rec.later_transfer_outcome === "not enough later evidence" ? "#f59e0b" : "#34d399",
                          fontSize: "0.875rem",
                        }}
                      >
                        {rec.later_transfer_outcome}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Item Quality Indicators */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Curriculum Item Quality Indicators
            </h2>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Question</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Skill</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Sessions</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Pass Rate</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Flags</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.item_quality_indicators?.map((item) => (
                    <tr key={item.question_id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#f8fafc" }}>{item.title}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>{item.skill_id}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#cbd5e1" }}>{item.total_sessions}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#38bdf8" }}>{item.pass_rate_percent}%</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: item.flag_count > 0 ? "#f87171" : "#94a3b8" }}>
                        {item.flag_count}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem" }}>
                        <span
                          style={{
                            background: item.status === "healthy" ? "#065f46" : "#451a03",
                            color: item.status === "healthy" ? "#6ee7b7" : "#fde68a",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontWeight: 600,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
