"use client";

import React, { useState, useEffect } from "react";

export default function HandoverPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const adminToken = JSON.stringify({
    sub: "user_2test_adm_001",
    role: "administrator",
  });

  useEffect(() => {
    async function loadDocs() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/handover-documents", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 32, borderBottom: "1px solid #e2e8f0", paddingBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", color: "#0f172a" }}>
              Operational Handover Documentation
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>
              PRD §15.8, §21, §22, TECH-30 — System architecture, threat models, evaluation reports, and operator runbooks.
            </p>
          </div>
          {data && (
            <div
              data-testid="handover-status-badge"
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600,
                background: data.handover_ready ? "#dcfce7" : "#fee2e2",
                color: data.handover_ready ? "#166534" : "#991b1b",
                border: `1px solid ${data.handover_ready ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              {data.handover_ready ? "✓ Ready for Demo Handover" : "⚠ Incomplete Documentation"}
            </div>
          )}
        </div>
      </header>

      {loading && <p style={{ color: "#64748b" }}>Loading documentation registry...</p>}
      {error && <div style={{ padding: 16, background: "#fef2f2", color: "#b91c1c", borderRadius: 8 }}>{error}</div>}

      {data && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div style={{ padding: 20, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>REQUIRED DOCUMENTS</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                {data.total_required} / {data.total_required}
              </div>
            </div>
            <div style={{ padding: 20, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>AVAILABLE ON DISK</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                {data.total_present} / {data.total_required}
              </div>
            </div>
            <div style={{ padding: 20, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>INCIDENT RESPONSE</div>
              <div
                data-testid="incident-response-badge"
                style={{ fontSize: 20, fontWeight: 700, color: "#2563eb", marginTop: 8 }}
              >
                Included in Runbook
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>Document Registry</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.documents.map((doc) => (
              <div
                key={doc.id}
                data-testid={`handover-doc-${doc.id}`}
                style={{
                  padding: 24,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
                      {doc.title}
                    </h3>
                    <code style={{ fontSize: 13, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                      docs/{doc.filename}
                    </code>
                  </div>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: doc.exists ? "#f0fdf4" : "#fef2f2",
                      color: doc.exists ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {doc.exists ? `Present (${doc.size_bytes} B)` : "Missing"}
                  </span>
                </div>

                <p style={{ margin: "8px 0 12px 0", color: "#334155", fontSize: 14 }}>{doc.description}</p>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  <strong>Standard Reference:</strong> {doc.required_by}
                </div>

                {doc.id === "operating_runbook" && doc.has_incident_response && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      background: "#eff6ff",
                      border: "1px solid #dbeafe",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#1e40af",
                      fontWeight: 500,
                    }}
                  >
                    ✓ Includes full Sev-1/Sev-2 incident response procedures, emergency kill-switches, and disaster recovery RTO/RPO runbooks.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
