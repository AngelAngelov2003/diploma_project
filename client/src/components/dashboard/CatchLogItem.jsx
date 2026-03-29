import React from "react";
import styles from "./CatchLogItem.module.css";
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
    <li className={styles.item}>
      <div className={styles.imageBox}>
        {imgSrc ? (
          <img src={imgSrc} alt="Catch" className={styles.image} />
        ) : (
          <FaFish size={38} color="#6c757d" />
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.title}>
          <strong>{log.species}</strong> — {log.weight_kg}kg
        </div>

        <button
          type="button"
          onClick={handleLakeClick}
          className={styles.lakeButton}
        >
          📍 {log.lake_name || log.water_body_name || "Unknown location"}
        </button>

        <div className={styles.meta}>
          <small>
            Catch time: <strong>{formatDateTime(when)}</strong>
          </small>
        </div>

        {log.notes && (
          <div className={styles.notes}>
            <small>Notes: {log.notes}</small>
          </div>
        )}
      </div>
    </li>
  );
}