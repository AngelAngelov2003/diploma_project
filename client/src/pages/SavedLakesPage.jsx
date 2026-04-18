import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/ui/Pagination";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaChartLine,
  FaHeart,
  FaMapMarkedAlt,
  FaRedoAlt,
  FaSearch,
  FaSlidersH,
  FaStar,
  FaTag,
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
import styles from "./SavedLakesPage.module.css";

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

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[styles.filterButton, active ? styles.filterButtonActive : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

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
      const [alertData, favoriteData] = await Promise.all([
        getMyAlerts(),
        getMyFavorites(),
      ]);
      setAlerts((alertData || []).filter((item) => Boolean(item.is_active)));
      setFavorites(
        (favoriteData || []).filter((item) => Boolean(item.is_favorite)),
      );
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

  const savedLakeItems = useMemo(
    () => mergeItemsByLakeId(alerts, favorites),
    [alerts, favorites],
  );

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
      const queryMatch =
        !query ||
        String(item.lake_name || "")
          .toLowerCase()
          .includes(query);
      return tabMatch && queryMatch;
    });
  }, [activeTab, savedLakeItems, search]);

  const paginatedItems = useMemo(
    () => paginateItems(visibleItems, currentPage),
    [currentPage, visibleItems],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  useEffect(() => {
    if (currentPage > paginatedItems.totalPages) {
      setCurrentPage(paginatedItems.totalPages);
    }
  }, [currentPage, paginatedItems.totalPages]);

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
        const existingIndex = prev.findIndex(
          (currentItem) => currentItem.water_body_id === item.water_body_id,
        );
        const mergedItem = { ...item, ...(createdItem || {}) };
        if (existingIndex >= 0) {
          return prev.map((currentItem) =>
            currentItem.water_body_id === item.water_body_id
              ? mergedItem
              : currentItem,
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
      setAlerts((prev) =>
        prev.filter(
          (currentItem) => currentItem.water_body_id !== item.water_body_id,
        ),
      );
      setFavorites((prev) =>
        prev.map((currentItem) =>
          currentItem.water_body_id === item.water_body_id
            ? { ...currentItem, is_active: false }
            : currentItem,
        ),
      );
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
        if (
          prev.some(
            (currentItem) => currentItem.water_body_id === item.water_body_id,
          )
        ) {
          return prev.map((currentItem) =>
            currentItem.water_body_id === item.water_body_id
              ? favoriteItem
              : currentItem,
          );
        }
        return [...prev, favoriteItem];
      });
      setAlerts((prev) =>
        prev.map((currentItem) =>
          currentItem.water_body_id === item.water_body_id
            ? { ...currentItem, is_favorite: true }
            : currentItem,
        ),
      );
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
      setFavorites((prev) =>
        prev.filter(
          (currentItem) => currentItem.water_body_id !== item.water_body_id,
        ),
      );
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

  const goToMap = (waterBodyId) =>
    navigate("/", { state: { lakeId: waterBodyId } });
  const goToDetails = (waterBodyId) => navigate(`/lakes/${waterBodyId}`);

  if (loading) {
    return <div className={styles.loading}>Loading saved lakes…</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>
              <FaStar />
              <span>Saved lakes</span>
            </div>
            <h1 className={styles.heroTitle}>Saved Lakes</h1>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelGrid}>
            <div>
              <div className={styles.sectionLabel}>
                <FaSearch />
                <span>Search saved lakes</span>
              </div>
              <div className={styles.searchWrap}>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by lake name..."
                  className={styles.searchInput}
                />
              </div>
            </div>

            <div>
              <div className={styles.sectionLabel}>
                <FaSlidersH />
                <span>Quick filters</span>
              </div>
              <div className={styles.filterRow}>
                <TabButton
                  active={activeTab === "all"}
                  onClick={() => setActiveTab("all")}
                >
                  All saved
                </TabButton>
                <TabButton
                  active={activeTab === "favorites"}
                  onClick={() => setActiveTab("favorites")}
                >
                  Favorites
                </TabButton>
                <TabButton
                  active={activeTab === "alerts"}
                  onClick={() => setActiveTab("alerts")}
                >
                  Alerts
                </TabButton>
                <TabButton
                  active={activeTab === "both"}
                  onClick={() => setActiveTab("both")}
                >
                  Both
                </TabButton>
                <button
                  type="button"
                  onClick={loadSavedLakes}
                  className={styles.refreshButton}
                >
                  <FaRedoAlt /> Refresh
                </button>
              </div>
            </div>
          </div>
        </section>

        {!visibleItems.length ? (
          <div className={styles.emptyState}>
            No saved lakes match the current search and filter.
          </div>
        ) : (
          <section className={styles.list}>
            {paginatedItems.items.map((item) => {
              const isBusy = savingId === item.water_body_id;
              return (
                <article key={item.water_body_id} className={styles.itemCard}>
                  <div className={styles.itemTop}>
                    <div className={styles.itemHeaderMain}>
                      <div className={styles.itemTitleBlock}>
                        <h3 className={styles.itemTitle}>{item.lake_name}</h3>
                        <p className={styles.itemSubtitle}>
                          Manage notifications, favorites, and quick access
                          actions for this lake.
                        </p>
                      </div>

                      <div className={styles.itemHeaderAside}>
                        <div className={styles.headerActionsRow}>
                          <div className={styles.badgesInline}>
                            <span
                              className={
                                item.is_active
                                  ? styles.badge
                                  : styles.badgeMuted
                              }
                            >
                              <FaBell />{" "}
                              {item.is_active ? "Alert On" : "Alerts Off"}
                            </span>
                            <span
                              className={
                                item.is_favorite
                                  ? styles.badgeWarm
                                  : styles.badgeMuted
                              }
                            >
                              <FaHeart />{" "}
                              {item.is_favorite ? "Favorite" : "Not favorite"}
                            </span>
                            <span className={styles.badgeCool}>
                              <FaTag /> {getSavedStateLabel(item)}
                            </span>
                          </div>

                          <div className={styles.topActions}>
                            <button
                              type="button"
                              onClick={() => goToMap(item.water_body_id)}
                              className={[
                                styles.actionButton,
                                styles.ghostButton,
                              ].join(" ")}
                            >
                              <FaMapMarkedAlt /> View on map
                            </button>
                            <button
                              type="button"
                              onClick={() => goToDetails(item.water_body_id)}
                              className={[
                                styles.actionButton,
                                styles.primaryButton,
                              ].join(" ")}
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.controlsGridCompact}>
                    <div className={styles.field}>
                      <div className={styles.fieldLabel}>
                        <FaBell /> Notification frequency
                      </div>
                      <select
                        value={item.notification_frequency || "daily"}
                        disabled={!item.is_active || isBusy}
                        onChange={(event) =>
                          patchAlertItem(
                            item.water_body_id,
                            { notification_frequency: event.target.value },
                            "Frequency updated",
                          )
                        }
                        className={styles.select}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldLabel}>
                        <FaChartLine /> Minimum score
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.min_score ?? 0}
                        disabled={!item.is_active || isBusy}
                        onChange={(event) =>
                          patchAlertItem(
                            item.water_body_id,
                            { min_score: clampScore(event.target.value) },
                            "Minimum score updated",
                          )
                        }
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.fieldWide}>
                      <div className={styles.fieldLabel}>
                        <FaSlidersH /> Quick actions
                      </div>
                      <div className={styles.actionRow}>
                        {item.is_active ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => disableAlert(item)}
                            className={styles.secondaryButton}
                          >
                            Disable alert
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => enableAlert(item)}
                            className={styles.successButton}
                          >
                            Enable alert
                          </button>
                        )}
                        {item.is_favorite ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => removeFavorite(item)}
                            className={styles.warningButton}
                          >
                            Remove favorite
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => addFavorite(item)}
                            className={styles.primaryButton}
                          >
                            Mark favorite
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.infoStrip}>
                    <div className={styles.infoPill}>
                      <FaHeart /> Favorite: {item.is_favorite ? "Yes" : "No"}
                    </div>
                    <div className={styles.infoPill}>
                      <FaBell /> Alert:{" "}
                      {item.is_active ? "Enabled" : "Disabled"}
                    </div>
                    <div className={styles.infoPill}>
                      <FaChartLine /> Score threshold: {item.min_score ?? 0}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {visibleItems.length ? (
          <div className={styles.paginationWrap}>
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
