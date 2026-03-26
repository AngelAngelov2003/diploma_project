import React, { useMemo } from "react";

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  boxSizing: "border-box",
  background: "white",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  boxSizing: "border-box",
};

export default function DashboardFilters({
  loading,
  catches,
  selectedLakeId,
  setSelectedLakeId,
  selectedSpecies,
  setSelectedSpecies,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  searchTerm,
  setSearchTerm,
  onClear,
}) {
  const lakeOptions = useMemo(() => {
    const m = new Map();
    for (const c of catches || []) {
      const id = c.water_body_id;
      const name = c.lake_name || c.water_body_name || "Unknown location";
      if (id && !m.has(id)) m.set(id, name);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [catches]);

  const speciesOptions = useMemo(() => {
    const s = new Set();
    for (const c of catches || []) if (c.species) s.add(c.species);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [catches]);

  const disabled = Boolean(loading);

  const dimStyle = disabled
    ? { opacity: 0.7, pointerEvents: "none", filter: "grayscale(0.2)" }
    : null;

  return (
    <div
      style={{
        marginTop: "14px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px",
        alignItems: "end",
        ...(dimStyle || {}),
      }}
    >
      <div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Search</div>
        <input
          type="text"
          value={searchTerm || ""}
          onChange={(e) => setSearchTerm?.(e.target.value)}
          placeholder={disabled ? "Loading..." : "Species, lake, notes..."}
          style={inputStyle}
        />
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Lake</div>
        <select value={selectedLakeId} onChange={(e) => setSelectedLakeId(e.target.value)} style={selectStyle}>
          <option value="ALL">{disabled ? "Loading lakes..." : "All lakes"}</option>
          {!disabled &&
            lakeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>Species</div>
        <select value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)} style={selectStyle}>
          <option value="ALL">{disabled ? "Loading species..." : "All species"}</option>
          {!disabled &&
            speciesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>From</div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "6px" }}>To</div>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d1d5db",
            background: "white",
            color: "#334155",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}