import React from "react";
import ui from "../../styles/ui.module.css";

export default function SectionHeader({ title, action = null, className = "", titleClassName = "" }) {
  return (
    <div className={[ui.sectionHeader, className].filter(Boolean).join(" ")}>
      <h3 className={[ui.sectionHeaderTitle, titleClassName].filter(Boolean).join(" ")}>{title}</h3>
      {action ? <div className={ui.sectionHeaderAction}>{action}</div> : null}
    </div>
  );
}
