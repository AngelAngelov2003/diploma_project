import React, { useState } from "react";
import styles from "./CatchLogItem.module.css";
import { FaFish, FaMapMarkedAlt, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import { formatDateTime } from "../../utils/date";
import ZoomableImage from "../ui/ZoomableImage";

const API_BASE_URL = "http://localhost:5000";

const toDateTimeInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function CatchLogItem({ log, onLakeClick, onUpdate, onDelete, saving }) {
  const when = log.catch_time || log.created_at;
  const imgSrc = log.image_url ? `${API_BASE_URL}/uploads/${log.image_url}` : null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    species: log.species || "",
    weight_kg: log.weight_kg ?? "",
    catch_time: toDateTimeInput(log.catch_time || log.created_at),
    notes: log.notes || "",
  });

  const submitUpdate = async () => {
    await onUpdate?.(log.id, {
      species: form.species,
      weight_kg: form.weight_kg,
      catch_time: form.catch_time,
      notes: form.notes,
    });
    setEditing(false);
  };

  return (
    <li className={styles.item}>
      <div className={styles.imageBox}>
        {imgSrc ? (
          <ZoomableImage src={imgSrc} alt={log.species || "Catch"} imageClassName={styles.image} />
        ) : (
          <FaFish size={38} color="#6c757d" />
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            {editing ? (
              <div className={styles.editGrid}>
                <label>
                  Species
                  <input value={form.species} onChange={(e) => setForm((prev) => ({ ...prev, species: e.target.value }))} />
                </label>
                <label>
                  Weight kg
                  <input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm((prev) => ({ ...prev, weight_kg: e.target.value }))} />
                </label>
                <label>
                  Catch time
                  <input type="datetime-local" value={form.catch_time} onChange={(e) => setForm((prev) => ({ ...prev, catch_time: e.target.value }))} />
                </label>
                <label className={styles.notesField}>
                  Notes
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.title}>
                  <strong>{log.species}</strong>
                  <span className={styles.weight}>— {log.weight_kg}kg</span>
                </div>
                <div className={styles.metaChips}>
                  <span className={styles.metaChip}>Catch time: <strong>{formatDateTime(when)}</strong></span>
                  {log.notes ? <span className={styles.metaChip}>Notes: {log.notes}</span> : null}
                </div>
              </>
            )}
          </div>
          {log.lake_name || log.water_body_name ? (
            <button
              type="button"
              onClick={() =>
                onLakeClick && log.water_body_id !== null && log.water_body_id !== undefined && log.water_body_id !== ""
                  ? onLakeClick(log.water_body_id)
                  : null
              }
              className={styles.lakeLink}
            >
              <FaMapMarkedAlt />
              <span>{log.lake_name || log.water_body_name}</span>
            </button>
          ) : null}
        </div>

        <div className={styles.actionRow}>
          {editing ? (
            <>
              <button type="button" className={styles.saveButton} disabled={saving} onClick={submitUpdate}><FaSave /> {saving ? "Saving..." : "Save"}</button>
              <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setEditing(false)}><FaTimes /> Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}><FaEdit /> Edit</button>
              <button type="button" className={styles.deleteButton} disabled={saving} onClick={() => onDelete?.(log.id)}><FaTrash /> Delete</button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
