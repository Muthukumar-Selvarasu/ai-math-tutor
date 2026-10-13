"use client";

import React, { useState, useEffect } from "react";

export default function LaunchControlsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");

  const fetchControls = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/launch-controls", {
        headers: { "x-user-role": "admin" },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch launch controls: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchControls();
  }, []);

  const handleUpdate = async (updates) => {
    try {
      setError(null);
      setActionMsg("Updating launch controls...");
      const res = await fetch("/api/admin/launch-controls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || `Failed to update controls: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setActionMsg("Controls updated successfully.");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      setError(err.message);
      setActionMsg("");
    }
  };

  const handleReset = async () => {
    try {
      setError(null);
      setActionMsg("Resetting to defaults...");
      const res = await fetch("/api/admin/launch-controls/reset", {
        method: "POST",
        headers: { "x-user-role": "admin" },
      });
      if (!res.ok) {
        throw new Error(`Failed to reset: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setActionMsg("Reset to shipped defaults.");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0d14", color: "#e2e8f0", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Platform Launch Controls</h1>
        <p style={{ marginTop: "1rem", color: "#94a3b8" }}>Loading controls and readiness metrics...</p>
      </div>
    );
  }

  const controls = data?.controls || {};
  const readiness = data?.readiness || {};
  const checklist = readiness.checklist || [];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0d14", color: "#e2e8f0", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
              Platform Launch Controls & Gate A Readiness
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
              ADM-08 Platform Governance • PRD §14.5, §17, §21.1 • Strict Gate A Cut Line
            </p>
          </div>
          <button
            onClick={fetchControls}
            style={{
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh
          </button>
        </header>

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #ef4444", padding: "1rem", borderRadius: "0.5rem", color: "#fca5a5", marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        {actionMsg && (
          <div style={{ background: "#064e3b", border: "1px solid #10b981", padding: "0.75rem", borderRadius: "0.5rem", color: "#6ee7b7", marginBottom: "1.5rem" }}>
            {actionMsg}
          </div>
        )}

        {/* Gate A Readiness Banner */}
        <div
          id="gate-a-banner"
          style={{
            background: readiness.gate_a_ready ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${readiness.gate_a_ready ? "#10b981" : "#ef4444"}`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: "700",
                  background: readiness.gate_a_ready ? "#10b981" : "#ef4444",
                  color: "#0f172a",
                }}
              >
                {readiness.gate_a_ready ? "GATE A READY" : "GATE A BLOCKED"}
              </span>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700" }}>
                {readiness.gate_a_ready
                  ? "All Core MVP Verification Criteria Satisfied"
                  : "Gate A Quality Thresholds Incomplete"}
              </h2>
            </div>
            <p style={{ margin: "0.5rem 0 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
              Evaluated at: {readiness.evaluated_at} • Passed {readiness.summary?.passed_checks} of {readiness.summary?.total_checks} checks
            </p>
          </div>
        </div>

        {/* Global Controls & Kill Switches */}
        <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0 }}>Launch Toggles & Emergency Kill Switches</h2>
            <button
              id="reset-controls-btn"
              onClick={handleReset}
              style={{
                background: "#374151",
                color: "#e5e7eb",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.375rem 0.75rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Reset to Shipped Defaults
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {/* Dialogue Mode Switcher */}
            <div style={{ background: "#1f2937", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: "600" }}>Dialogue Mode</h3>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.8125rem" }}>
                    Shipped default: <code>template</code> (Cut 1a-3)
                  </p>
                </div>
                <span
                  id="dialogue-mode-badge"
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    background: controls.dialogue_mode === "template" ? "#0284c7" : "#8b5cf6",
                    color: "#fff",
                  }}
                >
                  {controls.dialogue_mode?.toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                <button
                  id="toggle-template-mode-btn"
                  onClick={() => handleUpdate({ dialogue_mode: "template" })}
                  disabled={controls.dialogue_mode === "template"}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    background: controls.dialogue_mode === "template" ? "#0284c7" : "#374151",
                    color: "#fff",
                    border: "none",
                    cursor: controls.dialogue_mode === "template" ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  Template Mode (Default)
                </button>
                <button
                  id="toggle-llm-mode-btn"
                  onClick={() => handleUpdate({ dialogue_mode: "llm" })}
                  disabled={controls.dialogue_mode === "llm"}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    background: controls.dialogue_mode === "llm" ? "#8b5cf6" : "#374151",
                    color: "#fff",
                    border: "none",
                    cursor: controls.dialogue_mode === "llm" ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  LLM Mode (Opt-in)
                </button>
              </div>
            </div>

            {/* Emergency Stop Kill Switch */}
            <div style={{ background: "#1f2937", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: "600" }}>Emergency Stop</h3>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.8125rem" }}>
                    Immediately pauses student tutoring turns
                  </p>
                </div>
                <span
                  id="emergency-stop-badge"
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    background: controls.emergency_stop ? "#ef4444" : "#10b981",
                    color: "#fff",
                  }}
                >
                  {controls.emergency_stop ? "ACTIVE (HALTED)" : "DISARMED (NORMAL)"}
                </span>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <button
                  id="toggle-emergency-stop-btn"
                  onClick={() => handleUpdate({ emergency_stop: !controls.emergency_stop })}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    background: controls.emergency_stop ? "#10b981" : "#dc2626",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {controls.emergency_stop ? "Disarm Emergency Stop" : "Activate Emergency Stop"}
                </button>
              </div>
            </div>

            {/* Allow Level 5 Solution Escalation */}
            <div style={{ background: "#1f2937", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: "600" }}>Allow Level 5</h3>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.8125rem" }}>
                    Permits Level 5 full solution escalation
                  </p>
                </div>
                <span
                  id="allow-level-5-badge"
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    background: controls.allow_level_5 ? "#10b981" : "#f59e0b",
                    color: "#0f172a",
                  }}
                >
                  {controls.allow_level_5 ? "ALLOWED" : "WITHHELD"}
                </span>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <button
                  id="toggle-allow-level-5-btn"
                  onClick={() => handleUpdate({ allow_level_5: !controls.allow_level_5 })}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    background: controls.allow_level_5 ? "#d97706" : "#059669",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {controls.allow_level_5 ? "Withhold Full Solution" : "Permit Full Solution"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Gate A Checklist Detail */}
        <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "700", margin: "0 0 1rem 0" }}>
            Gate A Verification Checklist (PRD §21.1)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {checklist.map((item) => (
              <div
                key={item.id}
                id={`check-${item.id}`}
                style={{
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "600" }}>{item.name}</h3>
                    {item.required && (
                      <span style={{ fontSize: "0.75rem", background: "#334155", color: "#cbd5e1", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>
                        Blocking
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0.25rem 0 0 0", color: "#9ca3af", fontSize: "0.875rem" }}>
                    {item.description}
                  </p>
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.625rem",
                      borderRadius: "0.375rem",
                      fontWeight: "700",
                      fontSize: "0.875rem",
                      background: item.status === "pass" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: item.status === "pass" ? "#34d399" : "#f87171",
                      border: `1px solid ${item.status === "pass" ? "#10b981" : "#ef4444"}`,
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
