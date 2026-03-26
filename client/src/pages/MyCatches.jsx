import React, { useEffect, useMemo, useState } from "react";
import { FaDownload, FaFish, FaList, FaRedoAlt, FaSortAmountDown, FaTable, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useMyCatches from "../hooks/useMyCatches";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import CatchLogList from "../components/dashboard/CatchLogList";

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
      <div style={{ height: "16px", width: "55%", background: "#e9ecef", borderRadius: "6px" }} />
      <div style={{ height: "12px", width: "35%", background: "#e9ecef", borderRadius: "6px", marginTop: "10px" }} />
      <div style={{ height: "12px", width: "45%", background: "#e9ecef", borderRadius: "6px", marginTop: "12px" }} />
      <div style={{ height: "12px", width: "30%", background: "#e9ecef", borderRadius: "6px", marginTop: "10px" }} />
    </div>
  </li>
);

const escapeCsv = (value) => {
  const v = String(value ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

const formatDateForExport = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
};

const StatPill = ({ value, label }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.16)",
      borderRadius: "999px",
      padding: "8px 12px",
      fontSize: "13px",
      fontWeight: 700,
    }}
  >
    {value} {label}
  </div>
);

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "weight_desc", label: "Heaviest first" },
  { value: "weight_asc", label: "Lightest first" },
  { value: "species_asc", label: "Species A-Z" },
  { value: "lake_asc", label: "Lake A-Z" },
];

export default function MyCatches() {
  const { catches, loading, error, reload } = useMyCatches();

  const [selectedLakeId, setSelectedLakeId] = useState("ALL");
  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    let timer;

    if (loading) {
      timer = setTimeout(() => {
        setShowSkeleton(true);
      }, 200);
    } else {
      setShowSkeleton(false);
    }

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    setPage(1);
  }, [selectedLakeId, selectedSpecies, dateFrom, dateTo, searchTerm, sortBy, pageSize]);

  const hasAnyCatches = (catches || []).length > 0;

  const filteredCatches = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() : null;
    const q = searchTerm.trim().toLowerCase();

    return (catches || []).filter((c) => {
      if (selectedLakeId !== "ALL" && String(c.water_body_id) !== String(selectedLakeId)) return false;
      if (selectedSpecies !== "ALL" && c.species !== selectedSpecies) return false;

      const when = c.catch_time || c.created_at;
      const t = when ? new Date(when).getTime() : null;
      if (t == null || Number.isNaN(t)) return false;

      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t > toMs + 24 * 60 * 60 * 1000 - 1) return false;

      if (q) {
        const haystack = [
          c.species,
          c.lake_name,
          c.notes,
          c.weight_kg,
          c.temperature,
          c.pressure,
          c.wind_speed,
          c.moon_phase,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [catches, selectedLakeId, selectedSpecies, dateFrom, dateTo, searchTerm]);

  const sortedCatches = useMemo(() => {
    const list = [...filteredCatches];

    list.sort((a, b) => {
      const aTime = new Date(a.catch_time || a.created_at || 0).getTime();
      const bTime = new Date(b.catch_time || b.created_at || 0).getTime();
      const aWeight = Number(a.weight_kg || 0);
      const bWeight = Number(b.weight_kg || 0);
      const aSpecies = String(a.species || "").localeCompare(String(b.species || ""));
      const aLake = String(a.lake_name || "").localeCompare(String(b.lake_name || ""));

      switch (sortBy) {
        case "oldest":
          return aTime - bTime;
        case "weight_desc":
          return bWeight - aWeight || bTime - aTime;
        case "weight_asc":
          return aWeight - bWeight || bTime - aTime;
        case "species_asc":
          return aSpecies || bTime - aTime;
        case "lake_asc":
          return aLake || bTime - aTime;
        case "newest":
        default:
          return bTime - aTime;
      }
    });

    return list;
  }, [filteredCatches, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedCatches.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCatches = sortedCatches.slice(startIndex, startIndex + pageSize);

  const countText = loading
    ? "Loading…"
    : `Showing ${paginatedCatches.length ? startIndex + 1 : 0}-${Math.min(startIndex + paginatedCatches.length, sortedCatches.length)} of ${sortedCatches.length} filtered catches`;

  const goToLakeOnMap = (waterBodyId) => {
    if (waterBodyId === null || waterBodyId === undefined || waterBodyId === "") return;
    navigate("/", { state: { lakeId: String(waterBodyId) } });
  };

  const clearFilters = () => {
    setSelectedLakeId("ALL");
    setSelectedSpecies("ALL");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setSortBy("newest");
  };

  const exportCsv = () => {
    if (!sortedCatches.length) return;

    const headers = [
      "Lake",
      "Species",
      "Weight (kg)",
      "Catch Time",
      "Created At",
      "Temperature",
      "Pressure",
      "Wind Speed",
      "Humidity",
      "Moon Phase",
      "Notes",
      "Image URL",
    ];

    const rows = sortedCatches.map((c) => [
      c.lake_name || "",
      c.species || "",
      c.weight_kg ?? "",
      formatDateForExport(c.catch_time),
      formatDateForExport(c.created_at),
      c.temperature ?? "",
      c.pressure ?? "",
      c.wind_speed ?? "",
      c.humidity ?? "",
      c.moon_phase ?? "",
      c.notes || "",
      c.image_url ? `http://localhost:5000/uploads/${c.image_url}` : "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    a.href = url;
    a.download = `my-catches-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const catchesWithPhotos = sortedCatches.filter((c) => c.image_url).length;
  const catchesWithNotes = sortedCatches.filter((c) => String(c.notes || "").trim()).length;

  return (
    <div style={{ padding: "20px", background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0d6efd 0%, #0aa2ff 100%)",
            color: "white",
            borderRadius: "18px",
            padding: "22px",
            marginBottom: "18px",
            boxShadow: "0 12px 28px rgba(13,110,253,0.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <FaList />
            <div style={{ fontSize: "14px", fontWeight: 700, opacity: 0.95 }}>Catch records</div>
          </div>

          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>My Catches</h1>

          <div style={{ fontSize: "14px", opacity: 0.95, maxWidth: "760px", lineHeight: 1.6 }}>
            This page is your fishing logbook. Use it to browse, filter, sort, review, and export your catch history in a clean, organized way.
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            <StatPill value={(catches || []).length} label="total catches" />
            <StatPill value={sortedCatches.length} label="filtered results" />
            <StatPill value={catchesWithPhotos} label="with photos" />
            <StatPill value={catchesWithNotes} label="with notes" />
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
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "18px",
            boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px", color: "#0f172a" }}>
              <FaFish />
              Catch Log Manager
            </h2>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                style={{
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#334155",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FaRedoAlt />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={!sortedCatches.length}
                style={{
                  border: "none",
                  background: sortedCatches.length ? "#111827" : "#9ca3af",
                  color: "white",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  cursor: sortedCatches.length ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FaDownload />
                Export CSV
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Sort by</div>
              <div style={{ position: "relative" }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    fontSize: "14px",
                    background: "white",
                    color: "#0f172a",
                    outline: "none",
                  }}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>Rows per page</div>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  background: "white",
                  color: "#0f172a",
                  outline: "none",
                }}
              >
                {[6, 8, 10, 12, 20].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <FaSortAmountDown style={{ color: "#2563eb" }} />
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Current sort</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  {sortOptions.find((option) => option.value === sortBy)?.label || "Newest first"}
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <FaTable style={{ color: "#2563eb" }} />
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Page</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  {currentPage} of {totalPages}
                </div>
              </div>
            </div>
          </div>

          <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>{countText}</div>

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
              logs={paginatedCatches}
              loading={loading}
              hasAnyCatches={hasAnyCatches}
              onLakeClick={goToLakeOnMap}
            />
          )}

          {!showSkeleton && sortedCatches.length > 0 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                Page {currentPage} of {totalPages}
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    border: "1px solid #d1d5db",
                    background: currentPage <= 1 ? "#f1f5f9" : "white",
                    color: currentPage <= 1 ? "#94a3b8" : "#0f172a",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaChevronLeft />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    border: "1px solid #d1d5db",
                    background: currentPage >= totalPages ? "#f1f5f9" : "white",
                    color: currentPage >= totalPages ? "#94a3b8" : "#0f172a",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  Next
                  <FaChevronRight />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}