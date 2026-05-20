import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import styles from "./DatePicker.module.css";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDateOnly = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const toInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const sameDay = (a, b) => Boolean(a && b && toInputValue(a) === toInputValue(b));

const formatDisplayDate = (date) => (date ? DISPLAY_FORMATTER.format(date) : "");

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Choose date",
  className = "",
  range = false,
  startValue = "",
  endValue = "",
  onRangeChange,
  disabledDates = [],
  rangeStartHint = "Choose the first fishing day",
  rangeEndHint = "Choose the last fishing day",
}) {
  const selectedDate = toDateOnly(value);
  const rangeStartDate = toDateOnly(startValue);
  const rangeEndDate = toDateOnly(endValue);
  const minDate = toDateOnly(min);
  const maxDate = toDateOnly(max);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(rangeStartDate || selectedDate || minDate || today));
  const [rangeStep, setRangeStep] = useState("start");
  const wrapperRef = useRef(null);
  const disabledDateSet = useMemo(() => new Set((disabledDates || []).filter(Boolean)), [disabledDates]);

  useEffect(() => {
    const anchorDate = range ? toDateOnly(startValue || endValue) : toDateOnly(value);
    if (!anchorDate) return;
    const nextMonth = startOfMonth(anchorDate);
    setVisibleMonth((prev) => (
      prev.getFullYear() === nextMonth.getFullYear() && prev.getMonth() === nextMonth.getMonth()
        ? prev
        : nextMonth
    ));
  }, [range, startValue, endValue, value]);

  useEffect(() => {
    if (range && !startValue && !endValue) setRangeStep("start");
  }, [range, startValue, endValue]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const days = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const isDisabledDay = (date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return disabledDateSet.has(toInputValue(date));
  };

  const rangeContainsDisabledDay = (start, end) => {
    if (!start || !end) return false;
    const cursor = new Date(Math.min(start.getTime(), end.getTime()));
    const final = new Date(Math.max(start.getTime(), end.getTime()));
    while (cursor <= final) {
      if (isDisabledDay(cursor)) return true;
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  };

  const handleSelect = (date) => {
    if (isDisabledDay(date)) return;
    const dateValue = toInputValue(date);

    if (!range) {
      onChange?.(dateValue);
      setOpen(false);
      return;
    }

    if (rangeStep === "start" || !rangeStartDate) {
      onRangeChange?.({ start: dateValue, end: dateValue });
      setRangeStep("end");
      return;
    }

    if (rangeContainsDisabledDay(rangeStartDate, date)) return;

    const startValueString = toInputValue(rangeStartDate);
    if (date < rangeStartDate) {
      onRangeChange?.({ start: dateValue, end: startValueString });
    } else {
      onRangeChange?.({ start: startValueString, end: dateValue });
    }
    setRangeStep("start");
    setOpen(false);
  };

  const displayValue = range
    ? rangeStartDate && rangeEndDate
      ? sameDay(rangeStartDate, rangeEndDate)
        ? formatDisplayDate(rangeStartDate)
        : `${formatDisplayDate(rangeStartDate)} - ${formatDisplayDate(rangeEndDate)}`
      : ""
    : selectedDate
      ? formatDisplayDate(selectedDate)
      : "";

  return (
    <div className={`${styles.wrapper} ${className}`.trim()} ref={wrapperRef}>
      <button
        type="button"
        className={styles.button}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span className={displayValue ? "" : styles.placeholder}>{displayValue || placeholder}</span>
        <FaCalendarAlt className={styles.icon} />
      </button>

      {open ? (
        <div className={styles.popover} role="dialog" aria-label={range ? "Choose date range" : "Choose date"}>
          <div className={styles.header}>
            <div>
              <div className={styles.monthTitle}>{MONTH_FORMATTER.format(visibleMonth)}</div>
              {range ? <div className={styles.rangeHint}>{rangeStep === "end" ? rangeEndHint : rangeStartHint}</div> : null}
            </div>
            <div className={styles.navGroup}>
              <button type="button" className={styles.navButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))} aria-label="Previous month">‹</button>
              <button type="button" className={styles.navButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))} aria-label="Next month">›</button>
            </div>
          </div>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((day) => <div key={day} className={styles.weekday}>{day}</div>)}
          </div>
          <div className={styles.grid}>
            {days.map((date) => {
              const dateValue = toInputValue(date);
              const outside = date.getMonth() !== visibleMonth.getMonth();
              const selected = range ? sameDay(date, rangeStartDate) || sameDay(date, rangeEndDate) : sameDay(date, selectedDate);
              const inRange = range && rangeStartDate && rangeEndDate && date > rangeStartDate && date < rangeEndDate;
              const disabledDay = isDisabledDay(date);
              const classNames = [
                styles.day,
                outside ? styles.outside : "",
                sameDay(date, today) ? styles.today : "",
                inRange ? styles.inRange : "",
                selected ? styles.selected : "",
                disabledDay ? styles.disabledDay : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={classNames}
                  disabled={disabledDay}
                  onClick={() => handleSelect(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className={styles.footer}>
            {(range ? startValue || endValue : value) ? (
              <button
                type="button"
                className={styles.footerButton}
                onClick={() => {
                  if (range) onRangeChange?.({ start: "", end: "" });
                  else onChange?.("");
                  setRangeStep("start");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}
            <button type="button" className={styles.footerButton} onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
