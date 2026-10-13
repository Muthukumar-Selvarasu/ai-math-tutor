"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function TeacherStudentGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [filter, setFilter] = useState("all"); // "all", "strong", "preliminary"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState("");

  const teacherToken = JSON.stringify({
    sub: "user_2test_tch_001",
    role: "teacher",
  });

  const fetchGroups = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const url = forceRefresh
        ? "/api/teacher/student-groups?refresh=true"
        : "/api/teacher/student-groups";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setGroups(data);
      if (forceRefresh) {
        setRefreshMsg("Groups recomputed from latest attempts.");
        setTimeout(() => setRefreshMsg(""), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const filteredGroups = groups.filter((g) => {
    if (filter === "strong") return !g.has_evidence_warning;
    if (filter === "preliminary") return g.has_evidence_warning;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #334155", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0, color: "#e2e8f0" }}>
              Intervention Groups by Need
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
              Group students by skill and misconception pattern for targeted small-group activities (EDU-05)
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link
              href="/teacher/review"
              style={{
                background: "#334155",
                color: "#e2e8f0",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Review Queue
            </Link>
            <button
              onClick={() => fetchGroups(true)}
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
              Recompute Groups
            </button>
          </div>
        </div>
      </header>

      {refreshMsg && (
        <div style={{ background: "#065f46", color: "#6ee7b7", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {refreshMsg}
        </div>
      )}

      {error && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1.5rem" }}>
          Error: {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {[
          { id: "all", label: `All Groups (${groups.length})` },
          { id: "strong", label: `Established Need (${groups.filter((g) => !g.has_evidence_warning).length})` },
          { id: "preliminary", label: `Preliminary / Limited Evidence (${groups.filter((g) => g.has_evidence_warning).length})` },
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
          Loading intervention clusters...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: "#1e293b", borderRadius: "8px", color: "#94a3b8" }}>
          No groups currently identified. Students appear to be practicing smoothly.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {filteredGroups.map((group) => {
            const confColor =
              group.confidence === "High" ? "#10b981" : group.confidence === "Medium" ? "#3b82f6" : "#f59e0b";

            return (
              <div
                key={group.group_id}
                data-testid={`group-card-${group.group_id}`}
                style={{
                  background: "#1e293b",
                  borderRadius: "8px",
                  border: "1px solid #334155",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* Header: Skill and Confidence */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    data-testid="group-skill"
                    style={{
                      background: "#334155",
                      color: "#93c5fd",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                    }}
                  >
                    {group.skill}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span
                      data-testid="group-confidence"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${confColor}`,
                        color: confColor,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                      }}
                    >
                      {group.confidence} Confidence
                    </span>
                  </div>
                </div>

                {/* Pattern */}
                <div>
                  <h3
                    data-testid="group-pattern"
                    style={{ margin: 0, fontSize: "1.1rem", color: "#f8fafc" }}
                  >
                    {group.misconception_pattern}
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                    {group.misconception_description}
                  </p>
                </div>

                {/* Evidence Stats */}
                <div
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    padding: "0.5rem 0",
                    borderTop: "1px solid #334155",
                    borderBottom: "1px solid #334155",
                    fontSize: "0.85rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#94a3b8" }}>Students: </span>
                    <strong data-testid="group-student-count" style={{ color: "#f8fafc" }}>
                      {group.student_count}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Total Attempts: </span>
                    <strong data-testid="group-attempt-count" style={{ color: "#f8fafc" }}>
                      {group.attempt_count}
                    </strong>
                  </div>
                </div>

                {/* Warning Banner if limited evidence (Criterion 2) */}
                {group.has_evidence_warning && (
                  <div
                    data-testid="evidence-limit-warning"
                    style={{
                      background: "#451a03",
                      borderLeft: "3px solid #f59e0b",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "4px",
                      color: "#fde68a",
                      fontSize: "0.8rem",
                    }}
                  >
                    {group.evidence_warning}
                  </div>
                )}

                {/* Students list */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Assigned Students in Group:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {group.students.map((stu) => (
                      <span
                        key={stu.student_id}
                        data-testid="student-pill"
                        style={{
                          background: "#0f172a",
                          color: "#cbd5e1",
                          border: "1px solid #334155",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                        }}
                      >
                        {stu.student_id} ({stu.attempt_count} att.)
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggested Educator Action */}
                <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "6px", marginTop: "auto" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#60a5fa", marginBottom: "0.2rem" }}>
                    Suggested Small-Group Activity:
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                    {group.suggested_activity}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
