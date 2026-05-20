import React, { useMemo } from "react";
import styles from "./DashboardFilters.module.css";
import DatePicker from "../ui/DatePicker";

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

  return (
    <div className={`${styles.filtersBlock} ${disabled ? styles.filtersGridDisabled : ""}`.trim()}>
      <div className={styles.filtersGrid}>
      <div>
        <div className={styles.label}>Search</div>
        <input
          type="text"
          value={searchTerm || ""}
          onChange={(e) => setSearchTerm?.(e.target.value)}
          placeholder={disabled ? "Loading..." : "Species, lake, notes..."}
          className={styles.control}
        />
      </div>

      <div>
        <div className={styles.label}>Lake</div>
        <select value={selectedLakeId} onChange={(e) => setSelectedLakeId(e.target.value)} className={styles.control}>
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
        <div className={styles.label}>Species</div>
        <select value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)} className={styles.control}>
          <option value="ALL">{disabled ? "Loading species..." : "All species"}</option>
          {!disabled &&
            speciesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </div>

      <div className={styles.dateRangeField}>
        <div className={styles.label}>Date range</div>
        <DatePicker
          range
          startValue={dateFrom}
          endValue={dateTo}
          placeholder="Choose date range"
          rangeStartHint="Choose the start date"
          rangeEndHint="Choose the end date"
          onRangeChange={({ start, end }) => {
            setDateFrom(start || "");
            setDateTo(end || start || "");
          }}
          disabled={disabled}
        />
      </div>

      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className={styles.clearButton}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}