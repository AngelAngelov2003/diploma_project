import React from "react";
import ui from "../../styles/ui.module.css";

export default function Card({ className = "", as: Component = "div", children, ...props }) {
  return (
    <Component className={[ui.card, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Component>
  );
}
