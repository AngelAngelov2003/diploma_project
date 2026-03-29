import React from "react";
import ui from "../../styles/ui.module.css";

const toneClassMap = {
  primary: ui.buttonPrimary,
  neutral: ui.buttonNeutral,
  success: ui.buttonSuccess,
  danger: ui.buttonDanger,
  warning: ui.buttonWarning,
};

export default function ActionButton({
  type = "button",
  tone = "primary",
  compact = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        ui.button,
        toneClassMap[tone] || ui.buttonPrimary,
        compact ? ui.buttonCompact : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
