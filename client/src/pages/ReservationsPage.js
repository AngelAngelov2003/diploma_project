import React, { useEffect, useState } from "react";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";

const pageStyle = {
  padding: 20,
  background: "#f8fafc",
  minHeight: "calc(100vh - 60px)",
};

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
};

const badgeStyle = (status) => {
  const map = {
    pending: { background: "#fef3c7", color: "#92400e" },
    approved: { background: "#dcfce7", color: "#166534" },
    rejected: { background: "#fee2e2", color: "#991b1b" },
    cancelled: { background: "#e5e7eb", color: "#374151" },
  };

  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    ...(map[status] || { background: "#e5e7eb", color: "#334155" }),
  };
};

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "Unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

export default function ReservationsPage() {
  const [myReservations, setMyReservations] = useState([]);
  const [incomingReservations, setIncomingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [myRes, incomingRes] = await Promise.all([
        api.get("/reservations/my"),
        api.get("/reservations/incoming"),
      ]);
      setMyReservations(myRes.data || []);
      setIncomingReservations(incomingRes.data || []);
    } catch (err) {
      notifyError(err, "Failed to load reservations");
      setMyReservations([]);
      setIncomingReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancelReservation = async (reservationId) => {
    try {
      setSavingId(reservationId);
      await api.patch(`/reservations/${reservationId}/cancel`);
      notifySuccess("Reservation cancelled");
      await load();
    } catch (err) {
      notifyError(err, "Failed to cancel reservation");
    } finally {
      setSavingId("");
    }
  };

  const updateIncomingStatus = async (reservationId, status) => {
    try {
      setSavingId(reservationId);
      await api.patch(`/reservations/${reservationId}/status`, { status });
      notifySuccess("Reservation updated");
      await load();
    } catch (err) {
      notifyError(err, "Failed to update reservation");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading reservations...</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Reservations</h2>
          <div style={{ opacity: 0.95, lineHeight: 1.6, fontSize: 14 }}>
            Manage your reservation requests and review incoming requests for lakes you own.
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>My reservations</h3>

            {myReservations.length === 0 ? (
              <div style={{ color: "#64748b" }}>You do not have any reservations yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {myReservations.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{item.lake_name}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                          Date: {formatDate(item.reservation_date)}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                          Created: {formatDateTime(item.created_at)}
                        </div>
                        <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                          Notes: {item.notes || "No notes"}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                        <span style={badgeStyle(item.status)}>{item.status}</span>

                        {item.status !== "cancelled" && (
                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => cancelReservation(item.id)}
                            style={{
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 10,
                              cursor: savingId === item.id ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Incoming reservations</h3>

            {incomingReservations.length === 0 ? (
              <div style={{ color: "#64748b" }}>No incoming reservations for your private lakes.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {incomingReservations.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{item.lake_name}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                          User: {item.full_name || "Unknown"} {item.email ? `(${item.email})` : ""}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                          Date: {formatDate(item.reservation_date)}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                          Created: {formatDateTime(item.created_at)}
                        </div>
                        <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                          Notes: {item.notes || "No notes"}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                        <span style={badgeStyle(item.status)}>{item.status}</span>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => updateIncomingStatus(item.id, "approved")}
                            style={{
                              background: "#16a34a",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 10,
                              cursor: savingId === item.id ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => updateIncomingStatus(item.id, "rejected")}
                            style={{
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 10,
                              cursor: savingId === item.id ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Reject
                          </button>

                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => updateIncomingStatus(item.id, "pending")}
                            style={{
                              background: "#334155",
                              color: "white",
                              border: "none",
                              padding: "8px 12px",
                              borderRadius: 10,
                              cursor: savingId === item.id ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Mark Pending
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}