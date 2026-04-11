import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/ui/Pagination";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaHeart,
  FaMapMarkedAlt,
  FaRedoAlt,
  FaSearch,
  FaSlidersH,
  FaStar,
} from "react-icons/fa";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  createAlert,
  createFavorite,
  deleteAlert,
  deleteFavorite,
  getMyAlerts,
  getMyFavorites,
  updateAlert,
} from "../api/alertsApi";

const pageShellStyle = {
  padding: 20,
  background: "#f8fafc",
  minHeight: "calc(100vh - 60px)",
};

const sectionCardStyle = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
};

const actionButtonStyle = {
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const clampScore = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const mergeItemsByLakeId = (alerts, favorites) => {
  const merged = new Map();

  (favorites || []).forEach((item) => {
    merged.set(String(item.water_body_id), {
      ...item,
      source: item.is_active ? "favorite+alert" : "favorite",
    });
  });

  (alerts || []).forEach((item) => {
    const key = String(item.water_body_id);
    const existingItem = merged.get(key) || {};
    merged.set(key, {
      ...existingItem,
      ...item,
      source: existingItem.is_favorite ? "favorite+alert" : "alert",
    });
  });

  return Array.from(merged.values()).sort((a, b) =>
    String(a.lake_name || "").localeCompare(String(b.lake_name || ""), "bg"),
  );
};

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      ...actionButtonStyle,
      background: active ? "#2563eb" : "#e2e8f0",
      color: active ? "white" : "#1e293b",
      minWidth: 0,
      flex: "1 1 140px",
    }}
  >
    {children}
  </button>
);

const StatCard = ({ icon, label, value, note }) => (
  <div style={{ ...sectionCardStyle, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", fontSize: 13, fontWeight: 700 }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{value}</div>
    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{note}</div>
  </div>
);


const PAGE_SIZE = 6;

const paginateItems = (items, currentPage, pageSize = PAGE_SIZE) => {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage: safePage,
    startIndex,
    endIndex: Math.min(endIndex, totalItems),
  };
};

const getSavedStateLabel = (item) => {
  if (item.is_favorite && item.is_active) return "Favorite + Alert";
  if (item.is_favorite) return "Favorite only";
  if (item.is_active) return "Alert only";
  return "Saved";
};

export default function SavedLakesPage({ initialTab = "all" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [alerts, setAlerts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadSavedLakes = useCallback(async () => {
    try {
      setLoading(true);
      const [alertData, favoriteData] = await Promise.all([getMyAlerts(), getMyFavorites()]);
      setAlerts((alertData || []).filter((item) => Boolean(item.is_active)));
      setFavorites((favoriteData || []).filter((item) => Boolean(item.is_favorite)));
    } catch (error) {
      notifyError(error, "Failed to load your saved lakes");
      setAlerts([]);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedLakes();
  }, [loadSavedLakes]);

  const savedLakeItems = useMemo(() => mergeItemsByLakeId(alerts, favorites), [alerts, favorites]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return savedLakeItems.filter((item) => {
      const tabMatch =
        activeTab === "favorites"
          ? item.is_favorite
          : activeTab === "alerts"
            ? item.is_active
            : activeTab === "both"
              ? item.is_favorite && item.is_active
              : true;
      const queryMatch = !query || String(item.lake_name || "").toLowerCase().includes(query);
      return tabMatch && queryMatch;
    });
  }, [activeTab, savedLakeItems, search]);

  const paginatedItems = useMemo(() => paginateItems(visibleItems, currentPage), [currentPage, visibleItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  useEffect(() => {
    if (currentPage > paginatedItems.totalPages) {
      setCurrentPage(paginatedItems.totalPages);
    }
  }, [currentPage, paginatedItems.totalPages]);

  const stats = useMemo(() => {
    const favoriteCount = savedLakeItems.filter((item) => item.is_favorite).length;
    const alertCount = savedLakeItems.filter((item) => item.is_active).length;
    const overlapCount = savedLakeItems.filter((item) => item.is_active && item.is_favorite).length;

    return {
      favoriteCount,
      alertCount,
      overlapCount,
      dashboardCount: savedLakeItems.length,
    };
  }, [savedLakeItems]);

  const patchAlertItem = async (waterBodyId, payload, successMessage) => {
    try {
      setSavingId(waterBodyId);
      const updatedItem = await updateAlert(waterBodyId, payload);
      setAlerts((prev) =>
        prev.map((item) =>
          item.water_body_id === waterBodyId
            ? { ...item, ...(updatedItem || {}), lake_name: item.lake_name }
            : item,
        ),
      );
      if (successMessage) notifySuccess(successMessage);
    } catch (error) {
      notifyError(error, "Failed to update alert settings");
    } finally {
      setSavingId("");
    }
  };

  const enableAlert = async (item) => {
    try {
      setSavingId(item.water_body_id);
      const createdItem = await createAlert({
        water_body_id: item.water_body_id,
        is_favorite: Boolean(item.is_favorite),
        notification_frequency: item.notification_frequency || "daily",
        min_score: Number(item.min_score || 0),
      });
      setAlerts((prev) => {
        const existingIndex = prev.findIndex((currentItem) => currentItem.water_body_id === item.water_body_id);
        const mergedItem = { ...item, ...(createdItem || {}) };
        if (existingIndex >= 0) {
          return prev.map((currentItem) =>
            currentItem.water_body_id === item.water_body_id ? mergedItem : currentItem,
          );
        }
        return [...prev, mergedItem];
      });
      notifySuccess("Alert enabled");
    } catch (error) {
      notifyError(error, "Failed to enable alert");
    } finally {
      setSavingId("");
    }
  };

  const disableAlert = async (item) => {
    try {
      setSavingId(item.water_body_id);
      await deleteAlert(item.water_body_id);
      setAlerts((prev) => prev.filter((currentItem) => currentItem.water_body_id !== item.water_body_id));
      notifySuccess("Alert disabled");
    } catch (error) {
      notifyError(error, "Failed to disable alert");
    } finally {
      setSavingId("");
    }
  };

  const addFavorite = async (item) => {
    try {
      setSavingId(item.water_body_id);
      const created = await createFavorite(item.water_body_id);
      const favoriteItem = { ...item, ...(created || {}), is_favorite: true };
      setFavorites((prev) => {
        if (prev.some((currentItem) => currentItem.water_body_id === item.water_body_id)) {
          return prev.map((currentItem) =>
            currentItem.water_body_id === item.water_body_id ? favoriteItem : currentItem,
          );
        }
        return [...prev, favoriteItem];
      });
      setAlerts((prev) => prev.map((currentItem) => currentItem.water_body_id === item.water_body_id ? { ...currentItem, is_favorite: true } : currentItem));
      notifySuccess("Added to favorites");
    } catch (error) {
      notifyError(error, "Failed to add favorite");
    } finally {
      setSavingId("");
    }
  };

  const removeFavorite = async (item) => {
    try {
      setSavingId(item.water_body_id);
      await deleteFavorite(item.water_body_id);
      setFavorites((prev) => prev.filter((currentItem) => currentItem.water_body_id !== item.water_body_id));
      setAlerts((prev) =>
        prev.map((currentItem) =>
          currentItem.water_body_id === item.water_body_id
            ? { ...currentItem, is_favorite: false }
            : currentItem,
        ),
      );
      notifySuccess("Removed from favorites");
    } catch (error) {
      notifyError(error, "Failed to remove favorite");
    } finally {
      setSavingId("");
    }
  };

  const goToMap = (waterBodyId) => navigate("/", { state: { lakeId: waterBodyId } });
  const goToDetails = (waterBodyId) => navigate(`/lakes/${waterBodyId}`);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading saved lakes…</div>;
  }

  return (
    <div style={pageShellStyle}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #2563eb 62%, #0ea5e9 100%)",
            color: "white",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)",
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.85 }}>
            Saved lakes dashboard
          </div>
          <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Saved Lakes</h1>
          <div style={{ maxWidth: 760, lineHeight: 1.6, opacity: 0.95 }}>
            Manage favorites and alert subscriptions in one place. Public routes stay clean while favorites and alerts remain separate under the hood.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
          <StatCard icon={<FaStar />} label="All saved lakes" value={stats.dashboardCount} note="Lakes with a favorite, an alert, or both" />
          <StatCard icon={<FaHeart />} label="Favorites" value={stats.favoriteCount} note="Saved for quick access" />
          <StatCard icon={<FaBell />} label="Alerts" value={stats.alertCount} note="Active forecast notifications" />
          <StatCard icon={<FaSlidersH />} label="Both states" value={stats.overlapCount} note="Favorite and alert enabled together" />
        </div>

        <div style={{ ...sectionCardStyle, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.4fr) minmax(280px, 1fr)", gap: 16, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, color: "#334155", marginBottom: 10 }}>
                <FaSearch />
                <span>Search saved lakes</span>
              </div>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by lake name..."
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 14, padding: "14px 16px", fontSize: 16 }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: "#334155", marginBottom: 10 }}>Quick filters</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
                <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>All Saved</TabButton>
                <TabButton active={activeTab === "favorites"} onClick={() => setActiveTab("favorites")}>Favorites</TabButton>
                <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")}>Alerts</TabButton>
                <TabButton active={activeTab === "both"} onClick={() => setActiveTab("both")}>Both</TabButton>
                <button type="button" onClick={loadSavedLakes} style={{ ...actionButtonStyle, background: "#eff6ff", color: "#1d4ed8", flex: "1 1 120px" }}>
                  <FaRedoAlt style={{ marginRight: 8 }} /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {!visibleItems.length ? (
          <div style={{ ...sectionCardStyle, padding: 22, color: "#64748b" }}>
            No saved lakes match the current search and filter.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {paginatedItems.items.map((item) => {
              const isBusy = savingId === item.water_body_id;
              return (
                <div key={item.water_body_id} style={{ ...sectionCardStyle, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>{item.lake_name}</h3>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                        <span style={{ background: item.is_active ? "#dcfce7" : "#e5e7eb", color: item.is_active ? "#166534" : "#334155", borderRadius: 999, padding: "8px 12px", fontWeight: 800 }}> {item.is_active ? "Alert On" : "Alerts Off"} </span>
                        <span style={{ background: item.is_favorite ? "#fef3c7" : "#e5e7eb", color: item.is_favorite ? "#92400e" : "#334155", borderRadius: 999, padding: "8px 12px", fontWeight: 800 }}> {item.is_favorite ? "Favorite" : "Not Favorite"} </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => goToMap(item.water_body_id)} style={{ ...actionButtonStyle, background: "#eff6ff", color: "#1d4ed8" }}>
                        <FaMapMarkedAlt style={{ marginRight: 8 }} />View on Map
                      </button>
                      <button type="button" onClick={() => goToDetails(item.water_body_id)} style={{ ...actionButtonStyle, background: "#0f172a", color: "white" }}>
                        Details
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 20 }}>
                    <div>
                      <div style={{ color: "#475569", fontWeight: 700, marginBottom: 8 }}>Notification frequency</div>
                      <select value={item.notification_frequency || "daily"} disabled={!item.is_active || isBusy} onChange={(event) => patchAlertItem(item.water_body_id, { notification_frequency: event.target.value }, "Frequency updated")} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: item.is_active ? "white" : "#f1f5f9" }}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ color: "#475569", fontWeight: 700, marginBottom: 8 }}>Minimum score</div>
                      <input type="number" min="0" max="100" value={item.min_score ?? 0} disabled={!item.is_active || isBusy} onChange={(event) => patchAlertItem(item.water_body_id, { min_score: clampScore(event.target.value) }, "Minimum score updated")} style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: item.is_active ? "white" : "#f1f5f9" }} />
                    </div>

                    <div>
                      <div style={{ color: "#475569", fontWeight: 700, marginBottom: 8 }}>Quick actions</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {item.is_active ? (
                          <button type="button" disabled={isBusy} onClick={() => disableAlert(item)} style={{ ...actionButtonStyle, background: "#0f172a", color: "white", width: "100%" }}>Disable Alert</button>
                        ) : (
                          <button type="button" disabled={isBusy} onClick={() => enableAlert(item)} style={{ ...actionButtonStyle, background: "#16a34a", color: "white", width: "100%" }}>Enable Alert</button>
                        )}
                        {item.is_favorite ? (
                          <button type="button" disabled={isBusy} onClick={() => removeFavorite(item)} style={{ ...actionButtonStyle, background: "#f59e0b", color: "white", width: "100%" }}>Remove Favorite</button>
                        ) : (
                          <button type="button" disabled={isBusy} onClick={() => addFavorite(item)} style={{ ...actionButtonStyle, background: "#2563eb", color: "white", width: "100%" }}>Mark Favorite</button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "#475569", fontWeight: 700, marginBottom: 8 }}>Saved state</div>
                      <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "14px 16px", fontWeight: 800, color: "#334155" }}>{getSavedStateLabel(item)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleItems.length ? (
          <div style={{ marginTop: 18 }}>
            <Pagination
              currentPage={paginatedItems.currentPage}
              totalPages={paginatedItems.totalPages}
              totalItems={paginatedItems.totalItems}
              startIndex={paginatedItems.startIndex}
              endIndex={paginatedItems.endIndex}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
