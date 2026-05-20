import React from "react";
import styles from "./CatchLogItem.module.css";
import CatchLogItem from "./CatchLogItem";

export default function CatchLogList({ logs, onLakeClick, onUpdate, onDelete, savingId, loading, hasAnyCatches }) {
  if (loading) return <p>Loading catches…</p>;

  if (!logs.length) {
    return <p>{hasAnyCatches ? "No catches match your filters." : "No catches logged yet."}</p>;
  }

  return (
    <ul className={styles.list}>
      {logs.map((c) => (
        <CatchLogItem key={c.id} log={c} onLakeClick={onLakeClick} onUpdate={onUpdate} onDelete={onDelete} saving={savingId === c.id} />
      ))}
    </ul>
  );
}