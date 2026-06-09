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
      const name = c.lake_name || c.water_body_name || "Неизвестно място";
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
        <div className={styles.label}>Търсене</div>
        <input
          type="text"
          value={searchTerm || ""}
          onChange={(e) => setSearchTerm?.(e.target.value)}
          placeholder={disabled ? "Зареждане..." : "Вид риба, водоем, бележки..."}
          className={styles.control}
        />
      </div>

      <div>
        <div className={styles.label}>Водоем</div>
        <select value={selectedLakeId} onChange={(e) => setSelectedLakeId(e.target.value)} className={styles.control}>
          <option value="ALL">{disabled ? "Зареждане на водоеми..." : "Всички водоеми"}</option>
          {!disabled &&
            lakeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <div className={styles.label}>Вид риба</div>
        <select value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)} className={styles.control}>
          <option value="ALL">{disabled ? "Зареждане на видове..." : "Всички видове"}</option>
          {!disabled &&
            speciesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </div>

      <div className={styles.dateRangeField}>
        <div className={styles.label}>Период</div>
        <DatePicker
          range
          startValue={dateFrom}
          endValue={dateTo}
          placeholder="Изберете период"
          rangeStartHint="Избери начална дата"
          rangeEndHint="Избери крайна дата"
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
          Изчисти филтрите
        </button>
      </div>
    </div>
  );
}