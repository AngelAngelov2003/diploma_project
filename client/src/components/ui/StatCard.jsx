import React from "react";
import ui from "../../styles/ui.module.css";
import Card from "./Card";

export default function StatCard({ label, value, className = "" }) {
  return (
    <Card className={[ui.statCard, className].filter(Boolean).join(" ")}>
      <div className={ui.statLabel}>{label}</div>
      <div className={ui.statValue}>{value}</div>
    </Card>
  );
}
