import React, { useEffect, useMemo, useRef, useState } from "react";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  FaChartBar,
  FaWater,
  FaUsers,
  FaStar,
  FaTrash,
  FaSave,
  FaFileAlt,
} from "react-icons/fa";
import {
  deleteAdminOwnerClaimRequest,
  deleteAdminReview,
  deleteAdminUser,
  deleteAdminWaterBody,
  getAdminAnalytics,
  getAdminOwnerClaimRequests,
  getAdminReviews,
  getAdminUsers,
  getAdminWaterBodies,
  updateAdminOwnerClaimRequest,
  updateAdminUser,
  updateAdminWaterBody,
} from "../api/adminApi";
import styles from "./AdminDashboard.module.css";
import { formatCurrency } from "../utils/formatCurrency";
import ui from "../styles/ui.module.css";
import ActionButton from "../components/ui/ActionButton";
import Card from "../components/ui/Card";
import PageContainer from "../components/ui/PageContainer";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import SectionHeader from "../components/ui/SectionHeader";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import TabButton from "../components/ui/TabButton";
import { formatDateTime } from "../utils/date";

const PAGE_SIZE = 3;

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

const getLakeMode = (lake) => {
  if (lake?.is_private && lake?.is_reservable) {
    return "private_reservable";
  }

  if (lake?.is_private) {
    return "private_not_reservable";
  }

  return "public";
};

const applyLakeMode = (lake, mode) => {
  const nextLake = { ...lake };

  if (mode === "private_reservable") {
    nextLake.is_private = true;
    nextLake.is_reservable = true;
    return nextLake;
  }

  if (mode === "private_not_reservable") {
    nextLake.is_private = true;
    nextLake.is_reservable = false;
    return nextLake;
  }

  nextLake.is_private = false;
  nextLake.is_reservable = false;
  nextLake.owner_id = null;
  return nextLake;
};

const getUploadUrl = (proofDocumentUrl) => {
  if (!proofDocumentUrl) {
    return "";
  }

  const baseUrl =
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    "http://localhost:5000";

  return `${baseUrl.replace(/\/$/, "")}/uploads/${proofDocumentUrl}`;
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const [analytics, setAnalytics] = useState(null);
  const [waterBodies, setWaterBodies] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ownerClaimRequests, setOwnerClaimRequests] = useState([]);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingOwnerClaims, setLoadingOwnerClaims] = useState(false);

  const [overviewError, setOverviewError] = useState("");
  const [waterBodiesError, setWaterBodiesError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [ownerClaimsError, setOwnerClaimsError] = useState("");

  const [savingWaterBodyId, setSavingWaterBodyId] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [savingOwnerClaimId, setSavingOwnerClaimId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [lakeSearch, setLakeSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [ownerClaimSearch, setOwnerClaimSearch] = useState("");
  const [ownerClaimStatusFilter, setOwnerClaimStatusFilter] = useState("pending");

  const [waterBodiesPage, setWaterBodiesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [ownerClaimsPage, setOwnerClaimsPage] = useState(1);

  const waterBodiesSectionRef = useRef(null);
  const usersSectionRef = useRef(null);
  const reviewsSectionRef = useRef(null);
  const ownerClaimsSectionRef = useRef(null);

  const scrollToSectionTop = (ref) => {
    setTimeout(() => {
      ref?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const loadOverview = async () => {
    try {
      setLoadingOverview(true);
      setOverviewError("");
      const data = await getAdminAnalytics();
      setAnalytics(data || null);
    } catch (error) {
      setOverviewError(error?.response?.data?.error || "Failed to load analytics");
      notifyError(error, "Failed to load analytics");
      setAnalytics(null);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadWaterBodies = async () => {
    try {
      setLoadingWaterBodies(true);
      setWaterBodiesError("");
      const data = await getAdminWaterBodies();
      setWaterBodies(data || []);
    } catch (error) {
      setWaterBodiesError(
        error?.response?.data?.error || "Failed to load water bodies",
      );
      notifyError(error, "Failed to load water bodies");
      setWaterBodies([]);
    } finally {
      setLoadingWaterBodies(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setUsersError("");
      const data = await getAdminUsers();
      setUsers(data || []);
    } catch (error) {
      setUsersError(error?.response?.data?.error || "Failed to load users");
      notifyError(error, "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      setReviewsError("");
      const data = await getAdminReviews();
      setReviews(data || []);
    } catch (error) {
      setReviewsError(error?.response?.data?.error || "Failed to load reviews");
      notifyError(error, "Failed to load reviews");
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadOwnerClaims = async () => {
    try {
      setLoadingOwnerClaims(true);
      setOwnerClaimsError("");
      const data = await getAdminOwnerClaimRequests();
      setOwnerClaimRequests(data || []);
    } catch (error) {
      setOwnerClaimsError(
        error?.response?.data?.error || "Failed to load owner claim requests",
      );
      notifyError(error, "Failed to load owner claim requests");
      setOwnerClaimRequests([]);
    } finally {
      setLoadingOwnerClaims(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadWaterBodies();
    loadUsers();
    loadReviews();
    loadOwnerClaims();
  }, []);

  const filteredWaterBodies = useMemo(() => {
    const query = lakeSearch.trim().toLowerCase();

    if (!query) {
      return waterBodies;
    }

    return waterBodies.filter((lake) =>
      [
        lake.name,
        lake.description,
        lake.type,
        lake.owner_name,
        lake.owner_email,
        lake.owner_id,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query),
    );
  }, [waterBodies, lakeSearch]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [user.full_name, user.email, user.role]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query),
    );
  }, [users, userSearch]);

  const filteredReviews = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();

    if (!query) {
      return reviews;
    }

    return reviews.filter((review) =>
      [review.comment, review.full_name, review.email, review.lake_name, review.rating]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query),
    );
  }, [reviews, reviewSearch]);

  const filteredOwnerClaims = useMemo(() => {
    const query = ownerClaimSearch.trim().toLowerCase();

    return ownerClaimRequests.filter((item) => {
      const matchesSearch = [
        item.lake_name,
        item.full_name,
        item.email,
        item.phone,
        item.company_name,
        item.message,
        item.status,
        item.admin_note,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);

      const matchesStatus =
        ownerClaimStatusFilter === "all"
          ? true
          : String(item.status || "") === ownerClaimStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [ownerClaimRequests, ownerClaimSearch, ownerClaimStatusFilter]);

  useEffect(() => {
    setWaterBodiesPage(1);
  }, [lakeSearch, waterBodies.length]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, users.length]);

  useEffect(() => {
    setReviewsPage(1);
  }, [reviewSearch, reviews.length]);

  useEffect(() => {
    setOwnerClaimsPage(1);
  }, [ownerClaimSearch, ownerClaimStatusFilter, ownerClaimRequests.length]);

  const paginatedWaterBodies = useMemo(
    () => paginateItems(filteredWaterBodies, waterBodiesPage),
    [filteredWaterBodies, waterBodiesPage],
  );

  const paginatedUsers = useMemo(
    () => paginateItems(filteredUsers, usersPage),
    [filteredUsers, usersPage],
  );

  const paginatedReviews = useMemo(
    () => paginateItems(filteredReviews, reviewsPage),
    [filteredReviews, reviewsPage],
  );

  const paginatedOwnerClaims = useMemo(
    () => paginateItems(filteredOwnerClaims, ownerClaimsPage),
    [filteredOwnerClaims, ownerClaimsPage],
  );

  const updateLakeLocal = (lakeId, field, value) => {
    setWaterBodies((prev) =>
      prev.map((lake) => {
        if (lake.id !== lakeId) {
          return lake;
        }

        if (field === "lake_mode") {
          return applyLakeMode(lake, value);
        }

        const nextLake = { ...lake, [field]: value };

        if (field === "is_reservable" && value === true) {
          nextLake.is_private = true;
        }

        if (field === "is_private" && value === false) {
          nextLake.is_reservable = false;
          nextLake.owner_id = null;
        }

        return nextLake;
      }),
    );
  };

  const updateUserLocal = (userId, field, value) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, [field]: value } : user)),
    );
  };

  const updateOwnerClaimLocal = (requestId, field, value) => {
    setOwnerClaimRequests((prev) =>
      prev.map((item) => (item.id === requestId ? { ...item, [field]: value } : item)),
    );
  };

  const buildLakePayload = (lake) => ({
    name: String(lake.name || "").trim(),
    description: String(lake.description || "").trim(),
    type: String(lake.type || "").trim(),
    is_private: Boolean(lake.is_private),
    owner_id: lake.owner_id || null,
    price_per_day: Number(lake.price_per_day || 0),
    capacity: Number(lake.capacity || 1),
    is_reservable: Boolean(lake.is_reservable),
    availability_notes: String(lake.availability_notes || "").trim(),
  });

  const saveLake = async (lake, options = {}) => {
    const { successMessage = "Water body updated", showSuccessToast = true } = options;

    try {
      setSavingWaterBodyId(lake.id);

      await updateAdminWaterBody(lake.id, buildLakePayload(lake));

      if (showSuccessToast && successMessage) {
        notifySuccess(successMessage);
      }

      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to update water body");
    } finally {
      setSavingWaterBodyId("");
    }
  };

  const deleteLake = async (lakeId) => {
    try {
      setDeletingId(lakeId);
      await deleteAdminWaterBody(lakeId);
      notifySuccess("Water body deleted");
      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to delete water body");
    } finally {
      setDeletingId("");
    }
  };

  const saveUser = async (user) => {
    try {
      setSavingUserId(user.id);

      const payload = {
        full_name: String(user.full_name || "").trim(),
        role: String(user.role || "user").trim(),
        is_active: Boolean(user.is_active),
      };

      await updateAdminUser(user.id, payload);
      notifySuccess("User updated");
      await loadUsers();
      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to update user");
    } finally {
      setSavingUserId("");
    }
  };

  const deleteUser = async (userId) => {
    try {
      setDeletingId(userId);
      await deleteAdminUser(userId);
      notifySuccess("User deleted");
      await loadUsers();
      await loadWaterBodies();
      await loadReviews();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to delete user");
    } finally {
      setDeletingId("");
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      setDeletingId(reviewId);
      await deleteAdminReview(reviewId);
      notifySuccess("Review deleted");
      await loadReviews();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to delete review");
    } finally {
      setDeletingId("");
    }
  };

  const reviewOwnerClaim = async (requestId, status) => {
    try {
      setSavingOwnerClaimId(requestId);

      const current = ownerClaimRequests.find((item) => item.id === requestId);

      await updateAdminOwnerClaimRequest(requestId, {
        status,
        admin_note: String(current?.admin_note || "").trim(),
      });

      notifySuccess(`Request set to ${status}`);
      await loadOwnerClaims();
      await loadWaterBodies();
      await loadUsers();
      await loadOverview();
    } catch (error) {
      notifyError(error, `Failed to set request to ${status}`);
    } finally {
      setSavingOwnerClaimId("");
    }
  };

  const deleteOwnerClaim = async (requestId) => {
    try {
      setDeletingId(requestId);
      await deleteAdminOwnerClaimRequest(requestId);
      notifySuccess("Ownership request removed");
      await loadOwnerClaims();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Failed to remove ownership request");
    } finally {
      setDeletingId("");
    }
  };

  const renderError = (text, onRetry) => (
    <div className={ui.alertError}>
      <div>{text}</div>
      <ActionButton tone="neutral" onClick={onRetry}>
        Retry
      </ActionButton>
    </div>
  );

  const pendingOwnerClaimsCount = Number(analytics?.totals?.pending_owner_claims || 0);

  return (
    <div className={styles.page}>
      <PageContainer width="wide" className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            Administration
          </div>
          <h1 className={styles.heroTitle}>
            Admin Dashboard
          </h1>
          <div className={styles.heroText}>
            Manage platform statistics, water bodies, users, reviews, and
            ownership verification requests from one place.
          </div>
        </div>

        <div className={ui.tabRow}>
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<FaChartBar />}
          >
            Overview
          </TabButton>

          <TabButton
            active={activeTab === "water-bodies"}
            onClick={() => setActiveTab("water-bodies")}
            icon={<FaWater />}
          >
            Water Bodies
          </TabButton>

          <TabButton
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            icon={<FaUsers />}
          >
            Users
          </TabButton>

          <TabButton
            active={activeTab === "reviews"}
            onClick={() => setActiveTab("reviews")}
            icon={<FaStar />}
          >
            Reviews
          </TabButton>

          <TabButton
            active={activeTab === "owner-claims"}
            onClick={() => setActiveTab("owner-claims")}
            icon={<FaFileAlt />}
            badge={pendingOwnerClaimsCount > 0 ? pendingOwnerClaimsCount : null}
          >
            Ownership Requests
          </TabButton>
        </div>

        {activeTab === "overview" && (
          <div className={styles.overviewStack}>
            {overviewError ? (
              renderError(overviewError, loadOverview)
            ) : loadingOverview ? (
              <Card className={styles.card}>Loading analytics...</Card>
            ) : !analytics ? (
              <Card className={styles.card}>No analytics available.</Card>
            ) : (
              <>
                <div className={styles.statsGrid}>
                  <StatCard label="Total Users" value={analytics.totals?.users ?? 0} className={styles.statCard} />
                  <StatCard label="Total Water Bodies" value={analytics.totals?.water_bodies ?? 0} className={styles.statCard} />
                  <StatCard label="Total Reviews" value={analytics.totals?.reviews ?? 0} className={styles.statCard} />
                  <StatCard label="Total Catches" value={analytics.totals?.catches ?? 0} className={styles.statCard} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div className={styles.card}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>
                      Platform Totals
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        color: "#334155",
                        fontSize: 14,
                      }}
                    >
                      <div>Active users: {analytics.totals?.active_users ?? 0}</div>
                      <div>Private lakes: {analytics.totals?.private_lakes ?? 0}</div>
                      <div>Public lakes: {analytics.totals?.public_lakes ?? 0}</div>
                      <div>Reservations: {analytics.totals?.reservations ?? 0}</div>
                      <div>
                        Pending reservations:{" "}
                        {analytics.totals?.pending_reservations ?? 0}
                      </div>
                      <div>
                        Approved reservations:{" "}
                        {analytics.totals?.approved_reservations ?? 0}
                      </div>
                      <div>Subscriptions: {analytics.totals?.subscriptions ?? 0}</div>
                      <div>
                        Pending ownership requests:{" "}
                        {analytics.totals?.pending_owner_claims ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className={styles.card}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>
                      Top Lakes By Catches
                    </h3>
                    {!analytics.topLakes?.length ? (
                      <div className={styles.muted}>No lake statistics yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {analytics.topLakes.map((item) => (
                          <div
                            key={item.water_body_id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f8fafc",
                            }}
                          >
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>
                              {item.lake_name}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#475569",
                                marginTop: 4,
                              }}
                            >
                              {item.catches_count} catches
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.card}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>
                      Top Species
                    </h3>
                    {!analytics.topSpecies?.length ? (
                      <div className={styles.muted}>No species statistics yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {analytics.topSpecies.map((item, index) => (
                          <div
                            key={`${item.species}-${index}`}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f8fafc",
                            }}
                          >
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>
                              {item.species}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#475569",
                                marginTop: 4,
                              }}
                            >
                              {item.catches_count} catches
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "water-bodies" && (
          <div ref={waterBodiesSectionRef} className={styles.card}>
            <SectionHeader
              title="Manage Water Bodies"
              action={
                <SearchInput
                  value={lakeSearch}
                  onChange={(e) => setLakeSearch(e.target.value)}
                  placeholder="Search water bodies..."
                />
              }
            />

            {waterBodiesError ? (
              renderError(waterBodiesError, loadWaterBodies)
            ) : loadingWaterBodies ? (
              <div className={styles.muted}>Loading water bodies...</div>
            ) : !filteredWaterBodies.length ? (
              <div className={styles.muted}>No water bodies found.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 14 }}>
                  {paginatedWaterBodies.items.map((lake) => (
                    <div
                      key={lake.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className={ui.fieldLabel}>
                            Name
                          </div>
                          <input
                            type="text"
                            value={lake.name || ""}
                            onChange={(e) => updateLakeLocal(lake.id, "name", e.target.value)}
                            className={styles.input}
                          />
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Type
                          </div>
                          <input
                            type="text"
                            value={lake.type || ""}
                            onChange={(e) => updateLakeLocal(lake.id, "type", e.target.value)}
                            className={styles.input}
                          />
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Price per day (€)
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number(lake.price_per_day || 0)}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "price_per_day", e.target.value)
                            }
                            className={styles.input}
                          />
                          <div className={ui.helperText}>Shown to users as {formatCurrency(lake.price_per_day || 0)} per day</div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Capacity
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={Number(lake.capacity || 1)}
                            onChange={(e) => updateLakeLocal(lake.id, "capacity", e.target.value)}
                            className={styles.input}
                          />
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Lake mode
                          </div>
                          <select
                            value={getLakeMode(lake)}
                            onChange={async (e) => {
                              const nextLake = applyLakeMode(lake, e.target.value);
                              setWaterBodies((prev) =>
                                prev.map((item) => (item.id === lake.id ? nextLake : item)),
                              );
                              await saveLake(nextLake, {
                                successMessage: "Lake mode updated",
                                showSuccessToast: true,
                              });
                            }}
                            className={styles.input}
                            disabled={savingWaterBodyId === lake.id}
                          >
                            <option value="public">Public</option>
                            <option value="private_not_reservable">
                              Private, not reservable
                            </option>
                            <option value="private_reservable">
                              Private, reservable
                            </option>
                          </select>
                          <div className={styles.helperText}>
                            Public lakes are open in the atlas and cannot have bookings or an owner.
                            Private lakes are owner-controlled, and only the reservable mode supports
                            reservations and ownership requests.
                          </div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Owner
                          </div>
                          <select
                            value={lake.owner_id || ""}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "owner_id", e.target.value || null)
                            }
                            className={styles.input}
                          >
                            <option value="">No owner</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div className={ui.fieldLabel}>
                          Description
                        </div>
                        <textarea
                          rows={3}
                          value={lake.description || ""}
                          onChange={(e) => updateLakeLocal(lake.id, "description", e.target.value)}
                          className={styles.textarea}
                        />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div className={ui.fieldLabel}>
                          Availability notes
                        </div>
                        <textarea
                          rows={3}
                          value={lake.availability_notes || ""}
                          onChange={(e) =>
                            updateLakeLocal(lake.id, "availability_notes", e.target.value)
                          }
                          className={styles.textarea}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className={ui.metaText}>
                          Owner:{" "}
                          {lake.owner_name
                            ? `${lake.owner_name} (${lake.owner_email})`
                            : "No owner"}
                        </div>

                        <div className={ui.buttonRow}>
                          <ActionButton
                            type="button"
                            disabled={savingWaterBodyId === lake.id}
                            onClick={() => saveLake(lake)}
                            tone="primary"
                          >
                            <FaSave className={ui.buttonIcon} />
                            {savingWaterBodyId === lake.id ? "Saving..." : "Save"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            disabled={deletingId === lake.id}
                            onClick={() => deleteLake(lake.id)}
                            tone="danger"
                          >
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === lake.id ? "Deleting..." : "Delete"}
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={paginatedWaterBodies.currentPage}
                  totalPages={paginatedWaterBodies.totalPages}
                  totalItems={paginatedWaterBodies.totalItems}
                  startIndex={paginatedWaterBodies.startIndex}
                  endIndex={paginatedWaterBodies.endIndex}
                  onPageChange={(page) => {
                    setWaterBodiesPage(page);
                    scrollToSectionTop(waterBodiesSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div ref={usersSectionRef} className={styles.card}>
            <SectionHeader
              title="Manage Users"
              action={
                <SearchInput
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                />
              }
            />

            {usersError ? (
              renderError(usersError, loadUsers)
            ) : loadingUsers ? (
              <div className={styles.muted}>Loading users...</div>
            ) : !filteredUsers.length ? (
              <div className={styles.muted}>No users found.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12 }}>
                  {paginatedUsers.items.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className={ui.fieldLabel}>
                            Full name
                          </div>
                          <input
                            type="text"
                            value={user.full_name || ""}
                            onChange={(e) =>
                              updateUserLocal(user.id, "full_name", e.target.value)
                            }
                            className={styles.input}
                          />
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Email
                          </div>
                          <input
                            type="email"
                            value={user.email || ""}
                            className={styles.input}
                            disabled
                            readOnly
                            title="Email addresses cannot be changed from the admin panel."
                            style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
                          />
                          <div className={ui.metaText} style={{ marginTop: 6 }}>
                            Email is locked and cannot be edited by admins.
                          </div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Role
                          </div>
                          <select
                            value={user.role || "user"}
                            onChange={(e) => updateUserLocal(user.id, "role", e.target.value)}
                            className={styles.input}
                          >
                            <option value="user">user</option>
                            <option value="owner">owner</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Active
                          </div>
                          <select
                            value={user.is_active ? "true" : "false"}
                            onChange={(e) =>
                              updateUserLocal(user.id, "is_active", e.target.value === "true")
                            }
                            className={styles.input}
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className={ui.metaText}>
                          Created: {formatDateTime(user.created_at)} | Verified:{" "}
                          {user.is_verified ? "Yes" : "No"}
                        </div>

                        <div className={ui.buttonRow}>
                          <ActionButton
                            type="button"
                            disabled={savingUserId === user.id}
                            onClick={() => saveUser(user)}
                            tone="neutral"
                          >
                            <FaSave className={ui.buttonIcon} />
                            {savingUserId === user.id ? "Saving..." : "Save"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            disabled={deletingId === user.id}
                            onClick={() => deleteUser(user.id)}
                            tone="danger"
                          >
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === user.id ? "Deleting..." : "Delete"}
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={paginatedUsers.currentPage}
                  totalPages={paginatedUsers.totalPages}
                  totalItems={paginatedUsers.totalItems}
                  startIndex={paginatedUsers.startIndex}
                  endIndex={paginatedUsers.endIndex}
                  onPageChange={(page) => {
                    setUsersPage(page);
                    scrollToSectionTop(usersSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div ref={reviewsSectionRef} className={styles.card}>
            <SectionHeader
              title="Manage Reviews"
              action={
                <SearchInput
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Search reviews..."
                />
              }
            />

            {reviewsError ? (
              renderError(reviewsError, loadReviews)
            ) : loadingReviews ? (
              <div className={styles.muted}>Loading reviews...</div>
            ) : !filteredReviews.length ? (
              <div className={styles.muted}>No reviews found.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12 }}>
                  {paginatedReviews.items.map((review) => (
                    <div
                      key={review.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {review.full_name || "Unknown user"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            {review.email || "No email"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            Lake: {review.lake_name || "Unknown lake"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            {formatDateTime(review.created_at)}
                          </div>
                        </div>

                        <div
                          style={{
                            background: "#fef3c7",
                            color: "#92400e",
                            borderRadius: "999px",
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {review.rating} / 5
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: "#334155", lineHeight: 1.6 }}>
                        {review.comment || "No comment provided."}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <ActionButton
                          type="button"
                          disabled={deletingId === review.id}
                          onClick={() => deleteReview(review.id)}
                          tone="danger"
                        >
                          <FaTrash className={ui.buttonIcon} />
                          {deletingId === review.id ? "Deleting..." : "Delete review"}
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={paginatedReviews.currentPage}
                  totalPages={paginatedReviews.totalPages}
                  totalItems={paginatedReviews.totalItems}
                  startIndex={paginatedReviews.startIndex}
                  endIndex={paginatedReviews.endIndex}
                  onPageChange={(page) => {
                    setReviewsPage(page);
                    scrollToSectionTop(reviewsSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "owner-claims" && (
          <div ref={ownerClaimsSectionRef} className={styles.card}>
            <SectionHeader
              title={`Ownership Verification Requests${pendingOwnerClaimsCount > 0 ? ` (${pendingOwnerClaimsCount})` : ""}`}
              action={
                <SearchInput
                  value={ownerClaimSearch}
                  onChange={(e) => setOwnerClaimSearch(e.target.value)}
                  placeholder="Search ownership requests..."
                />
              }
            />

            <div className={ui.filterRow}>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("all")}
                className={[ui.filterButton, ownerClaimStatusFilter === "all" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("pending")}
                className={[ui.filterButton, ownerClaimStatusFilter === "pending" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("approved")}
                className={[ui.filterButton, ownerClaimStatusFilter === "approved" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("rejected")}
                className={[ui.filterButton, ownerClaimStatusFilter === "rejected" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Rejected
              </button>
            </div>

            {ownerClaimsError ? (
              renderError(ownerClaimsError, loadOwnerClaims)
            ) : loadingOwnerClaims ? (
              <div className={styles.muted}>Loading ownership requests...</div>
            ) : !filteredOwnerClaims.length ? (
              <div className={styles.muted}>No ownership requests found.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 14 }}>
                  {paginatedOwnerClaims.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border:
                          item.status === "pending"
                            ? "1px solid #facc15"
                            : "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 14,
                        background: item.status === "pending" ? "#fffbea" : "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {item.lake_name || "Unknown lake"}
                          </div>
                          <div style={{ fontSize: 14, color: "#334155" }}>
                            {item.full_name} ({item.email})
                          </div>
                          <div className={ui.metaText}>
                            Phone: {item.phone || "Not provided"}
                          </div>
                          <div className={ui.metaText}>
                            Company: {item.company_name || "Not provided"}
                          </div>
                          <div className={ui.metaText}>
                            Submitted: {formatDateTime(item.created_at)}
                          </div>
                          {item.reviewed_at ? (
                            <div className={ui.metaText}>
                              Reviewed: {formatDateTime(item.reviewed_at)}
                            </div>
                          ) : null}
                        </div>

                        <StatusBadge status={item.status} />
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        <div>
                          <div className={ui.fieldLabel}>
                            Claim message
                          </div>
                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f8fafc",
                              color: "#334155",
                              minHeight: 48,
                            }}
                          >
                            {item.message || "No message provided."}
                          </div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Proof document
                          </div>
                          {item.proof_document_url ? (
                            <a
                              href={getUploadUrl(item.proof_document_url)}
                              target="_blank"
                              rel="noreferrer"
                              className={ui.inlineLink}
                            >
                              <FaFileAlt />
                              Open document
                            </a>
                          ) : (
                            <div className={styles.muted}>No document uploaded.</div>
                          )}
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Admin note
                          </div>
                          <textarea
                            rows={3}
                            value={item.admin_note || ""}
                            onChange={(e) =>
                              updateOwnerClaimLocal(item.id, "admin_note", e.target.value)
                            }
                            className={styles.textarea}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className={ui.metaText}>
                          Reviewed by: {item.reviewed_by_name || "Not reviewed yet"}
                        </div>

                        <div className={ui.buttonRow}>
                          {item.status !== "approved" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "approved")}
                              tone="success"
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Approve"}
                            </ActionButton>
                          ) : null}

                          {item.status !== "rejected" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "rejected")}
                              tone="danger"
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Reject"}
                            </ActionButton>
                          ) : null}

                          {item.status !== "pending" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "pending")}
                              tone="warning"
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Move to pending"}
                            </ActionButton>
                          ) : null}

                          {item.status === "rejected" ? (
                            <ActionButton
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => deleteOwnerClaim(item.id)}
                              tone="neutral"
                            >
                              {deletingId === item.id ? "Removing..." : "Hide rejected"}
                            </ActionButton>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={paginatedOwnerClaims.currentPage}
                  totalPages={paginatedOwnerClaims.totalPages}
                  totalItems={paginatedOwnerClaims.totalItems}
                  startIndex={paginatedOwnerClaims.startIndex}
                  endIndex={paginatedOwnerClaims.endIndex}
                  onPageChange={(page) => {
                    setOwnerClaimsPage(page);
                    scrollToSectionTop(ownerClaimsSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}