import React from "react";
import CatchLogItem from "./CatchLogItem";

export default function CatchLogList({ logs, onLakeClick, loading, hasAnyCatches }) {
  if (loading) return <p>Loading catches…</p>;

  if (!logs.length) {
    return <p>{hasAnyCatches ? "No catches match your filters." : "No catches logged yet."}</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {logs.map((c) => (
        <CatchLogItem key={c.id} log={c} onLakeClick={onLakeClick} />
      ))}
    </ul>
  );
}