import React from "react";
import styles from "./CatchLogItem.module.css";
import CatchLogItem from "./CatchLogItem";
import { SectionLoadingState } from "../common/PageLoadingState";

export default function CatchLogList({ logs, onLakeClick, onUpdate, onDelete, savingId, loading, hasAnyCatches }) {
  if (loading) return <SectionLoadingState title="Зареждане на улови..." subtitle="Подготвяме списъка с вашите записи." cards={1} rows={3} />;

  if (!logs.length) {
    return <p>{hasAnyCatches ? "Няма улови, които съвпадат с филтрите." : "Все още няма записани улови."}</p>;
  }

  return (
    <ul className={styles.list}>
      {logs.map((c) => (
        <CatchLogItem key={c.id} log={c} onLakeClick={onLakeClick} onUpdate={onUpdate} onDelete={onDelete} saving={savingId === c.id} />
      ))}
    </ul>
  );
}