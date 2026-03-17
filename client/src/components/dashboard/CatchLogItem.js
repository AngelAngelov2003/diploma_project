import React from "react";
import { FaFish } from "react-icons/fa";
import { formatDateTime } from "../../utils/date";

const API_BASE_URL = "http://localhost:5000";

export default function CatchLogItem({ log, onLakeClick }) {
  const when = log.catch_time || log.created_at;
  const imgSrc = log.image_url ? `${API_BASE_URL}/uploads/${log.image_url}` : null;

  const handleLakeClick = () => {
    if (!onLakeClick) return;
    if (log.water_body_id === null || log.water_body_id === undefined || log.water_body_id === "") return;
    onLakeClick(log.water_body_id);
  };

  return (
    <li
      style={{
        background: "#f8f9fa",
        margin: "10px 0",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "12px",
          overflow: "hidden",
          background: "#fff",
          border: "1px solid #e6e6e6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="Catch" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <FaFish size={38} color="#6c757d" />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "16px" }}>
          <strong>{log.species}</strong> — {log.weight_kg}kg
        </div>

        <button
          type="button"
          onClick={handleLakeClick}
          style={{
            color: "#007bff",
            marginTop: "4px",
            cursor: "pointer",
            textDecoration: "underline",
            display: "inline-block",
            background: "transparent",
            border: "none",
            padding: 0,
            font: "inherit",
          }}
        >
          📍 {log.lake_name || log.water_body_name || "Unknown location"}
        </button>

        <div style={{ marginTop: "8px", color: "#666" }}>
          <small>
            Catch time: <strong>{formatDateTime(when)}</strong>
          </small>
        </div>

        {log.notes && (
          <div style={{ marginTop: "8px", color: "#444" }}>
            <small>Notes: {log.notes}</small>
          </div>
        )}
      </div>
    </li>
  );
}