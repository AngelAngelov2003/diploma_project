import React from "react";
import ui from "../../styles/ui.module.css";

export default function PageContainer({ width = "wide", className = "", children }) {
  const widthClass =
    width === "narrow" ? ui.shellNarrow : width === "medium" ? ui.shellMedium : ui.shellWide;

  return <div className={[ui.shell, widthClass, className].filter(Boolean).join(" ")}>{children}</div>;
}
