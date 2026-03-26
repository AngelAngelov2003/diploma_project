import React, { useEffect, useState } from "react";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";
import { useNavigate } from "react-router-dom";

export default function MyAlerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/alerts/my");
      setItems(res.data || []);
    } catch (err) {
      notifyError(err, "Failed to load alerts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchItem = async (waterBodyId, payload, successMessage) => {
    try {
      setSavingId(waterBodyId);
      const res = await api.patch(`/alerts/${waterBodyId}`, payload);
      setItems((prev) =>
        prev.map((x) =>
          x.water_body_id === waterBodyId ? { ...x, ...res.data, lake_name: x.lake_name } : x
        )
      );
      if (successMessage) notifySuccess(successMessage);
    } catch (err) {
      notifyError(err, "Failed to update alert settings");
    } finally {
      setSavingId("");
    }
  };

  const disableAlert = async (waterBodyId) => {
    try {
      setSavingId(waterBodyId);
      await api.delete(`/alerts/${waterBodyId}`);
      setItems((prev) =>
        prev.map((x) =>
          x.water_body_id === waterBodyId ? { ...x, is_active: false } : x
        )
      );
      notifySuccess("Alert disabled");
    } catch (err) {
      notifyError(err, "Failed to disable alert");
    } finally {
      setSavingId("");
    }
  };

  const enableAlert = async (item) => {
    try {
      setSavingId(item.water_body_id);
      const res = await api.post("/alerts", {
        water_body_id: item.water_body_id,
        is_favorite: item.is_favorite,
        notification_frequency: item.notification_frequency || "daily",
        min_score: Number(item.min_score || 0),
      });
      setItems((prev) =>
        prev.map((x) =>
          x.water_body_id === item.water_body_id ? { ...x, ...res.data, lake_name: x.lake_name } : x
        )
      );
      notifySuccess("Alert enabled");
    } catch (err) {
      notifyError(err, "Failed to enable alert");
    } finally {
      setSavingId("");
    }
  };

  const toggleFavorite = async (item) => {
    await patchItem(
      item.water_body_id,
      { is_favorite: !item.is_favorite },
      item.is_favorite ? "Removed from favorites" : "Marked as favorite"
    );
  };

  const goToMap = (waterBodyId) => {
    navigate("/", { state: { lakeId: waterBodyId } });
  };

  const goToDetails = (waterBodyId) => {
    navigate(`/lakes/${waterBodyId}`);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading alerts…</div>;

  if (!items.length) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>My Lake Alerts</h2>
        <div style={{ color: "#666", marginTop: 10 }}>
          No favorite lakes or alert settings yet.
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            marginTop: 14,
            background: "#007bff",
            color: "white",
            border: "none",
            padding: "10px 12px",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Go to map
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>My Lake Alerts</h2>
          <div style={{ opacity: 0.95, lineHeight: 1.6, fontSize: 14 }}>
            Manage favorite lakes, enable or disable notifications, set alert frequency, and choose
            a minimum fishing score threshold. Matching lakes are grouped into one email per schedule
            and ordered by fishing score.
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {items.map((s) => {
            const busy = savingId === s.water_body_id;

            return (
              <div
                key={s.water_body_id}
                style={{
                  background: "white",
                  border: "1px solid #e6e6e6",
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "start",
                    flexWrap: "wrap",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>{s.lake_name}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <span
                        style={{
                          background: s.is_active ? "#dcfce7" : "#f1f5f9",
                          color: s.is_active ? "#166534" : "#475569",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {s.is_active ? "Alerts On" : "Alerts Off"}
                      </span>

                      <span
                        style={{
                          background: s.is_favorite ? "#fef3c7" : "#f1f5f9",
                          color: s.is_favorite ? "#92400e" : "#475569",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {s.is_favorite ? "Favorite" : "Not Favorite"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => goToMap(s.water_body_id)}
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        padding: "8px 10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      View on Map
                    </button>

                    <button
                      type="button"
                      onClick={() => goToDetails(s.water_body_id)}
                      style={{
                        background: "#111827",
                        color: "white",
                        border: "none",
                        padding: "8px 10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Details
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Favorite</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleFavorite(s)}
                      style={{
                        width: "100%",
                        background: s.is_favorite ? "#f59e0b" : "#e5e7eb",
                        color: s.is_favorite ? "white" : "#334155",
                        border: "none",
                        padding: "10px 12px",
                        borderRadius: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {s.is_favorite ? "Unfavorite" : "Mark Favorite"}
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Notification Frequency</div>
                    <select
                      value={s.notification_frequency || "daily"}
                      disabled={busy}
                      onChange={(e) =>
                        patchItem(s.water_body_id, { notification_frequency: e.target.value }, "Frequency updated")
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        boxSizing: "border-box",
                        background: "white",
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Minimum Score</div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={Number(s.min_score || 0)}
                      disabled={busy}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                        setItems((prev) =>
                          prev.map((x) =>
                            x.water_body_id === s.water_body_id ? { ...x, min_score: value } : x
                          )
                        );
                      }}
                      onBlur={() =>
                        patchItem(s.water_body_id, { min_score: Number(s.min_score || 0) }, "Minimum score updated")
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        boxSizing: "border-box",
                        background: "white",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Alert Status</div>
                    {s.is_active ? (
                      <button
                        type="button"
                        onClick={() => disableAlert(s.water_body_id)}
                        disabled={busy}
                        style={{
                          width: "100%",
                          background: "#343a40",
                          color: "white",
                          border: "none",
                          padding: "10px 12px",
                          borderRadius: 10,
                          cursor: busy ? "not-allowed" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Disable Alert
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableAlert(s)}
                        disabled={busy}
                        style={{
                          width: "100%",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          padding: "10px 12px",
                          borderRadius: 10,
                          cursor: busy ? "not-allowed" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Enable Alert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}