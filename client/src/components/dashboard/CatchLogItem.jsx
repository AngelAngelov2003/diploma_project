import React, { useEffect, useState } from "react";
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
  const [localLog, setLocalLog] = useState(log);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    species: log.species || "",
    weight_kg: log.weight_kg ?? "",
    catch_time: toDateTimeInput(log.catch_time || log.created_at),
    notes: log.notes || "",
  });

  useEffect(() => {
    setLocalLog(log);

    if (!editing) {
      setForm({
        species: log.species || "",
        weight_kg: log.weight_kg ?? "",
        catch_time: toDateTimeInput(log.catch_time || log.created_at),
        notes: log.notes || "",
      });
    }
  }, [log, editing]);

  const when = localLog.catch_time || localLog.created_at;
  const imgSrc = localLog.image_url ? `${API_BASE_URL}/uploads/${localLog.image_url}` : null;

  const submitUpdate = async () => {
    const payload = {
      species: form.species,
      weight_kg: form.weight_kg,
      catch_time: form.catch_time,
      notes: form.notes,
    };

    const updatedLog = await onUpdate?.(localLog.id, payload);
    setLocalLog((prev) => ({ ...prev, ...payload, ...(updatedLog || {}) }));
    setEditing(false);
  };

  return (
    <li className={styles.item}>
      <div className={styles.imageBox}>
        {imgSrc ? (
          <ZoomableImage src={imgSrc} alt={localLog.species || "Улов"} imageClassName={styles.image} />
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
                  Вид риба
                  <input value={form.species} onChange={(e) => setForm((prev) => ({ ...prev, species: e.target.value }))} />
                </label>
                <label>
                  Тегло (кг)
                  <input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm((prev) => ({ ...prev, weight_kg: e.target.value }))} />
                </label>
                <label>
                  Време на улова
                  <input type="datetime-local" lang="bg-BG" value={form.catch_time} onChange={(e) => setForm((prev) => ({ ...prev, catch_time: e.target.value }))} />
                </label>
                <label className={styles.notesField}>
                  Бележки
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.title}>
                  <strong>{localLog.species || "Неизвестно"}</strong>
                  <span className={styles.weight}>— {localLog.weight_kg} кг</span>
                </div>
                <div className={styles.metaChips}>
                  <span className={styles.metaChip}>Време на улова: <strong>{formatDateTime(when)}</strong></span>
                  {localLog.notes ? <span className={styles.metaChip}>Бележки: {localLog.notes}</span> : null}
                </div>
              </>
            )}
          </div>
          {localLog.lake_name || localLog.water_body_name ? (
            <button
              type="button"
              onClick={() =>
                onLakeClick && localLog.water_body_id !== null && localLog.water_body_id !== undefined && localLog.water_body_id !== ""
                  ? onLakeClick(localLog.water_body_id)
                  : null
              }
              className={styles.lakeLink}
            >
              <FaMapMarkedAlt />
              <span>{localLog.lake_name || localLog.water_body_name}</span>
            </button>
          ) : null}
        </div>

        <div className={styles.actionRow}>
          {editing ? (
            <>
              <button type="button" className={styles.saveButton} disabled={saving} onClick={submitUpdate}><FaSave /> {saving ? "Запазване..." : "Запази"}</button>
              <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setEditing(false)}><FaTimes /> Откажи</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}><FaEdit /> Редактирай</button>
              <button type="button" className={styles.deleteButton} disabled={saving} onClick={() => onDelete?.(localLog.id)}><FaTrash /> Изтрий</button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
