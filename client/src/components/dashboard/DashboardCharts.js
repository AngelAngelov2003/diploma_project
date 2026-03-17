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

function ChartsLoadingSkeleton() {
  const boxStyle = {
    border: "1px solid #eee",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
    minWidth: 0,
  };

  const skeletonBar = (h) => ({
    height: h,
    borderRadius: "10px",
    background: "linear-gradient(90deg, #f2f2f2 25%, #e9e9e9 37%, #f2f2f2 63%)",
    backgroundSize: "400% 100%",
    animation: "dash-skeleton 1.2s ease-in-out infinite",
  });

  return (
    <div
      style={{
        marginTop: "12px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "12px",
        minWidth: 0,
      }}
    >
      <style>{`
        @keyframes dash-skeleton {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      <div style={boxStyle}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Charts loading…</div>
        <div style={skeletonBar(220)} />
      </div>

      <div style={boxStyle}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Charts loading…</div>
        <div style={skeletonBar(220)} />
      </div>
    </div>
  );
}

const chartCardStyle = {
  border: "1px solid #eee",
  borderRadius: "12px",
  padding: "10px",
  minWidth: 0,
  overflow: "hidden",
  background: "white",
};

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
      <div style={{ marginTop: "14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setShowCharts((v) => !v)}
          disabled={disableLoadCharts}
          style={{
            background: showCharts ? "#6c757d" : "#007bff",
            opacity: disableLoadCharts ? 0.65 : 1,
            color: "white",
            border: "none",
            padding: "10px 14px",
            borderRadius: "10px",
            cursor: disableLoadCharts ? "not-allowed" : "pointer",
          }}
          title={disableLoadCharts ? "Loading your catches…" : undefined}
        >
          {showCharts ? "Hide charts" : loading ? "Loading…" : "Load charts"}
        </button>

        <div style={{ marginLeft: "auto", fontSize: "12px", color: "#666" }}>{countText}</div>
      </div>

      {showCharts && (
        <div
          style={{
            marginTop: "10px",
            background: "white",
            border: "1px solid #e6e6e6",
            borderRadius: "14px",
            padding: "12px",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: "#333" }}>
              <input type="checkbox" checked={showChartSpecies} onChange={(e) => setShowChartSpecies(e.target.checked)} />
              Top species
            </label>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: "#333" }}>
              <input type="checkbox" checked={showChartLakes} onChange={(e) => setShowChartLakes(e.target.checked)} />
              Top lakes
            </label>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: "#333" }}>
              <input type="checkbox" checked={showChartTrend} onChange={(e) => setShowChartTrend(e.target.checked)} />
              Catches over time
            </label>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: "#333" }}>
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
            <div style={{ padding: "14px 2px", color: "#666" }}>Select at least one chart.</div>
          ) : (
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "12px",
                minWidth: 0,
              }}
            >
              {showChartSpecies && (
                <div style={chartCardStyle}>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Top species (count)</div>
                  {chartSpeciesTop.length === 0 ? (
                    <div style={{ padding: "10px 0", color: "#666" }}>No data.</div>
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
                <div style={chartCardStyle}>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Top lakes (count)</div>
                  {chartLakesTop.length === 0 ? (
                    <div style={{ padding: "10px 0", color: "#666" }}>No data.</div>
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
                <div style={chartCardStyle}>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Catches over time</div>
                  {chartTrendByDay.length === 0 ? (
                    <div style={{ padding: "10px 0", color: "#666" }}>No data.</div>
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
                <div style={chartCardStyle}>
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