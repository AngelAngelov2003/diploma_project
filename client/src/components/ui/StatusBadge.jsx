import React from "react";
import ui from "../../styles/ui.module.css";

const statusClassMap = {
  pending: ui.badgePending,
  approved: ui.badgeApproved,
  rejected: ui.badgeRejected,
  cancelled: ui.badgeCancelled,
};

export default function StatusBadge({ status, className = "" }) {
  const normalizedStatus = String(status || "").toLowerCase();

  return (
    <span
      className={[
        ui.badge,
        statusClassMap[normalizedStatus] || ui.badgeNeutral,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {normalizedStatus || "unknown"}
    </span>
  );
}
