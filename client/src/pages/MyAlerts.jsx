import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  createAlert,
  deleteAlert,
  getMyAlerts,
  updateAlert,
} from "../api/alertsApi";

function mergeUpdatedAlert(existingItem, updatedData) {
  return {
    ...existingItem,
    ...(updatedData || {}),
    lake_name: existingItem.lake_name,
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default function MyAlerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        const data = await getMyAlerts();
        setItems(data || []);
      } catch (error) {
        notifyError(error, "Failed to load alerts");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  const patchItem = async (waterBodyId, payload, successMessage) => {
    try {
      setSavingId(waterBodyId);

      const updatedItem = await updateAlert(waterBodyId, payload);

      setItems((prev) =>
        prev.map((item) =>
          item.water_body_id === waterBodyId
            ? mergeUpdatedAlert(item, updatedItem)
            : item,
        ),
      );

      if (successMessage) {
        notifySuccess(successMessage);
      }
    } catch (error) {
      notifyError(error, "Failed to update alert settings");
    } finally {
      setSavingId("");
    }
  };

  const disableAlert = async (waterBodyId) => {
    try {
      setSavingId(waterBodyId);

      await deleteAlert(waterBodyId);

      setItems((prev) =>
        prev.map((item) =>
          item.water_body_id === waterBodyId
            ? { ...item, is_active: false }
            : item,
        ),
      );

      notifySuccess("Alert disabled");
    } catch (error) {
      notifyError(error, "Failed to disable alert");
    } finally {
      setSavingId("");
    }
  };

  const enableAlert = async (item) => {
    try {
      setSavingId(item.water_body_id);

      const createdItem = await createAlert({
        water_body_id: item.water_body_id,
        is_favorite: item.is_favorite,
        notification_frequency: item.notification_frequency || "daily",
        min_score: Number(item.min_score || 0),
      });

      setItems((prev) =>
        prev.map((currentItem) =>
          currentItem.water_body_id === item.water_body_id
            ? mergeUpdatedAlert(currentItem, createdItem)
            : currentItem,
        ),
      );

      notifySuccess("Alert enabled");
    } catch (error) {
      notifyError(error, "Failed to enable alert");
    } finally {
      setSavingId("");
    }
  };

  const toggleFavorite = async (item) => {
    await patchItem(
      item.water_body_id,
      { is_favorite: !item.is_favorite },
      item.is_favorite ? "Removed from favorites" : "Marked as favorite",
    );
  };

  const handleMinScoreChange = (waterBodyId, value) => {
    const nextValue = clampScore(value);

    setItems((prev) =>
      prev.map((item) =>
        item.water_body_id === waterBodyId
          ? { ...item, min_score: nextValue }
          : item,
      ),
    );
  };

  const handleMinScoreBlur = async (item) => {
    await patchItem(
      item.water_body_id,
      { min_score: Number(item.min_score || 0) },
      "Minimum score updated",
    );
  };

  const goToMap = (waterBodyId) => {
    navigate("/", { state: { lakeId: waterBodyId } });
  };

  const goToDetails = (waterBodyId) => {
    navigate(`/lakes/${waterBodyId}`);
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading alerts…</div>;
  }

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
    <div
      style={{
        padding: 20,
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
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
            Manage favorite lakes, enable or disable notifications, set alert
            frequency, and choose a minimum fishing score threshold. Matching
            lakes are grouped into one email per schedule and ordered by fishing
            score.
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => {
            const busy = savingId === item.water_body_id;

            return (
              <div
                key={item.water_body_id}
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
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 18,
                        color: "#0f172a",
                      }}
                    >
                      {item.lake_name}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      <span
                        style={{
                          background: item.is_active ? "#dcfce7" : "#f1f5f9",
                          color: item.is_active ? "#166534" : "#475569",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {item.is_active ? "Alerts On" : "Alerts Off"}
                      </span>

                      <span
                        style={{
                          background: item.is_favorite ? "#fef3c7" : "#f1f5f9",
                          color: item.is_favorite ? "#92400e" : "#475569",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {item.is_favorite ? "Favorite" : "Not Favorite"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => goToMap(item.water_body_id)}
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
                      onClick={() => goToDetails(item.water_body_id)}
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
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                      Favorite
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleFavorite(item)}
                      style={{
                        width: "100%",
                        background: item.is_favorite ? "#f59e0b" : "#e5e7eb",
                        color: item.is_favorite ? "white" : "#334155",
                        border: "none",
                        padding: "10px 12px",
                        borderRadius: 10,
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {item.is_favorite ? "Unfavorite" : "Mark Favorite"}
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                      Notification Frequency
                    </div>
                    <select
                      value={item.notification_frequency || "daily"}
                      disabled={busy}
                      onChange={(event) =>
                        patchItem(
                          item.water_body_id,
                          { notification_frequency: event.target.value },
                          "Frequency updated",
                        )
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
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                      Minimum Score
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={Number(item.min_score || 0)}
                      disabled={busy}
                      onChange={(event) =>
                        handleMinScoreChange(item.water_body_id, event.target.value)
                      }
                      onBlur={() => handleMinScoreBlur(item)}
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
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                      Alert Status
                    </div>
                    {item.is_active ? (
                      <button
                        type="button"
                        onClick={() => disableAlert(item.water_body_id)}
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
                        onClick={() => enableAlert(item)}
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