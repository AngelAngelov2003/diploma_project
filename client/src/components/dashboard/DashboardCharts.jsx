import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  buildAvgWeightBySpecies,
  buildTopLakes,
  buildTopSpecies,
  buildTrendByDay,
} from "../../utils/dashboardCharts";
import styles from "./DashboardCharts.module.css";

function ChartsLoadingSkeleton() {
  return (
    <div className={styles.skeletonGrid}>
      <div className={styles.skeletonCard}>
        <div className={styles.skeletonTitle}>Charts loading…</div>
        <div className={styles.skeletonBar} style={{ height: 220 }} />
      </div>
      <div className={styles.skeletonCard}>
        <div className={styles.skeletonTitle}>Charts loading…</div>
        <div className={styles.skeletonBar} style={{ height: 220 }} />
      </div>
    </div>
  );
}

export default function DashboardCharts({
  logs,
  loading,
  showCharts,
  setShowCharts,
  showChartSpecies,
  setShowChartSpecies,
  showChartLakes,
  setShowChartLakes,
  showChartTrend,
  setShowChartTrend,
  showChartAvgWeight,
  setShowChartAvgWeight,
  countText,
}) {
  const anyChartSelected = showChartSpecies || showChartLakes || showChartTrend || showChartAvgWeight;

  const chartSpeciesTop = useMemo(() => buildTopSpecies(logs, 10), [logs]);
  const chartLakesTop = useMemo(() => buildTopLakes(logs, 10), [logs]);
  const chartTrendByDay = useMemo(() => buildTrendByDay(logs), [logs]);
  const chartAvgWeightBySpecies = useMemo(() => buildAvgWeightBySpecies(logs, 10), [logs]);

  const disableLoadCharts = loading && !showCharts;

  return (
    <>
      <div className={styles.toolbar}>
        <button
          type="button"
          onClick={() => setShowCharts((v) => !v)}
          disabled={disableLoadCharts}
          className={styles.toggleButton}
          style={{
            background: showCharts ? "#6c757d" : "#007bff",
            opacity: disableLoadCharts ? 0.65 : 1,
            cursor: disableLoadCharts ? "not-allowed" : "pointer",
          }}
          title={disableLoadCharts ? "Loading your catches…" : undefined}
        >
          {showCharts ? "Hide charts" : loading ? "Loading…" : "Load charts"}
        </button>

        <div className={styles.countText}>{countText}</div>
      </div>

      {showCharts && (
        <div className={styles.panel}>
          <div className={styles.checkboxRow}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={showChartSpecies} onChange={(e) => setShowChartSpecies(e.target.checked)} />
              Top species
            </label>

            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={showChartLakes} onChange={(e) => setShowChartLakes(e.target.checked)} />
              Top lakes
            </label>

            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={showChartTrend} onChange={(e) => setShowChartTrend(e.target.checked)} />
              Catches over time
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChartAvgWeight}
                onChange={(e) => setShowChartAvgWeight(e.target.checked)}
              />
              Avg weight by species
            </label>
          </div>

          {loading ? (
            <ChartsLoadingSkeleton />
          ) : !anyChartSelected ? (
            <div className={styles.emptyState}>Select at least one chart.</div>
          ) : (
            <div className={styles.chartGrid}>
              {showChartSpecies && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Top species (count)</div>
                  {chartSpeciesTop.length === 0 ? (
                    <div className={styles.noData}>No data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartSpeciesTop} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} height={55} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {showChartLakes && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Top lakes (count)</div>
                  {chartLakesTop.length === 0 ? (
                    <div className={styles.noData}>No data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartLakesTop} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} height={55} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {showChartTrend && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Catches over time</div>
                  {chartTrendByDay.length === 0 ? (
                    <div className={styles.noData}>No data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartTrendByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {showChartAvgWeight && (
                <div className={styles.chartCard}>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
                    Avg weight by species (kg)
                  </div>
                  {chartAvgWeightBySpecies.length === 0 ? (
                    <div style={{ padding: "10px 0", color: "#666" }}>No weights available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartAvgWeightBySpecies} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} height={55} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}