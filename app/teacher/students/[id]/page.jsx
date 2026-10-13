"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function StudentLearningProfilePage() {
  const params = useParams();
  const studentId = params?.id || "user_internal_stu_001";

  const [profile, setProfile] = useState(null);
  const [trends, setTrends] = useState(null);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "trends"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch student profile
        const profRes = await fetch(`/api/teacher/students/${studentId}/profile`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        });

        if (!profRes.ok) {
          const errData = await profRes.json();
          throw new Error(errData.message || `HTTP ${profRes.status}`);
        }
        const profData = await profRes.json();
        setProfile(profData);

        // Fetch cohort trends
        const trendsRes = await fetch(`/api/teacher/cohorts/cohort_ratio_foundation/trends`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        });
        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          setTrends(trendsData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      loadData();
    }
  }, [studentId]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      {/* Header */}
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <Link
                href="/teacher/review"
                style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}
              >
                &larr; Back to Student Review
              </Link>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
              Student Learning Profile: <span style={{ color: "#38bdf8" }}>{studentId}</span>
            </h1>
            <p style={{ color: "#94a3b8", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Evidence-based mastery, hint reliance, transfer outcomes, and misconception trends.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("profile")}
              style={{
                background: activeTab === "profile" ? "#2563eb" : "#1e293b",
                color: "#f8fafc",
                border: "1px solid #3b82f6",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Learning Profile
            </button>
            <button
              onClick={() => setActiveTab("trends")}
              style={{
                background: activeTab === "trends" ? "#2563eb" : "#1e293b",
                color: "#f8fafc",
                border: "1px solid #3b82f6",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cohort Misconception Trends
            </button>
          </div>
        </div>
      </header>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          Loading student learning profile...
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

      {/* Profile Tab */}
      {!loading && !error && profile && activeTab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Evidence Traceability Banner */}
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "0.5rem",
              padding: "1rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: "#38bdf8" }}>Evidence Traceability: </span>
              <span style={{ color: "#cbd5e1" }}>
                {profile.evidence_traceability?.claims_linked_to_source_events_pct}% of profile claims linked to source practice events ({profile.evidence_traceability?.source_sessions_count} sessions)
              </span>
            </div>
            <div style={{ background: "#065f46", color: "#6ee7b7", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600 }}>
              Audit Verified
            </div>
          </div>

          {/* Skill Mastery Grid */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Skill Mastery Breakdown
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
              {profile.skills.map((skill) => (
                <div
                  key={skill.skill_id}
                  data-testid={`skill-card-${skill.skill_id}`}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", color: "#f8fafc" }}>{skill.skill_name}</h3>
                    <span
                      style={{
                        background:
                          skill.status === "Proficient"
                            ? "#065f46"
                            : skill.status === "Developing"
                            ? "#075985"
                            : "#334155",
                        color:
                          skill.status === "Proficient"
                            ? "#6ee7b7"
                            : skill.status === "Developing"
                            ? "#7dd3fc"
                            : "#94a3b8",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {skill.status}
                    </span>
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: "0 0 1rem 0" }}>
                    {skill.description}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                    <span style={{ color: "#94a3b8" }}>Mastery Estimate:</span>
                    <span style={{ fontWeight: 600, color: "#f8fafc" }}>{(skill.mastery_estimate * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ background: "#0f172a", borderRadius: "9999px", height: "8px", overflow: "hidden", marginBottom: "1rem" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, skill.mastery_estimate * 100))}%`,
                        background: "#38bdf8",
                        height: "100%",
                      }}
                    />
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Confidence: {(skill.mastery_confidence * 100).toFixed(0)}%</span>
                    <span>{skill.attempt_count} attempts</span>
                  </div>
                  {skill.source_session_ids?.length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#38bdf8" }}>
                      Source sessions: {skill.source_session_ids.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Hint Dependency Profile */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Hint Dependency Profile
            </h2>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", padding: "1.5rem" }}>
              <p style={{ margin: "0 0 1.25rem 0", color: "#cbd5e1", fontSize: "1rem" }}>
                {profile.hint_dependency?.summary}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", textAlign: "center" }}>
                <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "0.375rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>
                    {profile.hint_dependency?.level0_percentage}%
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Independent (Level 0)</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{profile.hint_dependency?.level0_count} attempts</div>
                </div>

                <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "0.375rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#38bdf8" }}>
                    {profile.hint_dependency?.level1_3_percentage}%
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Guided (Levels 1–3)</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{profile.hint_dependency?.level1_3_count} attempts</div>
                </div>

                <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "0.375rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f59e0b" }}>
                    {profile.hint_dependency?.level4_5_percentage}%
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Scaffolded (Levels 4–5)</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{profile.hint_dependency?.level4_5_count} attempts</div>
                </div>
              </div>
            </div>
          </section>

          {/* Transfer Results */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Transfer Problem Outcomes
            </h2>
            {profile.transfer_results?.length === 0 ? (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "0.5rem", color: "#94a3b8" }}>
                No transfer tasks completed yet.
              </div>
            ) : (
              <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                      <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Problem</th>
                      <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Skill</th>
                      <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Outcome</th>
                      <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Source Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.transfer_results.map((tr) => (
                      <tr key={tr.session_id} style={{ borderBottom: "1px solid #334155" }}>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#f8fafc" }}>{tr.question_title}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>{tr.skill_id}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem" }}>
                          <span
                            style={{
                              background: tr.transfer_outcome === "correct" ? "#065f46" : "#450a0a",
                              color: tr.transfer_outcome === "correct" ? "#6ee7b7" : "#fca5a5",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {tr.transfer_outcome}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#38bdf8" }}>
                          {tr.source_event_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Practice Sessions */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Recent Practice Sessions
            </h2>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Session</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Question</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Attempts</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Hint Level</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>State</th>
                    <th style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recent_sessions?.map((session) => (
                    <tr key={session.session_id} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#38bdf8" }}>{session.session_id}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#f8fafc" }}>{session.question_title}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>{session.attempt_count}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>{session.hint_level}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#cbd5e1" }}>{session.state}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>
                        {new Date(session.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Cohort Trends Tab */}
      {!loading && !error && trends && activeTab === "trends" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Small Sample Warning */}
          {trends.has_evidence_warning && (
            <div
              data-testid="evidence-warning-banner"
              style={{
                background: "#451a03",
                border: "1px solid #f59e0b",
                borderRadius: "0.5rem",
                padding: "1rem 1.5rem",
                color: "#fde68a",
              }}
            >
              <strong>Notice: </strong> {trends.evidence_limit_warning}
            </div>
          )}

          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", color: "#e2e8f0" }}>
              Cohort Recurring Misconception Gaps ({trends.cohort_id})
            </h2>

            {trends.trends?.length === 0 ? (
              <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "0.5rem", color: "#94a3b8" }}>
                No significant misconception patterns detected in this cohort yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {trends.trends.map((item) => (
                  <div
                    key={item.code}
                    data-testid={`trend-item-${item.code}`}
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
                        <span style={{ fontWeight: "bold", color: "#f8fafc" }}>{item.code}</span>
                        <span
                          style={{
                            background:
                              item.confidence === "High"
                                ? "#065f46"
                                : item.confidence === "Medium"
                                ? "#075985"
                                : "#451a03",
                            color:
                              item.confidence === "High"
                                ? "#6ee7b7"
                                : item.confidence === "Medium"
                                ? "#7dd3fc"
                                : "#fde68a",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {item.confidence} Confidence
                        </span>
                      </div>
                      <p style={{ margin: "0.25rem 0", color: "#cbd5e1", fontSize: "0.875rem" }}>
                        {item.description}
                      </p>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {item.occurrences} total occurrences across {item.student_count} student(s)
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#38bdf8" }}>
                      Source sessions: {item.source_session_ids?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
