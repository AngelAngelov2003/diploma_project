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
        <div className={styles.skeletonTitle}>Зареждане на графиките…</div>
        <div className={styles.skeletonBar} style={{ height: 260 }} />
      </div>
      <div className={styles.skeletonCard}>
        <div className={styles.skeletonTitle}>Зареждане на графиките…</div>
        <div className={styles.skeletonBar} style={{ height: 260 }} />
      </div>
    </div>
  );
}

const truncateLabel = (value, limit = 14) => {
  const label = String(value || "");
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
};

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bg-BG", { month: "short", day: "numeric" });
};

function CustomTooltip({ active, payload, label, valueSuffix = "", labelFormatter }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0];

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      <div className={styles.tooltipValue}>
        {point.value}
        {valueSuffix}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>{title}</div>
        {subtitle ? <div className={styles.chartSubtitle}>{subtitle}</div> : null}
      </div>
      {children}
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
  const anyChartSelected =
    showChartSpecies || showChartLakes || showChartTrend || showChartAvgWeight;

  const chartSpeciesTop = useMemo(() => buildTopSpecies(logs, 10), [logs]);
  const chartLakesTop = useMemo(() => buildTopLakes(logs, 10), [logs]);
  const chartTrendByDay = useMemo(() => buildTrendByDay(logs), [logs]);
  const chartAvgWeightBySpecies = useMemo(
    () => buildAvgWeightBySpecies(logs, 10),
    [logs],
  );

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
            background: showCharts
              ? "linear-gradient(135deg, #64748b 0%, #475569 100%)"
              : "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
            opacity: disableLoadCharts ? 0.65 : 1,
            cursor: disableLoadCharts ? "not-allowed" : "pointer",
          }}
          title={disableLoadCharts ? "Зареждане на уловите…" : undefined}
        >
          {showCharts ? "Скрий графиките" : loading ? "Зареждане…" : "Зареди графиките"}
        </button>

        <div className={styles.countText}>{countText}</div>
      </div>

      {showCharts && (
        <div className={styles.panel}>
          <div className={styles.checkboxRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChartSpecies}
                onChange={(e) => setShowChartSpecies(e.target.checked)}
              />
              Топ видове
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChartLakes}
                onChange={(e) => setShowChartLakes(e.target.checked)}
              />
              Топ водоеми
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChartTrend}
                onChange={(e) => setShowChartTrend(e.target.checked)}
              />
              Улови във времето
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChartAvgWeight}
                onChange={(e) => setShowChartAvgWeight(e.target.checked)}
              />
              Средно тегло по вид риба
            </label>
          </div>

          {loading ? (
            <ChartsLoadingSkeleton />
          ) : !anyChartSelected ? (
            <div className={styles.emptyState}>Изберете поне една графика.</div>
          ) : (
            <div className={styles.chartGrid}>
              {showChartSpecies && (
                <ChartCard
                  title="Топ видове"
                  subtitle="Най-често записвани видове"
                >
                  {chartSpeciesTop.length === 0 ? (
                    <div className={styles.noData}>Няма данни.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={chartSpeciesTop}
                        margin={{ top: 8, right: 8, left: -18, bottom: 10 }}
                        barSize={34}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={46}
                          tickFormatter={(value) => truncateLabel(value)}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip valueSuffix=" улова" />} />
                        <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )}

              {showChartLakes && (
                <ChartCard title="Топ водоеми" subtitle="Водоеми с най-много улови">
                  {chartLakesTop.length === 0 ? (
                    <div className={styles.noData}>Няма данни.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={chartLakesTop}
                        margin={{ top: 8, right: 8, left: -18, bottom: 10 }}
                        barSize={34}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={46}
                          tickFormatter={(value) => truncateLabel(value)}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip valueSuffix=" улова" />} />
                        <Bar dataKey="value" fill="#0ea5e9" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )}

              {showChartTrend && (
                <ChartCard
                  title="Улови във времето"
                  subtitle="Как се променя риболовната ви активност по дни"
                >
                  {chartTrendByDay.length === 0 ? (
                    <div className={styles.noData}>Няма данни.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart
                        data={chartTrendByDay}
                        margin={{ top: 8, right: 16, left: -18, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatDateLabel}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={
                            <CustomTooltip
                              valueSuffix=" улова"
                              labelFormatter={formatDateLabel}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )}

              {showChartAvgWeight && (
                <ChartCard
                  title="Средно тегло по видове"
                  subtitle="Средно тегло на улова в килограми"
                >
                  {chartAvgWeightBySpecies.length === 0 ? (
                    <div className={styles.noData}>Няма налични тегла.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={chartAvgWeightBySpecies}
                        margin={{ top: 8, right: 8, left: -18, bottom: 10 }}
                        barSize={34}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={46}
                          tickFormatter={(value) => truncateLabel(value)}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip valueSuffix=" кг" />} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
