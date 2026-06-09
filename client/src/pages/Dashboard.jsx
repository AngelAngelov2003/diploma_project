import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartBar,
  FaArrowRight,
  FaFish,
  FaMapMarkedAlt,
  FaWeightHanging,
  FaTrophy,
  FaStream
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useMyCatches from "../hooks/useMyCatches";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import CatchLogList from "../components/dashboard/CatchLogList";
import Pagination from "../components/ui/Pagination";
import { deleteMyCatch, updateMyCatch } from "../api/myCatchesApi";
import { notifyError, notifySuccess } from "../ui/toast";



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
      padding: "clamp(12px, 3vw, 18px)",
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
      <div style={{ fontSize: "clamp(15px, 4vw, 18px)" }}>{icon}</div>
      <div
        style={{
          fontSize: "clamp(11px, 3vw, 13px)",
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
        fontSize: "clamp(22px, 7vw, 28px)",
        fontWeight: 800,
        color: "#0f172a",
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>

    {subvalue ? (
      <div style={{ marginTop: "6px", fontSize: "clamp(12px, 3vw, 13px)", color: "#64748b" }}>
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
      borderRadius: "14px",
      padding: "clamp(10px, 2.5vw, 14px)",
      boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
    }}
  >
    <h3 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "clamp(15px, 3.5vw, 17px)" }}>
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
    return "Неизвестно";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Неизвестно";
  }

  return date.toLocaleDateString("bg-BG");
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
  const [savingCatchId, setSavingCatchId] = useState("");

  const [selectedLakeId, setSelectedLakeId] = useState("ALL");
  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [speciesPage, setSpeciesPage] = useState(1);
  const [lakePage, setLakePage] = useState(1);

  const [showCharts, setShowCharts] = useState(true);
  const [showChartSpecies, setShowChartSpecies] = useState(true);
  const [showChartLakes, setShowChartLakes] = useState(true);
  const [showChartTrend, setShowChartTrend] = useState(true);
  const [showChartAvgWeight, setShowChartAvgWeight] = useState(true);

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  useEffect(() => {
    setSpeciesPage(1);
    setLakePage(1);
  }, [selectedLakeId, selectedSpecies, dateFrom, dateTo, searchTerm]);

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
      const species = String(catchItem.species || "Неизвестно").trim() || "Неизвестно";
      const lake =
        String(catchItem.lake_name || "Неизвестен водоем").trim() || "Неизвестен водоем";

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
            "bg-BG",
            {
              month: "long",
              year: "numeric",
            },
          ),
          count: bestMonthEntry[1],
        }
      : null;

    const speciesBreakdown = sortMapEntries(speciesMap.entries())
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
  const speciesPageSize = 2;
  const speciesPageCount = Math.max(
    1,
    Math.ceil(dashboardStats.speciesBreakdown.length / speciesPageSize),
  );
  const safeSpeciesPage = Math.min(speciesPage, speciesPageCount);
  const speciesStartIndex = (safeSpeciesPage - 1) * speciesPageSize;
  const speciesEndIndex = Math.min(speciesStartIndex + speciesPageSize, dashboardStats.speciesBreakdown.length);
  const pagedSpeciesBreakdown = dashboardStats.speciesBreakdown.slice(
    speciesStartIndex,
    speciesEndIndex,
  );

  const lakePageSize = 2;
  const lakePageCount = Math.max(
    1,
    Math.ceil(dashboardStats.lakeBreakdown.length / lakePageSize),
  );
  const safeLakePage = Math.min(lakePage, lakePageCount);
  const lakeStartIndex = (safeLakePage - 1) * lakePageSize;
  const lakeEndIndex = Math.min(lakeStartIndex + lakePageSize, dashboardStats.lakeBreakdown.length);
  const pagedLakeBreakdown = dashboardStats.lakeBreakdown.slice(
    lakeStartIndex,
    lakeEndIndex,
  );

  const countText = loading
    ? "Зареждане…"
    : `Показани ${filteredCatches.length} от ${(catches || []).length} улова`;

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

  const handleUpdateCatch = async (catchId, payload) => {
    try {
      setSavingCatchId(catchId);
      const updatedCatch = await updateMyCatch(catchId, payload);
      notifySuccess("Записът за улов е обновен");
      await reload();
      return updatedCatch;
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на записа");
    } finally {
      setSavingCatchId("");
    }
  };

  const handleDeleteCatch = async (catchId) => {
    if (!window.confirm("Да се изтрие ли този запис за улов?")) return;
    try {
      setSavingCatchId(catchId);
      await deleteMyCatch(catchId);
      notifySuccess("Записът е изтрит");
      await reload();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на записа");
    } finally {
      setSavingCatchId("");
    }
  };

  const goToCatchesPage = () => {
    navigate("/catches");
  };

  return (
    <div
      style={{
        padding: isMobile ? "12px" : "20px",
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
            color: "white",
            borderRadius: isMobile ? "18px" : "20px",
            padding: isMobile ? "18px" : "24px",
            marginBottom: "18px",
            boxShadow: "0 18px 40px rgba(15,23,42,0.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: isMobile ? "14px" : "18px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
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
                  Риболовна статистика
                </div>
              </div>

              <h1 style={{ margin: 0, fontSize: isMobile ? "24px" : "30px", lineHeight: 1.15 }}>
                Риболовен контролен панел
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                justifyContent: isMobile ? "flex-start" : "flex-end",
                flex: "0 1 520px",
                marginLeft: "auto",
              }}
            >
              <button
                type="button"
                onClick={goToCatchesPage}
                style={{
                  border: "none",
                  background: "white",
                  color: "#0f172a",
                  borderRadius: "14px",
                  padding: isMobile ? "10px 13px" : "12px 16px",
                  cursor: "pointer",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Отвори риболовния дневник
                <FaArrowRight />
              </button>
            </div>
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
            gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(220px, 1fr))",
            gap: isMobile ? "10px" : "14px",
            marginBottom: "18px",
          }}
        >
          <StatCard
            icon={<FaFish />}
            label="Филтрирани улови"
            value={dashboardStats.totalCatches}
            subvalue={countText}
          />
          <StatCard
            icon={<FaWeightHanging />}
            label="Средно тегло"
            value={`${formatNumber(dashboardStats.avgWeight)} кг`}
            subvalue={`Общо тегло: ${formatNumber(
              dashboardStats.totalWeight,
            )} кг`}
          />
          <StatCard
            icon={<FaMapMarkedAlt />}
            label="Най-добър водоем"
            value={dashboardStats.topLake ? dashboardStats.topLake.name : "Няма данни"}
            subvalue={
              dashboardStats.topLake
                ? `${dashboardStats.topLake.count} улова`
                : "Все още няма филтрирани улови"
            }
          />
          <StatCard
            icon={<FaTrophy />}
            label="Топ видове"
            value={
              dashboardStats.topSpecies
                ? dashboardStats.topSpecies.name
                : "Няма данни"
            }
            subvalue={
              dashboardStats.topSpecies
                ? `${dashboardStats.topSpecies.count} улова`
                : "Все още няма филтрирани улови"
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
            gap: isMobile ? "10px" : "14px",
            marginBottom: "18px",
          }}
        >
          <InsightCard title="Лични рекорди">
            {!dashboardStats.biggestCatch ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                Все още няма рекордни данни за текущите филтри.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "12px",
                    padding: isMobile ? "9px" : "11px",
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
                    Най-голям улов
                  </div>

                  <div
                    style={{
                      fontSize: isMobile ? "19px" : "22px",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {formatNumber(
                      Number(dashboardStats.biggestCatch.weight_kg || 0),
                    )}{" "}
                    кг {dashboardStats.biggestCatch.species || "Неизвестно"}
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      color: "#475569",
                      marginTop: "6px",
                    }}
                  >
                    {dashboardStats.biggestCatch.lake_name || "Неизвестен водоем"} •{" "}
                    {formatDateLabel(
                      dashboardStats.biggestCatch.catch_time ||
                        dashboardStats.biggestCatch.created_at,
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "11px",
                      padding: isMobile ? "8px" : "10px",
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
                      Водоеми с улов
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? "19px" : "22px",
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
                      borderRadius: "11px",
                      padding: isMobile ? "8px" : "10px",
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
                      Най-добър месец
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? "15px" : "16px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {dashboardStats.bestMonth
                        ? dashboardStats.bestMonth.label
                        : "Няма данни"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "4px",
                      }}
                    >
                      {dashboardStats.bestMonth
                        ? `${dashboardStats.bestMonth.count} улова`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </InsightCard>

          <InsightCard title="Разбивка по вид риба">
            {!dashboardStats.speciesBreakdown.length ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                Няма данни за видове риба за текущите филтри.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {pagedSpeciesBreakdown.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "11px",
                      padding: isMobile ? "8px" : "10px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "6px",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569" }}>
                        {item.count} улова
                      </div>
                    </div>

                    <div
                      style={{
                        height: "6px",
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
                        marginTop: "5px",
                      }}
                    >
                      {item.percent}% от филтрираните улови
                    </div>
                  </div>
                ))}

                {dashboardStats.speciesBreakdown.length > speciesPageSize ? (
                  <Pagination
                    currentPage={safeSpeciesPage}
                    totalPages={speciesPageCount}
                    totalItems={dashboardStats.speciesBreakdown.length}
                    startIndex={speciesStartIndex}
                    endIndex={speciesEndIndex}
                    onPageChange={setSpeciesPage}
                  />
                ) : null}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Разбивка по водоеми">
            {!dashboardStats.lakeBreakdown.length ? (
              <div style={{ color: "#64748b", fontSize: "14px" }}>
                Няма данни за водоеми за текущите филтри.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {pagedLakeBreakdown.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "11px",
                      padding: isMobile ? "8px" : "10px",
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
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569" }}>
                        {item.count} улова
                      </div>
                    </div>

                    <div
                      style={{
                        height: "6px",
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
                        marginTop: "5px",
                      }}
                    >
                      {item.percent}% от филтрираните улови
                    </div>
                  </div>
                ))}

                {dashboardStats.lakeBreakdown.length > lakePageSize ? (
                  <Pagination
                    currentPage={safeLakePage}
                    totalPages={lakePageCount}
                    totalItems={dashboardStats.lakeBreakdown.length}
                    startIndex={lakeStartIndex}
                    endIndex={lakeEndIndex}
                    onPageChange={setLakePage}
                  />
                ) : null}
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
              fontSize: isMobile ? "22px" : "26px",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "8px" : "10px",
              color: "#0f172a",
            }}
          >
            <FaStream />
            Последни филтрирани улови
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
            Виж целия дневник
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
              marginBottom: "clamp(6px, 2vw, 10px)",
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
              Опитай отново
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
            onUpdate={handleUpdateCatch}
            onDelete={handleDeleteCatch}
            savingId={savingCatchId}
          />
        )}
      </div>
    </div>
  );
}