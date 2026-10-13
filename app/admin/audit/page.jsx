"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminAuditViewerPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token") || localStorage.getItem("sp_admin_token") || "";
      setAuthToken(token);
      loadEvents(token, {
        user: urlParams.get("user") || "",
        student: urlParams.get("student") || "",
        event_type: urlParams.get("event_type") || "",
        from: urlParams.get("from") || "",
        to: urlParams.get("to") || "",
      });
    }
  }, []);

  async function loadEvents(token, customFilters = null) {
    setLoading(true);
    setError(null);
    try {
      const u = customFilters?.user !== undefined ? customFilters.user : userFilter;
      const s = customFilters?.student !== undefined ? customFilters.student : studentFilter;
      const et = customFilters?.event_type !== undefined ? customFilters.event_type : eventTypeFilter;
      const f = customFilters?.from !== undefined ? customFilters.from : fromFilter;
      const t = customFilters?.to !== undefined ? customFilters.to : toFilter;

      const params = new URLSearchParams();
      if (u) params.set("user", u);
      if (s) params.set("student", s);
      if (et) params.set("event_type", et);
      if (f) params.set("from", f);
      if (t) params.set("to", t);

      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/admin/audit-events?${params.toString()}`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFilter(e) {
    e?.preventDefault();
    loadEvents(authToken);
  }

  function handleResetFilter() {
    setUserFilter("");
    setStudentFilter("");
    setEventTypeFilter("");
    setFromFilter("");
    setToFilter("");
    loadEvents(authToken, { user: "", student: "", event_type: "", from: "", to: "" });
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#f8fafc", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Link href="/" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.875rem" }}>
            ← Back to Home
          </Link>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginTop: "0.5rem" }}>
            Audit Trail Viewer
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            Append-only governance, security, and administrative event log (ADM-02, FR-15)
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Total Records:</span>
          <span data-testid="audit-total-count" style={{ padding: "0.25rem 0.75rem", backgroundColor: "#1e293b", borderRadius: "9999px", fontWeight: "600" }}>
            {total}
          </span>
        </div>
      </header>

      {/* Filter Toolbar */}
      <section style={{ backgroundColor: "#1e293b", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "2rem", border: "1px solid #334155" }}>
        <form onSubmit={handleApplyFilter} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#94a3b8", marginBottom: "0.35rem" }}>
              User ID
            </label>
            <input
              type="text"
              data-testid="filter-user-input"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="e.g. user_2test_adm_001"
              style={{ width: "100%", padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: "0.375rem", color: "#fff", fontSize: "0.875rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#94a3b8", marginBottom: "0.35rem" }}>
              Student ID
            </label>
            <input
              type="text"
              data-testid="filter-student-input"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="e.g. student_default"
              style={{ width: "100%", padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: "0.375rem", color: "#fff", fontSize: "0.875rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#94a3b8", marginBottom: "0.35rem" }}>
              Event Type
            </label>
            <select
              data-testid="filter-event-type-select"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: "0.375rem", color: "#fff", fontSize: "0.875rem" }}
            >
              <option value="">All Events</option>
              <option value="user_role_changed">user_role_changed</option>
              <option value="grant_added">grant_added</option>
              <option value="grant_revoked">grant_revoked</option>
              <option value="cohort_created">cohort_created</option>
              <option value="staff_assigned">staff_assigned</option>
              <option value="support_contact_assigned">support_contact_assigned</option>
              <option value="content_review_decision">content_review_decision</option>
              <option value="diagram_review_decision">diagram_review_decision</option>
              <option value="session_created">session_created</option>
              <option value="question_selection">question_selection</option>
              <option value="attempt_submitted">attempt_submitted</option>
              <option value="hint_escalated">hint_escalated</option>
              <option value="safety_incident">safety_incident</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#94a3b8", marginBottom: "0.35rem" }}>
              From Date
            </label>
            <input
              type="date"
              data-testid="filter-from-input"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: "0.375rem", color: "#fff", fontSize: "0.875rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#94a3b8", marginBottom: "0.35rem" }}>
              To Date
            </label>
            <input
              type="date"
              data-testid="filter-to-input"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: "0.375rem", color: "#fff", fontSize: "0.875rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              data-testid="apply-filter-btn"
              style={{ flex: 1, padding: "0.5rem 1rem", backgroundColor: "#0284c7", color: "#fff", fontWeight: "600", borderRadius: "0.375rem", border: "none", cursor: "pointer" }}
            >
              Filter
            </button>
            <button
              type="button"
              data-testid="reset-filter-btn"
              onClick={handleResetFilter}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#334155", color: "#cbd5e1", borderRadius: "0.375rem", border: "none", cursor: "pointer" }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {/* Error Notice */}
      {error && (
        <div data-testid="audit-error-notice" style={{ padding: "1rem", backgroundColor: "#7f1d1d", color: "#fecaca", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* Events List */}
      <section>
        {loading ? (
          <div data-testid="audit-loading" style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
            Loading audit events...
          </div>
        ) : events.length === 0 ? (
          <div data-testid="audit-empty-notice" style={{ textAlign: "center", padding: "3rem", color: "#64748b", backgroundColor: "#1e293b", borderRadius: "0.75rem" }}>
            No audit records match the selected filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {events.map((ev) => (
              <div
                key={ev.event_id}
                data-testid="audit-event-row"
                style={{ backgroundColor: "#1e293b", padding: "1rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #334155", display: "flex", flexDirection: "column", gap: "0.5rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <span
                      data-testid="event-type-badge"
                      style={{ padding: "0.2rem 0.5rem", backgroundColor: "#0369a1", color: "#e0f2fe", fontSize: "0.75rem", fontWeight: "700", borderRadius: "0.25rem" }}
                    >
                      {ev.event_type}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>ID: {ev.event_id.slice(0, 8)}...</span>
                  </div>
                  <span data-testid="timestamp-val" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {ev.timestamp}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem", color: "#cbd5e1" }}>
                  <div>
                    <span style={{ color: "#64748b" }}>User: </span>
                    <span data-testid="actor-user-val" style={{ fontWeight: "600" }}>
                      {ev.actor_user_id || "system"}
                    </span>
                  </div>
                  {ev.student_id && (
                    <div>
                      <span style={{ color: "#64748b" }}>Student: </span>
                      <span data-testid="student-id-val" style={{ fontWeight: "600" }}>
                        {ev.student_id}
                      </span>
                    </div>
                  )}
                  {ev.action && (
                    <div>
                      <span style={{ color: "#64748b" }}>Action: </span>
                      <span style={{ fontWeight: "600" }}>{ev.action}</span>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "#64748b" }}>Status: </span>
                    <span style={{ color: ev.status === "success" ? "#4ade80" : "#f87171", fontWeight: "600" }}>
                      {ev.status}
                    </span>
                  </div>
                </div>

                {/* Configuration change diff */}
                {(ev.previous_value !== null || ev.new_value !== null) && (
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", backgroundColor: "#0f172a", padding: "0.5rem 0.75rem", borderRadius: "0.375rem" }}>
                    <div>
                      <span style={{ color: "#f87171" }}>Prev: </span>
                      <span data-testid="config-prev-val" style={{ fontFamily: "monospace" }}>
                        {JSON.stringify(ev.previous_value)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#4ade80" }}>New: </span>
                      <span data-testid="config-new-val" style={{ fontFamily: "monospace" }}>
                        {JSON.stringify(ev.new_value)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Structured details / hashes */}
                {ev.details && Object.keys(ev.details).length > 0 && (
                  <pre
                    data-testid="audit-details"
                    style={{ margin: 0, padding: "0.5rem 0.75rem", backgroundColor: "#0f172a", borderRadius: "0.375rem", fontSize: "0.75rem", color: "#94a3b8", overflowX: "auto" }}
                  >
                    {JSON.stringify(ev.details)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
