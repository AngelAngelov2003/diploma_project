import React from "react";
import { FaSearch } from "react-icons/fa";
import ui from "../../styles/ui.module.css";

export default function SearchInput({ value, onChange, placeholder, minWidth = 320, className = "" }) {
  return (
    <div className={[ui.searchField, className].filter(Boolean).join(" ")} style={{ minWidth }}>
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
