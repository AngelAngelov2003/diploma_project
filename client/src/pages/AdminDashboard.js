import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client";
import { notifyError, notifySuccess } from "../ui/toast";
import {
  FaChartBar,
  FaWater,
  FaUsers,
  FaStar,
  FaTrash,
  FaSave,
  FaSearch,
  FaFileAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const pageStyle = {
  padding: 24,
  background: "#f8fafc",
  minHeight: "calc(100vh - 60px)",
};

const shellStyle = {
  maxWidth: 1400,
  margin: "0 auto",
};

const heroStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #2563eb 100%)",
  color: "white",
  borderRadius: 22,
  padding: 24,
  marginBottom: 20,
  boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
};

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
};

const statCardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  boxSizing: "border-box",
  background: "white",
  fontSize: 14,
};

const textareaStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  boxSizing: "border-box",
  background: "white",
  fontSize: 14,
  resize: "vertical",
};

const tabButton = (active) => ({
  border: "none",
  background: active ? "#1d4ed8" : "white",
  color: active ? "white" : "#0f172a",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
  boxShadow: active
    ? "0 10px 22px rgba(37,99,235,0.2)"
    : "0 3px 10px rgba(15,23,42,0.05)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
});

const primaryBtn = {
  background: "#0d6efd",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtn = {
  background: "#334155",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBtn = {
  background: "#dc2626",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const successBtn = {
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const warningBtn = {
  background: "#f59e0b",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const mutedStyle = {
  color: "#64748b",
  fontSize: 14,
};

const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const statusBadgeStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background:
    status === "approved"
      ? "#dcfce7"
      : status === "rejected"
        ? "#fee2e2"
        : "#fef3c7",
  color:
    status === "approved"
      ? "#166534"
      : status === "rejected"
        ? "#991b1b"
        : "#92400e",
});

const filterButton = (active) => ({
  border: "1px solid #d1d5db",
  background: active ? "#1d4ed8" : "white",
  color: active ? "white" : "#0f172a",
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
});

const paginationBtn = (active = false, disabled = false) => ({
  minWidth: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: disabled ? "#f8fafc" : active ? "#1d4ed8" : "white",
  color: disabled ? "#94a3b8" : active ? "white" : "#0f172a",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
});

const PAGE_SIZE = 5;

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
      const res = await api.get("/admin/analytics");
      setAnalytics(res.data || null);
    } catch (err) {
      setOverviewError(err.response?.data?.error || "Failed to load analytics");
      notifyError(err, "Failed to load analytics");
      setAnalytics(null);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadWaterBodies = async () => {
    try {
      setLoadingWaterBodies(true);
      setWaterBodiesError("");
      const res = await api.get("/admin/water-bodies");
      setWaterBodies(res.data || []);
    } catch (err) {
      setWaterBodiesError(err.response?.data?.error || "Failed to load water bodies");
      notifyError(err, "Failed to load water bodies");
      setWaterBodies([]);
    } finally {
      setLoadingWaterBodies(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setUsersError("");
      const res = await api.get("/admin/users");
      setUsers(res.data || []);
    } catch (err) {
      setUsersError(err.response?.data?.error || "Failed to load users");
      notifyError(err, "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      setReviewsError("");
      const res = await api.get("/admin/reviews");
      setReviews(res.data || []);
    } catch (err) {
      setReviewsError(err.response?.data?.error || "Failed to load reviews");
      notifyError(err, "Failed to load reviews");
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadOwnerClaims = async () => {
    try {
      setLoadingOwnerClaims(true);
      setOwnerClaimsError("");
      const res = await api.get("/admin/owner-claim-requests");
      setOwnerClaimRequests(res.data || []);
    } catch (err) {
      setOwnerClaimsError(
        err.response?.data?.error || "Failed to load owner claim requests",
      );
      notifyError(err, "Failed to load owner claim requests");
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
    const q = lakeSearch.trim().toLowerCase();
    if (!q) return waterBodies;
    return waterBodies.filter((lake) =>
      [
        lake.name,
        lake.description,
        lake.type,
        lake.owner_name,
        lake.owner_email,
        lake.owner_id,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [waterBodies, lakeSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.role]
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [users, userSearch]);

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((review) =>
      [review.comment, review.full_name, review.email, review.lake_name, review.rating]
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [reviews, reviewSearch]);

  const filteredOwnerClaims = useMemo(() => {
    const q = ownerClaimSearch.trim().toLowerCase();
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
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
        .includes(q);

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
      prev.map((lake) => (lake.id === lakeId ? { ...lake, [field]: value } : lake)),
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

  const saveLake = async (lake) => {
    try {
      setSavingWaterBodyId(lake.id);

      const payload = {
        name: String(lake.name || "").trim(),
        description: String(lake.description || "").trim(),
        type: String(lake.type || "").trim(),
        is_private: Boolean(lake.is_private),
        owner_id: lake.owner_id || null,
        price_per_day: Number(lake.price_per_day || 0),
        capacity: Number(lake.capacity || 1),
        is_reservable: Boolean(lake.is_reservable),
        availability_notes: String(lake.availability_notes || "").trim(),
      };

      await api.patch(`/admin/water-bodies/${lake.id}`, payload);
      notifySuccess("Water body updated");
      await loadWaterBodies();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to update water body");
    } finally {
      setSavingWaterBodyId("");
    }
  };

  const deleteLake = async (lakeId) => {
    try {
      setDeletingId(lakeId);
      await api.delete(`/admin/water-bodies/${lakeId}`);
      notifySuccess("Water body deleted");
      await loadWaterBodies();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to delete water body");
    } finally {
      setDeletingId("");
    }
  };

  const saveUser = async (user) => {
    try {
      setSavingUserId(user.id);

      const payload = {
        full_name: String(user.full_name || "").trim(),
        email: String(user.email || "").trim(),
        role: String(user.role || "user").trim(),
        is_active: Boolean(user.is_active),
      };

      await api.patch(`/admin/users/${user.id}`, payload);
      notifySuccess("User updated");
      await loadUsers();
      await loadWaterBodies();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to update user");
    } finally {
      setSavingUserId("");
    }
  };

  const deleteUser = async (userId) => {
    try {
      setDeletingId(userId);
      await api.delete(`/admin/users/${userId}`);
      notifySuccess("User deleted");
      await loadUsers();
      await loadWaterBodies();
      await loadReviews();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to delete user");
    } finally {
      setDeletingId("");
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      setDeletingId(reviewId);
      await api.delete(`/admin/reviews/${reviewId}`);
      notifySuccess("Review deleted");
      await loadReviews();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to delete review");
    } finally {
      setDeletingId("");
    }
  };

  const reviewOwnerClaim = async (requestId, status) => {
    try {
      setSavingOwnerClaimId(requestId);

      const current = ownerClaimRequests.find((x) => x.id === requestId);
      await api.patch(`/admin/owner-claim-requests/${requestId}`, {
        status,
        admin_note: String(current?.admin_note || "").trim(),
      });

      notifySuccess(`Request set to ${status}`);
      await loadOwnerClaims();
      await loadWaterBodies();
      await loadUsers();
      await loadOverview();
    } catch (err) {
      notifyError(err, `Failed to set request to ${status}`);
    } finally {
      setSavingOwnerClaimId("");
    }
  };

  const deleteOwnerClaim = async (requestId) => {
    try {
      setDeletingId(requestId);
      await api.delete(`/admin/owner-claim-requests/${requestId}`);
      notifySuccess("Ownership request removed");
      await loadOwnerClaims();
      await loadOverview();
    } catch (err) {
      notifyError(err, "Failed to remove ownership request");
    } finally {
      setDeletingId("");
    }
  };

  const renderError = (text, onRetry) => (
    <div
      style={{
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>{text}</div>
      <button type="button" onClick={onRetry} style={secondaryBtn}>
        Retry
      </button>
    </div>
  );

  const renderPagination = ({
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    onPageChange,
  }) => {
    if (totalItems === 0) return null;

    const pageNumbers = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let p = startPage; p <= endPage; p += 1) {
      pageNumbers.push(p);
    }

    return (
      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          borderTop: "1px solid #e5e7eb",
          paddingTop: 14,
        }}
      >
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Showing <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong>–
          <strong>{endIndex}</strong> of <strong>{totalItems}</strong>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={paginationBtn(false, currentPage <= 1)}
          >
            <FaChevronLeft />
          </button>

          {startPage > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                style={paginationBtn(currentPage === 1)}
              >
                1
              </button>
              {startPage > 2 ? <span style={{ color: "#64748b" }}>...</span> : null}
            </>
          )}

          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              style={paginationBtn(currentPage === page)}
            >
              {page}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 ? (
                <span style={{ color: "#64748b" }}>...</span>
              ) : null}
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                style={paginationBtn(currentPage === totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={paginationBtn(false, currentPage >= totalPages)}
          >
            <FaChevronRight />
          </button>
        </div>
      </div>
    );
  };

  const pendingOwnerClaimsCount = Number(analytics?.totals?.pending_owner_claims || 0);

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={heroStyle}>
          <div style={{ fontSize: 13, opacity: 0.92, marginBottom: 8 }}>Administration</div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 30, fontWeight: 900 }}>
            Admin Dashboard
          </h1>
          <div style={{ maxWidth: 900, lineHeight: 1.6, fontSize: 14, opacity: 0.98 }}>
            Manage platform statistics, water bodies, users, reviews, and ownership
            verification requests from one place.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={tabButton(activeTab === "overview")}
          >
            <FaChartBar />
            Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("water-bodies")}
            style={tabButton(activeTab === "water-bodies")}
          >
            <FaWater />
            Water Bodies
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            style={tabButton(activeTab === "users")}
          >
            <FaUsers />
            Users
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            style={tabButton(activeTab === "reviews")}
          >
            <FaStar />
            Reviews
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("owner-claims")}
            style={tabButton(activeTab === "owner-claims")}
          >
            <FaFileAlt />
            <span>Ownership Requests</span>
            {pendingOwnerClaimsCount > 0 ? (
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  background: activeTab === "owner-claims" ? "white" : "#dc2626",
                  color: activeTab === "owner-claims" ? "#dc2626" : "white",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "0 6px",
                }}
              >
                {pendingOwnerClaimsCount}
              </span>
            ) : null}
          </button>
        </div>

        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: 18 }}>
            {overviewError ? (
              renderError(overviewError, loadOverview)
            ) : loadingOverview ? (
              <div style={cardStyle}>Loading analytics...</div>
            ) : !analytics ? (
              <div style={cardStyle}>No analytics available.</div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div style={statCardStyle}>
                    <div style={mutedStyle}>Total Users</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
                      {analytics.totals?.users ?? 0}
                    </div>
                  </div>

                  <div style={statCardStyle}>
                    <div style={mutedStyle}>Total Water Bodies</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
                      {analytics.totals?.water_bodies ?? 0}
                    </div>
                  </div>

                  <div style={statCardStyle}>
                    <div style={mutedStyle}>Total Reviews</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
                      {analytics.totals?.reviews ?? 0}
                    </div>
                  </div>

                  <div style={statCardStyle}>
                    <div style={mutedStyle}>Total Catches</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
                      {analytics.totals?.catches ?? 0}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>Platform Totals</h3>
                    <div style={{ display: "grid", gap: 8, color: "#334155", fontSize: 14 }}>
                      <div>Active users: {analytics.totals?.active_users ?? 0}</div>
                      <div>Private lakes: {analytics.totals?.private_lakes ?? 0}</div>
                      <div>Public lakes: {analytics.totals?.public_lakes ?? 0}</div>
                      <div>Reservations: {analytics.totals?.reservations ?? 0}</div>
                      <div>Pending reservations: {analytics.totals?.pending_reservations ?? 0}</div>
                      <div>Approved reservations: {analytics.totals?.approved_reservations ?? 0}</div>
                      <div>Subscriptions: {analytics.totals?.subscriptions ?? 0}</div>
                      <div>
                        Pending ownership requests: {analytics.totals?.pending_owner_claims ?? 0}
                      </div>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>Top Lakes By Catches</h3>
                    {!analytics.topLakes?.length ? (
                      <div style={mutedStyle}>No lake statistics yet.</div>
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
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.lake_name}</div>
                            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                              {item.catches_count} catches
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: 14 }}>Top Species</h3>
                    {!analytics.topSpecies?.length ? (
                      <div style={mutedStyle}>No species statistics yet.</div>
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
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.species}</div>
                            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
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
          <div ref={waterBodiesSectionRef} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0 }}>Manage Water Bodies</h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "white",
                  minWidth: 320,
                }}
              >
                <FaSearch style={{ color: "#64748b" }} />
                <input
                  value={lakeSearch}
                  onChange={(e) => setLakeSearch(e.target.value)}
                  placeholder="Search water bodies..."
                  style={{ border: "none", outline: "none", width: "100%", fontSize: 14 }}
                />
              </div>
            </div>

            {waterBodiesError ? (
              renderError(waterBodiesError, loadWaterBodies)
            ) : loadingWaterBodies ? (
              <div style={mutedStyle}>Loading water bodies...</div>
            ) : !filteredWaterBodies.length ? (
              <div style={mutedStyle}>No water bodies found.</div>
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
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Name</div>
                          <input
                            type="text"
                            value={lake.name || ""}
                            onChange={(e) => updateLakeLocal(lake.id, "name", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Type</div>
                          <input
                            type="text"
                            value={lake.type || ""}
                            onChange={(e) => updateLakeLocal(lake.id, "type", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            Price per day
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number(lake.price_per_day || 0)}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "price_per_day", e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Capacity</div>
                          <input
                            type="number"
                            min="1"
                            value={Number(lake.capacity || 1)}
                            onChange={(e) => updateLakeLocal(lake.id, "capacity", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Private</div>
                          <select
                            value={lake.is_private ? "true" : "false"}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "is_private", e.target.value === "true")
                            }
                            style={inputStyle}
                          >
                            <option value="false">Public</option>
                            <option value="true">Private</option>
                          </select>
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            Reservable
                          </div>
                          <select
                            value={lake.is_reservable ? "true" : "false"}
                            onChange={(e) =>
                              updateLakeLocal(
                                lake.id,
                                "is_reservable",
                                e.target.value === "true",
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="false">Disabled</option>
                            <option value="true">Enabled</option>
                          </select>
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Owner</div>
                          <select
                            value={lake.owner_id || ""}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "owner_id", e.target.value || null)
                            }
                            style={inputStyle}
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
                        <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Description</div>
                        <textarea
                          rows={3}
                          value={lake.description || ""}
                          onChange={(e) =>
                            updateLakeLocal(lake.id, "description", e.target.value)
                          }
                          style={textareaStyle}
                        />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                          Availability notes
                        </div>
                        <textarea
                          rows={3}
                          value={lake.availability_notes || ""}
                          onChange={(e) =>
                            updateLakeLocal(lake.id, "availability_notes", e.target.value)
                          }
                          style={textareaStyle}
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
                        <div style={{ fontSize: 13, color: "#64748b" }}>
                          Owner:{" "}
                          {lake.owner_name
                            ? `${lake.owner_name} (${lake.owner_email})`
                            : "No owner"}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={savingWaterBodyId === lake.id}
                            onClick={() => saveLake(lake)}
                            style={primaryBtn}
                          >
                            <FaSave style={{ marginRight: 8 }} />
                            {savingWaterBodyId === lake.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === lake.id}
                            onClick={() => deleteLake(lake.id)}
                            style={dangerBtn}
                          >
                            <FaTrash style={{ marginRight: 8 }} />
                            {deletingId === lake.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPagination({
                  currentPage: paginatedWaterBodies.currentPage,
                  totalPages: paginatedWaterBodies.totalPages,
                  totalItems: paginatedWaterBodies.totalItems,
                  startIndex: paginatedWaterBodies.startIndex,
                  endIndex: paginatedWaterBodies.endIndex,
                  onPageChange: (page) => {
                    setWaterBodiesPage(page);
                    scrollToSectionTop(waterBodiesSectionRef);
                  },
                })}
              </>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div ref={usersSectionRef} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0 }}>Manage Users</h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "white",
                  minWidth: 320,
                }}
              >
                <FaSearch style={{ color: "#64748b" }} />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  style={{ border: "none", outline: "none", width: "100%", fontSize: 14 }}
                />
              </div>
            </div>

            {usersError ? (
              renderError(usersError, loadUsers)
            ) : loadingUsers ? (
              <div style={mutedStyle}>Loading users...</div>
            ) : !filteredUsers.length ? (
              <div style={mutedStyle}>No users found.</div>
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
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            Full name
                          </div>
                          <input
                            type="text"
                            value={user.full_name || ""}
                            onChange={(e) =>
                              updateUserLocal(user.id, "full_name", e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Email</div>
                          <input
                            type="email"
                            value={user.email || ""}
                            onChange={(e) => updateUserLocal(user.id, "email", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Role</div>
                          <select
                            value={user.role || "user"}
                            onChange={(e) => updateUserLocal(user.id, "role", e.target.value)}
                            style={inputStyle}
                          >
                            <option value="user">user</option>
                            <option value="owner">owner</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Active</div>
                          <select
                            value={user.is_active ? "true" : "false"}
                            onChange={(e) =>
                              updateUserLocal(user.id, "is_active", e.target.value === "true")
                            }
                            style={inputStyle}
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
                        <div style={{ fontSize: 13, color: "#64748b" }}>
                          Created: {formatDateTime(user.created_at)} | Verified:{" "}
                          {user.is_verified ? "Yes" : "No"}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={savingUserId === user.id}
                            onClick={() => saveUser(user)}
                            style={secondaryBtn}
                          >
                            <FaSave style={{ marginRight: 8 }} />
                            {savingUserId === user.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === user.id}
                            onClick={() => deleteUser(user.id)}
                            style={dangerBtn}
                          >
                            <FaTrash style={{ marginRight: 8 }} />
                            {deletingId === user.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPagination({
                  currentPage: paginatedUsers.currentPage,
                  totalPages: paginatedUsers.totalPages,
                  totalItems: paginatedUsers.totalItems,
                  startIndex: paginatedUsers.startIndex,
                  endIndex: paginatedUsers.endIndex,
                  onPageChange: (page) => {
                    setUsersPage(page);
                    scrollToSectionTop(usersSectionRef);
                  },
                })}
              </>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div ref={reviewsSectionRef} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0 }}>Manage Reviews</h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "white",
                  minWidth: 320,
                }}
              >
                <FaSearch style={{ color: "#64748b" }} />
                <input
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Search reviews..."
                  style={{ border: "none", outline: "none", width: "100%", fontSize: 14 }}
                />
              </div>
            </div>

            {reviewsError ? (
              renderError(reviewsError, loadReviews)
            ) : loadingReviews ? (
              <div style={mutedStyle}>Loading reviews...</div>
            ) : !filteredReviews.length ? (
              <div style={mutedStyle}>No reviews found.</div>
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
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                            {review.full_name || "Unknown user"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                            {review.email || "No email"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                            Lake: {review.lake_name || "Unknown lake"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
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
                        <button
                          type="button"
                          disabled={deletingId === review.id}
                          onClick={() => deleteReview(review.id)}
                          style={dangerBtn}
                        >
                          <FaTrash style={{ marginRight: 8 }} />
                          {deletingId === review.id ? "Deleting..." : "Delete review"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPagination({
                  currentPage: paginatedReviews.currentPage,
                  totalPages: paginatedReviews.totalPages,
                  totalItems: paginatedReviews.totalItems,
                  startIndex: paginatedReviews.startIndex,
                  endIndex: paginatedReviews.endIndex,
                  onPageChange: (page) => {
                    setReviewsPage(page);
                    scrollToSectionTop(reviewsSectionRef);
                  },
                })}
              </>
            )}
          </div>
        )}

        {activeTab === "owner-claims" && (
          <div ref={ownerClaimsSectionRef} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <span>Ownership Verification Requests</span>
                {pendingOwnerClaimsCount > 0 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 24,
                      height: 24,
                      borderRadius: 999,
                      background: "#dc2626",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "0 8px",
                    }}
                  >
                    {pendingOwnerClaimsCount}
                  </span>
                ) : null}
              </h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "white",
                  minWidth: 320,
                }}
              >
                <FaSearch style={{ color: "#64748b" }} />
                <input
                  value={ownerClaimSearch}
                  onChange={(e) => setOwnerClaimSearch(e.target.value)}
                  placeholder="Search ownership requests..."
                  style={{ border: "none", outline: "none", width: "100%", fontSize: 14 }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("all")}
                style={filterButton(ownerClaimStatusFilter === "all")}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("pending")}
                style={filterButton(ownerClaimStatusFilter === "pending")}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("approved")}
                style={filterButton(ownerClaimStatusFilter === "approved")}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("rejected")}
                style={filterButton(ownerClaimStatusFilter === "rejected")}
              >
                Rejected
              </button>
            </div>

            {ownerClaimsError ? (
              renderError(ownerClaimsError, loadOwnerClaims)
            ) : loadingOwnerClaims ? (
              <div style={mutedStyle}>Loading ownership requests...</div>
            ) : !filteredOwnerClaims.length ? (
              <div style={mutedStyle}>No ownership requests found.</div>
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
                          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                            {item.lake_name || "Unknown lake"}
                          </div>
                          <div style={{ fontSize: 14, color: "#334155" }}>
                            {item.full_name} ({item.email})
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Phone: {item.phone || "Not provided"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Company: {item.company_name || "Not provided"}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Submitted: {formatDateTime(item.created_at)}
                          </div>
                          {item.reviewed_at ? (
                            <div style={{ fontSize: 13, color: "#64748b" }}>
                              Reviewed: {formatDateTime(item.reviewed_at)}
                            </div>
                          ) : null}
                        </div>

                        <div style={statusBadgeStyle(item.status)}>
                          {String(item.status || "").toUpperCase()}
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
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
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            Proof document
                          </div>
                          {item.proof_document_url ? (
                            <a
                              href={`${api.defaults.baseURL || ""}/uploads/${item.proof_document_url}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                color: "#2563eb",
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              <FaFileAlt />
                              Open document
                            </a>
                          ) : (
                            <div style={mutedStyle}>No document uploaded.</div>
                          )}
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                            Admin note
                          </div>
                          <textarea
                            rows={3}
                            value={item.admin_note || ""}
                            onChange={(e) =>
                              updateOwnerClaimLocal(item.id, "admin_note", e.target.value)
                            }
                            style={textareaStyle}
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
                        <div style={{ fontSize: 13, color: "#64748b" }}>
                          Reviewed by: {item.reviewed_by_name || "Not reviewed yet"}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {item.status !== "approved" ? (
                            <button
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "approved")}
                              style={successBtn}
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Approve"}
                            </button>
                          ) : null}

                          {item.status !== "rejected" ? (
                            <button
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "rejected")}
                              style={dangerBtn}
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Reject"}
                            </button>
                          ) : null}

                          {item.status !== "pending" ? (
                            <button
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "pending")}
                              style={warningBtn}
                            >
                              {savingOwnerClaimId === item.id ? "Saving..." : "Move to pending"}
                            </button>
                          ) : null}

                          {item.status === "rejected" ? (
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => deleteOwnerClaim(item.id)}
                              style={secondaryBtn}
                            >
                              {deletingId === item.id ? "Removing..." : "Hide rejected"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPagination({
                  currentPage: paginatedOwnerClaims.currentPage,
                  totalPages: paginatedOwnerClaims.totalPages,
                  totalItems: paginatedOwnerClaims.totalItems,
                  startIndex: paginatedOwnerClaims.startIndex,
                  endIndex: paginatedOwnerClaims.endIndex,
                  onPageChange: (page) => {
                    setOwnerClaimsPage(page);
                    scrollToSectionTop(ownerClaimsSectionRef);
                  },
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}