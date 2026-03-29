import React from "react";
import ui from "../../styles/ui.module.css";

export default function TabButton({ active = false, onClick, icon = null, children, badge = null }) {
  return (
    <button type="button" onClick={onClick} className={[ui.tabButton, active ? ui.tabButtonActive : ""].filter(Boolean).join(" ")}>
      {icon}
      <span>{children}</span>
      {badge !== null && badge !== undefined && badge !== false ? (
        <span className={[ui.tabBadge, active ? ui.tabBadgeActive : ""].filter(Boolean).join(" ")}>{badge}</span>
      ) : null}
    </button>
  );
}
