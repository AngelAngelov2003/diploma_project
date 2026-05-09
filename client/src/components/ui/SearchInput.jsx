import React from "react";
import { FaSearch } from "react-icons/fa";
import ui from "../../styles/ui.module.css";

export default function SearchInput({ value, onChange, placeholder, minWidth = 320, className = "" }) {
  return (
    <div
      className={[ui.searchField, className].filter(Boolean).join(" ")}
      style={{ width: "100%", minWidth: `min(100%, ${minWidth}px)`, maxWidth: "100%", boxSizing: "border-box" }}
    >
      <FaSearch className={ui.searchIcon} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={ui.searchInput}
      />
    </div>
  );
}
