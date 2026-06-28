import React from "react";
import styles from "./PageLoadingState.module.css";

const makeItems = (count) => Array.from({ length: count }, (_, index) => index);

export function SectionLoadingState({
  title = "Зареждане на данни...",
  subtitle = "Моля, изчакайте докато информацията се зарежда от сървъра.",
  cards = 2,
  rows = 2,
}) {
  return (
    <PageLoadingState
      title={title}
      subtitle={subtitle}
      cards={cards}
      rows={rows}
      compact
    />
  );
}

export default function PageLoadingState({
  title = "Зареждане...",
  subtitle = "Подготвяме съдържанието. Страницата ще се обнови автоматично.",
  cards = 3,
  rows = 3,
  compact = false,
}) {
  const wrapperClass = compact ? `${styles.wrapper} ${styles.compactWrapper}` : styles.wrapper;
  const panelClass = compact ? `${styles.panel} ${styles.compactPanel}` : styles.panel;

  return (
    <div className={wrapperClass} role="status" aria-live="polite" aria-busy="true">
      <div className={panelClass}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={`${styles.skeleton} ${styles.pill}`} />
        </div>

        <div className={styles.grid}>
          {makeItems(cards).map((item) => (
            <div className={styles.card} key={`card-${item}`}>
              <div className={`${styles.skeleton} ${styles.line} ${styles.short}`} />
              <div className={`${styles.skeleton} ${styles.line} ${styles.medium}`} />
              <div className={`${styles.skeleton} ${styles.block}`} />
            </div>
          ))}
        </div>

        <div className={styles.list}>
          {makeItems(rows).map((item) => (
            <div className={styles.listItem} key={`row-${item}`}>
              <div className={`${styles.skeleton} ${styles.line} ${styles.long}`} />
              <div className={`${styles.skeleton} ${styles.line} ${styles.medium}`} />
              <div className={`${styles.skeleton} ${styles.line} ${styles.short}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
