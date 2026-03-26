import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartBar,
  FaArrowRight,
  FaFish,
  FaMapMarkedAlt,
  FaWeightHanging,
  FaTrophy,
  FaStream,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useMyCatches from "../hooks/useMyCatches";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import CatchLogList from "../components/dashboard/CatchLogList";

const SKELETON_DELAY_MS = 200;

const SkeletonRow = ({ i }) => (
  <li
    key={i}
    style={{
      background: "#f8f9fa",
      margin: "10px 0",
      padding: "15px",
      border: "1px solid #ddd",
      borderRadius: "12px",
      display: "flex",
      gap: "14px",
      alignItems: "flex-start",
    }}
  >
    <div
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "12px",
        background: "#e9ecef",
        border: "1px solid #e6e6e6",
        flexShrink: 0,
      }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          height: "16px",
          width: "55%",
          background: "#e9ecef",
          borderRadius: "6px",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "35%",
          background: "#e9ecef",
          borderRadius: "6px",
          marginTop: "10px",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "45%",
          background: "#e9ecef",
          borderRadius: "6px",
          marginTop: "12px",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "30%",
          background: "#e9ecef",
          borderRadius: "6px",
          marginTop: "10px",
        }}
      />
    </div>
  </li>
);

const StatCard = ({ icon, label, value, subvalue }) => (
  <div
    style={{
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: "16px",
      padding: "18px",
      boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        color: "#2563eb",
        marginBottom: "10px",
      }}
    >
      <div style={{ fontSize: "18px" }}>{icon}</div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
    </div>

    <div
      style={{
        fontSize: "28px",
        fontWeight: 800,
        color: "#0f172a",
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>

    {subvalue ? (
      <div style={{ marginTop: "8px", fontSize: "13px", color: "#64748b" }}>
        {subvalue}
      </div>
    ) : null}
  </div>
);

const InsightCard = ({ title, children }) => (
  <div
    style={{
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: "16px",
      padding: "18px",
      boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
    }}
  >
    <h3 style={{ margin: "0 0 14px 0", color: "#0f172a", fontSize: "18px" }}>
      {title}
    </h3>
    {children}
  </div>
);

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value % 1 === 0 ? String(value) : value.toFixed(2);
};

const formatDateLabel = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString();
};

const getCatchTimestamp = (catchItem) => {
  const when = catchItem.catch_time || catchItem.created_at;
  const timestamp = when ? new Date(when).getTime() : null;

  if (timestamp == null || Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
};

const buildSearchHaystack = (catchItem) =>
  [
    catchItem.species,
    catchItem.lake_name,
    catchItem.notes,
    catchItem.weight_kg,
    catchItem.temperature,
    catchItem.pressure,
    catchItem.wind_speed,
    catchItem.moon_phase,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

const sortMapEntries = (entries) =>
  [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export default function Dashboard() {
  const { catches, loading, error, reload } = useMyCatches();

  const [selectedLakeId, setSelectedLakeId] = useState("ALL");
  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showCharts, setShowCharts] = useState(true);
  const [showChartSpecies, setShowChartSpecies] = useState(true);
  const [showChartLakes, setShowChartLakes] = useState(true);
  const [showChartTrend, setShowChartTrend] = useState(true);
  const [showChartAvgWeight, setShowChartAvgWeight] = useState(true);

  const [showSkeleton, setShowSkeleton] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let timer;

    if (loading) {
      timer = setTimeout(() => {
        setShowSkeleton(true);
      }, SKELETON_DELAY_MS);
    } else {
      setShowSkeleton(false);
    }

    return () => clearTimeout(timer);
  }, [loading]);

  const hasAnyCatches = (catches || []).length > 0;

  const filteredCatches = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() : null;
    const query = searchTerm.trim().toLowerCase();

    return (catches || []).filter((catchItem) => {
      if (
        selectedLakeId !== "ALL" &&
        String(catchItem.water_body_id) !== String(selectedLakeId)
      ) {
        return false;
      }

      if (
        selectedSpecies !== "ALL" &&
        catchItem.species !== selectedSpecies
      ) {
        return false;
      }

      const timestamp = getCatchTimestamp(catchItem);

      if (timestamp == null) {
        return false;
      }

      if (fromMs != null && timestamp < fromMs) {
        return false;
      }

      if (toMs != null && timestamp > toMs + 24 * 60 * 60 * 1000 - 1) {
        return false;
      }

      if (query && !buildSearchHaystack(catchItem).includes(query)) {
        return false;
      }

      return true;
    });
  }, [catches, selectedLakeId, selectedSpecies, dateFrom, dateTo, searchTerm]);

  const dashboardStats = useMemo(() => {
    const safeLogs = filteredCatches || [];
    const totalCatches = safeLogs.length;

    const uniqueLakes = new Set(
      safeLogs.map((catchItem) => catchItem.water_body_id).filter(Boolean),
    ).size;

    const catchesWithWeight = safeLogs.filter((catchItem) =>
      Number.isFinite(Number(catchItem.weight_kg)),
    );

    const totalWeight = catchesWithWeight.reduce(
      (sum, catchItem) => sum + Number(catchItem.weight_kg || 0),
      0,
    );

    const avgWeight = catchesWithWeight.length
      ? totalWeight / catchesWithWeight.length
      : 0;

    const biggestCatch =
      catchesWithWeight.length > 0
        ? catchesWithWeight.reduce((maxCatch, currentCatch) =>
            Number(currentCatch.weight_kg || 0) >
            Number(maxCatch.weight_kg || 0)
              ? currentCatch
              : maxCatch,
          )
        : null;

    const speciesMap = new Map();
    const lakeMap = new Map();
    const monthMap = new Map();

    safeLogs.forEach((catchItem) => {
      const species = String(catchItem.species || "Unknown").trim() || "Unknown";
      const lake =
        String(catchItem.lake_name || "Unknown lake").trim() || "Unknown lake";

      speciesMap.set(species, (speciesMap.get(species) || 0) + 1);
      lakeMap.set(lake, (lakeMap.get(lake) || 0) + 1);

      const when = catchItem.catch_time || catchItem.created_at;
      const date = when ? new Date(when) : null;

      if (date && !Number.isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;

        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
      }
    });

    const topSpeciesEntry = sortMapEntries(speciesMap.entries())[0] || null;
    const topLakeEntry = sortMapEntries(lakeMap.entries())[0] || null;
    const bestMonthEntry = sortMapEntries(monthMap.entries())[0] || null;

    const topSpecies = topSpeciesEntry
      ? { name: topSpeciesEntry[0], count: topSpeciesEntry[1] }
      : null;

    const topLake = topLakeEntry
      ? { name: topLakeEntry[0], count: topLakeEntry[1] }
      : null;

    const bestMonth = bestMonthEntry
      ? {
          label: new Date(`${bestMonthEntry[0]}-01T00:00:00`).toLocaleDateString(
            undefined,
            {
              month: "long",
              year: "numeric",
            },
          ),
          count: bestMonthEntry[1],
        }
      : null;

    const speciesBreakdown = sortMapEntries(speciesMap.entries())
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCatches ? Math.round((count / totalCatches) * 100) : 0,
      }));

    const lakeBreakdown = sortMapEntries(lakeMap.entries())
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCatches ? Math.round((count / totalCatches) * 100) : 0,
      }));

    const recentSorted = [...safeLogs].sort((a, b) => {
      const aTime = getCatchTimestamp(a) || 0;
      const bTime = getCatchTimestamp(b) || 0;
      return bTime - aTime;
    });

    return {
      totalCatches,
      uniqueLakes,
      totalWeight,
      avgWeight,
      biggestCatch,
      topSpecies,
      topLake,
      bestMonth,
      speciesBreakdown,
      lakeBreakdown,
      recentSorted,
    };
  }, [filteredCatches]);

  const recentPreview = dashboardStats.recentSorted.slice(0, 6);

  const countText = loading
    ? "Loading…"
    : `Showing ${filteredCatches.length} of ${(catches || []).length} catches`;

  const goToLakeOnMap = (waterBodyId) => {
    if (
      waterBodyId === null ||
      waterBodyId === undefined ||
      waterBodyId === ""
    ) {
      return;
    }

    navigate("/", { state: { lakeId: String(waterBodyId) } });
  };

  const clearFilters = () => {
    setSelectedLakeId("ALL");
    setSelectedSpecies("ALL");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
  };

  const goToCatchesPage = () => {
    navigate("/catches");
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
            color: "white",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "18px",
            boxShadow: "0 18px 40px rgba(15,23,42,0.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <FaChartBar />
            <div style={{ fontSize: "14px", fontWeight: 700, opacity: 0.95 }}>
              Fishing analytics
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "18px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 520px" }}>
              <h1 style={{ margin: "0 0 10px 0", fontSize: "30px" }}>
                Fishing Dashboard
              </h1>

              <div
                style={{
                  fontSize: "15px",
                  opacity: 0.96,
                  maxWidth: "760px",
                  lineHeight: 1.7,
                }}
              >
                This page focuses on insights, performance patterns, and
                personal fishing statistics based on your catch history. Use it
                to understand what species, lakes, and periods perform best for
                you.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: "999px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {(catches || []).length} total logged catches
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: "999px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {filteredCatches.length} catches in current analysis
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={goToCatchesPage}
              style={{
                border: "none",
                background: "white",
                color: "#0f172a",
                borderRadius: "12px",
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Open Fishing Log
              <FaArrowRight />
            </button>
          </div>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "18px",
            boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
          }}
        >
          <DashboardFilters
            loading={loading}
            catches={catches}
            selectedLakeId={selectedLakeId}
            setSelectedLakeId={setSelectedLakeId}
            selectedSpecies={selectedSpecies}
            setSelectedSpecies={setSelectedSpecies}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onClear={clearFilters}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <StatCard
            icon={<FaFish />}
            label="Filtered catches"
            value={dashboardStats.totalCatches}
            subvalue={countText}
          />
          <StatCard
            icon={<FaWeightHanging />}
            label="Average weight"
            value={`${formatNumber(dashboardStats.avgWeight)} kg`}
            subvalue={`Total weight: ${formatNumber(
              dashboardStats.totalWeight,
            )} kg`}
          />
          <StatCard
            icon={<FaMapMarkedAlt />}
            label="Best lake"
            value={dashboardStats.topLake ? dashboardStats.topLake.name : "No data"}
            subvalue={
              dashboardStats.topLake
                ? `${dashboardStats.topLake.count} catches`
                : "No filtered catches yet"
            }
          />
          <StatCard
            icon={<FaTrophy />}
            label="Top species"
            value={
              dashboardStats.topSpecies
                ? dashboardStats.topSpecies.name
                : "No data"
            }
            subvalue={
              dashboardStats.topSpecies
                ? `${dashboardStats.topSpecies.count} catches`
                : "No filtered catches yet"
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <InsightCard title="Personal Records">
            {!dashboardStats.biggestCatch ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                No record data yet for the current filters.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "14px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#1d4ed8",
                      marginBottom: "6px",
                    }}
                  >
                    Biggest catch
                  </div>

                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {formatNumber(
                      Number(dashboardStats.biggestCatch.weight_kg || 0),
                    )}{" "}
                    kg {dashboardStats.biggestCatch.species || "Unknown"}
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      color: "#475569",
                      marginTop: "6px",
                    }}
                  >
                    {dashboardStats.biggestCatch.lake_name || "Unknown lake"} •{" "}
                    {formatDateLabel(
                      dashboardStats.biggestCatch.catch_time ||
                        dashboardStats.biggestCatch.created_at,
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Unique lakes
                    </div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {dashboardStats.uniqueLakes}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#64748b",
                        marginBottom: "4px",
                      }}
                    >
                      Best month
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {dashboardStats.bestMonth
                        ? dashboardStats.bestMonth.label
                        : "No data"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "4px",
                      }}
                    >
                      {dashboardStats.bestMonth
                        ? `${dashboardStats.bestMonth.count} catches`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </InsightCard>

          <InsightCard title="Top Species Breakdown">
            {!dashboardStats.speciesBreakdown.length ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                No species data found for the current filters.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {dashboardStats.speciesBreakdown.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569" }}>
                        {item.count} catches
                      </div>
                    </div>

                    <div
                      style={{
                        height: "8px",
                        background: "#e2e8f0",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(item.percent, 4)}%`,
                          height: "100%",
                          background: "#2563eb",
                          borderRadius: "999px",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "6px",
                      }}
                    >
                      {item.percent}% of filtered catches
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Top Lakes Breakdown">
            {!dashboardStats.lakeBreakdown.length ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                No lake data found for the current filters.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {dashboardStats.lakeBreakdown.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569" }}>
                        {item.count} catches
                      </div>
                    </div>

                    <div
                      style={{
                        height: "8px",
                        background: "#e2e8f0",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(item.percent, 4)}%`,
                          height: "100%",
                          background: "#0ea5e9",
                          borderRadius: "999px",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "6px",
                      }}
                    >
                      {item.percent}% of filtered catches
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InsightCard>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <DashboardCharts
            logs={filteredCatches}
            loading={loading}
            showCharts={showCharts}
            setShowCharts={setShowCharts}
            showChartSpecies={showChartSpecies}
            setShowChartSpecies={setShowChartSpecies}
            showChartLakes={showChartLakes}
            setShowChartLakes={setShowChartLakes}
            showChartTrend={showChartTrend}
            setShowChartTrend={setShowChartTrend}
            showChartAvgWeight={showChartAvgWeight}
            setShowChartAvgWeight={setShowChartAvgWeight}
            countText={countText}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#0f172a",
            }}
          >
            <FaStream />
            Recent Filtered Catch Logs
          </h2>

          <button
            type="button"
            onClick={goToCatchesPage}
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              color: "#0f172a",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            View Full Logbook
          </button>
        </div>

        {error && (
          <div
            style={{
              color: "#721c24",
              background: "#f8d7da",
              border: "1px solid #f5c6cb",
              padding: "10px 12px",
              borderRadius: "10px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "13px" }}>{String(error)}</div>
            <button
              type="button"
              onClick={reload}
              style={{
                marginLeft: "auto",
                background: "#343a40",
                color: "white",
                border: "none",
                padding: "8px 10px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {showSkeleton ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} i={i} />
            ))}
          </ul>
        ) : (
          <CatchLogList
            logs={recentPreview}
            loading={loading}
            hasAnyCatches={hasAnyCatches}
            onLakeClick={goToLakeOnMap}
          />
        )}
      </div>
    </div>
  );
}