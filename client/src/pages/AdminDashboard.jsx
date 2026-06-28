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
  FaShieldAlt,
  FaFish,
  FaImages,
  FaPlug,
  FaFlag,
} from "react-icons/fa";
import {
  deleteAdminCatchLog,
  deleteAdminGalleryPhoto,
  deleteAdminOwnerClaimRequest,
  deleteAdminReview,
  deleteAdminUser,
  deleteAdminWaterBody,
  getAdminAnalytics,
  getAdminCatchLogs,
  getAdminGalleryPhotos,
  getAdminOwnerClaimRequests,
  getAdminReviews,
  getAdminUsers,
  getAdminUserReports,
  getAdminWaterBodies,
  updateAdminOwnerClaimRequest,
  updateAdminUser,
  updateAdminUserReport,
  deleteAdminUserReport,
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
import ZoomableImage from "../components/ui/ZoomableImage";
import TabButton from "../components/ui/TabButton";
import { SectionLoadingState } from "../components/common/PageLoadingState";
import { formatDateTime } from "../utils/date";

const PAGE_SIZE = 3;
const OWNER_STATUS_PAGE_SIZE = 4;

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


const getConnectStatusLabel = (status) => {
  const labels = {
    completed: "завършено",
    complete: "завършено",
    onboarding_complete: "завършено",
    active: "активен",
    pending: "чакащо",
    pending_verification: "чака проверка",
    restricted: "ограничен",
    restricted_soon: "скоро ще бъде ограничен",
    rejected: "отхвърлен",
    disabled: "деактивиран",
    not_started: "не е започнато",
    none: "не е започнато",
  };

  if (!status) {
    return "не е започнато";
  }

  return labels[String(status).toLowerCase()] || String(status).replace(/_/g, " ");
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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [analytics, setAnalytics] = useState(null);
  const [waterBodies, setWaterBodies] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [catchLogs, setCatchLogs] = useState([]);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [ownerClaimRequests, setOwnerClaimRequests] = useState([]);
  const [userReports, setUserReports] = useState([]);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingCatchLogs, setLoadingCatchLogs] = useState(false);
  const [loadingGalleryPhotos, setLoadingGalleryPhotos] = useState(false);
  const [loadingOwnerClaims, setLoadingOwnerClaims] = useState(false);
  const [loadingUserReports, setLoadingUserReports] = useState(false);

  const [overviewError, setOverviewError] = useState("");
  const [waterBodiesError, setWaterBodiesError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [catchLogsError, setCatchLogsError] = useState("");
  const [galleryPhotosError, setGalleryPhotosError] = useState("");
  const [ownerClaimsError, setOwnerClaimsError] = useState("");
  const [userReportsError, setUserReportsError] = useState("");

  const [savingWaterBodyId, setSavingWaterBodyId] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [savingOwnerClaimId, setSavingOwnerClaimId] = useState("");
  const [savingUserReportId, setSavingUserReportId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [lakeSearch, setLakeSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [catchSearch, setCatchSearch] = useState("");
  const [photoSearch, setPhotoSearch] = useState("");
  const [ownerClaimSearch, setOwnerClaimSearch] = useState("");
  const [ownerClaimStatusFilter, setOwnerClaimStatusFilter] = useState("pending");
  const [userReportSearch, setUserReportSearch] = useState("");
  const [userReportStatusFilter, setUserReportStatusFilter] = useState("pending");

  const [waterBodiesPage, setWaterBodiesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [catchLogsPage, setCatchLogsPage] = useState(1);
  const [galleryPhotosPage, setGalleryPhotosPage] = useState(1);
  const [ownerClaimsPage, setOwnerClaimsPage] = useState(1);
  const [ownerStatusPage, setOwnerStatusPage] = useState(1);
  const [userReportsPage, setUserReportsPage] = useState(1);

  const waterBodiesSectionRef = useRef(null);
  const usersSectionRef = useRef(null);
  const reviewsSectionRef = useRef(null);
  const catchLogsSectionRef = useRef(null);
  const galleryPhotosSectionRef = useRef(null);
  const ownerClaimsSectionRef = useRef(null);
  const userReportsSectionRef = useRef(null);

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
      setOverviewError(error?.response?.data?.error || "Неуспешно зареждане на статистиката");
      notifyError(error, "Неуспешно зареждане на статистиката");
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
        error?.response?.data?.error || "Неуспешно зареждане на водоемите",
      );
      notifyError(error, "Неуспешно зареждане на водоемите");
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
      setUsersError(error?.response?.data?.error || "Неуспешно зареждане на потребителите");
      notifyError(error, "Неуспешно зареждане на потребителите");
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
      setReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      setReviewsError(error?.response?.data?.error || "Неуспешно зареждане на отзивите");
      notifyError(error, "Неуспешно зареждане на отзивите");
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadCatchLogs = async () => {
    try {
      setLoadingCatchLogs(true);
      setCatchLogsError("");
      const data = await getAdminCatchLogs();
      setCatchLogs(data || []);
    } catch (error) {
      setCatchLogsError(error?.response?.data?.error || "Неуспешно зареждане на уловите");
      notifyError(error, "Неуспешно зареждане на уловите");
      setCatchLogs([]);
    } finally {
      setLoadingCatchLogs(false);
    }
  };

  const loadGalleryPhotos = async () => {
    try {
      setLoadingGalleryPhotos(true);
      setGalleryPhotosError("");
      const data = await getAdminGalleryPhotos();
      setGalleryPhotos(data || []);
    } catch (error) {
      setGalleryPhotosError(error?.response?.data?.error || "Неуспешно зареждане на снимките от галерията");
      notifyError(error, "Неуспешно зареждане на снимките от галерията");
      setGalleryPhotos([]);
    } finally {
      setLoadingGalleryPhotos(false);
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
        error?.response?.data?.error || "Неуспешно зареждане на заявките за собственост",
      );
      notifyError(error, "Неуспешно зареждане на заявките за собственост");
      setOwnerClaimRequests([]);
    } finally {
      setLoadingOwnerClaims(false);
    }
  };

  const loadUserReports = async () => {
    try {
      setLoadingUserReports(true);
      setUserReportsError("");
      const data = await getAdminUserReports();
      setUserReports(Array.isArray(data) ? data : []);
    } catch (error) {
      setUserReportsError(error?.response?.data?.error || "Неуспешно зареждане на докладите");
      notifyError(error, "Неуспешно зареждане на докладите");
      setUserReports([]);
    } finally {
      setLoadingUserReports(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadWaterBodies();
    loadUsers();
    loadReviews();
    loadCatchLogs();
    loadGalleryPhotos();
    loadOwnerClaims();
    loadUserReports();
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

  const filteredCatchLogs = useMemo(() => {
    const query = catchSearch.trim().toLowerCase();
    if (!query) return catchLogs;
    return catchLogs.filter((item) =>
      [item.species, item.notes, item.lake_name, item.full_name, item.email, item.weight_kg, item.catch_time, item.created_at]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query),
    );
  }, [catchLogs, catchSearch]);

  const filteredGalleryPhotos = useMemo(() => {
    const query = photoSearch.trim().toLowerCase();
    if (!query) return galleryPhotos;
    return galleryPhotos.filter((item) =>
      [item.caption, item.image_url, item.lake_name, item.uploaded_by_name, item.uploaded_by_email, item.created_at]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query),
    );
  }, [galleryPhotos, photoSearch]);

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

  const filteredUserReports = useMemo(() => {
    const query = userReportSearch.trim().toLowerCase();

    return userReports.filter((item) => {
      const matchesSearch = [
        item.lake_name,
        item.reason,
        item.status,
        item.admin_note,
        item.reported_user_name,
        item.reported_user_email,
        item.reported_by_name,
        item.reported_by_email,
        item.species,
        item.catch_notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);

      const matchesStatus =
        userReportStatusFilter === "all"
          ? true
          : String(item.status || "pending") === userReportStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [userReports, userReportSearch, userReportStatusFilter]);

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
    setCatchLogsPage(1);
  }, [catchSearch, catchLogs.length]);

  useEffect(() => {
    setGalleryPhotosPage(1);
  }, [photoSearch, galleryPhotos.length]);

  useEffect(() => {
    setOwnerClaimsPage(1);
  }, [ownerClaimSearch, ownerClaimStatusFilter, ownerClaimRequests.length]);

  useEffect(() => {
    setUserReportsPage(1);
  }, [userReportSearch, userReportStatusFilter, userReports.length]);

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

  const paginatedCatchLogs = useMemo(
    () => paginateItems(filteredCatchLogs, catchLogsPage),
    [filteredCatchLogs, catchLogsPage],
  );

  const paginatedGalleryPhotos = useMemo(
    () => paginateItems(filteredGalleryPhotos, galleryPhotosPage),
    [filteredGalleryPhotos, galleryPhotosPage],
  );

  const paginatedOwnerClaims = useMemo(
    () => paginateItems(filteredOwnerClaims, ownerClaimsPage),
    [filteredOwnerClaims, ownerClaimsPage],
  );

  const paginatedUserReports = useMemo(
    () => paginateItems(filteredUserReports, userReportsPage),
    [filteredUserReports, userReportsPage],
  );

  const connectedOwnerStatuses = useMemo(
    () => analytics?.revenue?.connected_owner_statuses || [],
    [analytics?.revenue?.connected_owner_statuses],
  );

  const paginatedOwnerStatuses = useMemo(
    () => paginateItems(connectedOwnerStatuses, ownerStatusPage, OWNER_STATUS_PAGE_SIZE),
    [connectedOwnerStatuses, ownerStatusPage],
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

  const normalizeLakeType = (value) => {
    const raw = String(value || "reservoir").trim().toLowerCase();
    if (["reservoir", "dam", "язовир"].includes(raw)) return "reservoir";
    return "lake";
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

  const updateUserReportLocal = (reportId, field, value) => {
    setUserReports((prev) =>
      prev.map((item) => (item.id === reportId ? { ...item, [field]: value } : item)),
    );
  };

  const buildLakePayload = (lake) => ({
    name: String(lake.name || "").trim(),
    description: String(lake.description || "").trim(),
    type: normalizeLakeType(lake.type),
    is_private: Boolean(lake.is_private),
    owner_id: lake.owner_id || null,
    price_per_day: Number(lake.price_per_day || 0),
    capacity: Number(lake.capacity || 1),
    is_reservable: Boolean(lake.is_reservable),
  });

  const saveLake = async (lake, options = {}) => {
    const { successMessage = "Водоемът е обновен", showSuccessToast = true } = options;

    try {
      setSavingWaterBodyId(lake.id);

      await updateAdminWaterBody(lake.id, buildLakePayload(lake));

      if (showSuccessToast && successMessage) {
        notifySuccess(successMessage);
      }

      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на водоема");
    } finally {
      setSavingWaterBodyId("");
    }
  };

  const deleteLake = async (lakeId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този водоем? Това действие не може да бъде отменено.")) return;
    try {
      setDeletingId(lakeId);
      await deleteAdminWaterBody(lakeId);
      notifySuccess("Водоемът е изтрит");
      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на водоема");
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
        is_verified: Boolean(user.is_verified),
      };

      await updateAdminUser(user.id, payload);
      notifySuccess("Потребителят е обновен");
      await loadUsers();
      await loadWaterBodies();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на потребителя");
    } finally {
      setSavingUserId("");
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този потребител? Това действие не може да бъде отменено.")) return;
    try {
      setDeletingId(userId);
      await deleteAdminUser(userId);
      notifySuccess("Потребителят е изтрит");
      await loadUsers();
      await loadWaterBodies();
      await loadReviews();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на потребителя");
    } finally {
      setDeletingId("");
    }
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този отзив?")) return;
    try {
      setDeletingId(reviewId);
      await deleteAdminReview(reviewId);
      notifySuccess("Ревюто е изтрито");
      await loadReviews();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на ревюто");
    } finally {
      setDeletingId("");
    }
  };

  const deleteCatchLog = async (catchId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този запис за улов?")) return;
    try {
      setDeletingId(catchId);
      await deleteAdminCatchLog(catchId);
      notifySuccess("Записът за улов е изтрит");
      await loadCatchLogs();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на записа за улов");
    } finally {
      setDeletingId("");
    }
  };

  const deleteGalleryPhoto = async (photoId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете тази снимка?")) return;
    try {
      setDeletingId(photoId);
      await deleteAdminGalleryPhoto(photoId);
      notifySuccess("Снимката от галерията е изтрита");
      await loadGalleryPhotos();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на снимката от галерията");
    } finally {
      setDeletingId("");
    }
  };

  const toggleUserBan = async (user) => {
    await saveUser({ ...user, is_active: !user.is_active });
  };

  const reviewOwnerClaim = async (requestId, status) => {
    try {
      setSavingOwnerClaimId(requestId);

      const current = ownerClaimRequests.find((item) => item.id === requestId);

      await updateAdminOwnerClaimRequest(requestId, {
        status,
        admin_note: String(current?.admin_note || "").trim(),
      });

      notifySuccess(`Заявката е променена към ${status}`);
      await loadOwnerClaims();
      await loadWaterBodies();
      await loadUsers();
      await loadOverview();
    } catch (error) {
      notifyError(error, `Неуспешна промяна на заявката към ${status}`);
    } finally {
      setSavingOwnerClaimId("");
    }
  };

  const deleteOwnerClaim = async (requestId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете тази заявка за собственост?")) return;
    try {
      setDeletingId(requestId);
      await deleteAdminOwnerClaimRequest(requestId);
      notifySuccess("Заявката за собственост е премахната");
      await loadOwnerClaims();
      await loadOverview();
    } catch (error) {
      notifyError(error, "Неуспешно премахване на заявката за собственост");
    } finally {
      setDeletingId("");
    }
  };

  const reviewUserReport = async (reportId, status) => {
    try {
      setSavingUserReportId(reportId);
      const current = userReports.find((item) => item.id === reportId);
      await updateAdminUserReport(reportId, {
        status,
        admin_note: String(current?.admin_note || "").trim(),
      });
      notifySuccess("Докладът е обновен");
      await loadUserReports();
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на доклада");
    } finally {
      setSavingUserReportId("");
    }
  };

  const deleteUserReport = async (reportId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този доклад?")) return;
    try {
      setDeletingId(reportId);
      await deleteAdminUserReport(reportId);
      notifySuccess("Докладът е изтрит");
      await loadUserReports();
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на доклада");
    } finally {
      setDeletingId("");
    }
  };

  const renderError = (text, onRetry) => (
    <div className={ui.alertError}>
      <div>{text}</div>
      <ActionButton tone="neutral" onClick={onRetry}>
        Опитай отново
      </ActionButton>
    </div>
  );

  const pendingOwnerClaimsCount = Number(analytics?.totals?.pending_owner_claims || 0);
  const pendingUserReportsCount = userReports.filter((item) => String(item.status || "pending") === "pending").length;

  return (
    <div className={styles.page}>
      <PageContainer width="wide" className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            <FaShieldAlt />
            <span>Административен панел</span>
          </div>
          <h1 className={styles.heroTitle}>
            Административен панел
          </h1>
        </div>

        <div className={`${ui.tabRow} ${styles.adminTabRow}`}>
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<FaChartBar />}
          >
            Обобщение
          </TabButton>

          <TabButton
            active={activeTab === "water-bodies"}
            onClick={() => setActiveTab("water-bodies")}
            icon={<FaWater />}
          >
            Водоеми
          </TabButton>

          <TabButton
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            icon={<FaUsers />}
          >
            Потребители
          </TabButton>

          <TabButton
            active={activeTab === "reviews"}
            onClick={() => setActiveTab("reviews")}
            icon={<FaStar />}
          >
            Отзиви
          </TabButton>

          <TabButton
            active={activeTab === "catches"}
            onClick={() => setActiveTab("catches")}
            icon={<FaFish />}
          >
            Улови
          </TabButton>

          <TabButton
            active={activeTab === "gallery-photos"}
            onClick={() => setActiveTab("gallery-photos")}
            icon={<FaImages />}
          >
            Снимки в галерията
          </TabButton>

          <TabButton
            active={activeTab === "user-reports"}
            onClick={() => setActiveTab("user-reports")}
            icon={<FaFlag />}
            badge={pendingUserReportsCount > 0 ? pendingUserReportsCount : null}
          >
            Доклади
          </TabButton>

          <TabButton
            active={activeTab === "owner-claims"}
            onClick={() => setActiveTab("owner-claims")}
            icon={<FaFileAlt />}
            badge={pendingOwnerClaimsCount > 0 ? pendingOwnerClaimsCount : null}
          >
            Заявки за собственост
          </TabButton>
        </div>

        {activeTab === "overview" && (
          <div className={styles.overviewStack}>
            {overviewError ? (
              renderError(overviewError, loadOverview)
            ) : loadingOverview ? (
              <SectionLoadingState title="Зареждане на статистика..." subtitle="Подготвяме обобщените показатели за платформата." cards={3} rows={2} />
            ) : !analytics ? (
              <Card className={styles.card}>Няма налична статистика.</Card>
            ) : (
              <>
                <div className={styles.statsGrid}>
                  <StatCard label="Комисиони на платформата" value={formatCurrency(analytics.revenue?.platform_commissions || 0)} className={styles.statCard} />
                  <StatCard label="Обем на резервациите" value={formatCurrency(analytics.revenue?.total_reservation_volume || 0)} className={styles.statCard} />
                  <StatCard label="Активни потребители" value={analytics.totals?.active_users ?? 0} className={styles.statCard} />
                  <StatCard label="Чакащи заявки за собственост" value={analytics.totals?.pending_owner_claims ?? 0} className={styles.statCard} />
                </div>

                <div className={styles.overviewInfoGrid}>
                  {[
                    ["Общо потребители", analytics.totals?.users ?? 0, "Регистрирани профили в платформата."],
                    ["Резервации", analytics.totals?.reservations ?? 0, "Всички заявки за резервации, създадени от потребители."],
                    ["Валидни одобрени резервации", analytics.totals?.approved_reservations ?? 0, "Одобрени резервации, които все още не са минали."],
                    ["Чакащи резервации", analytics.totals?.pending_reservations ?? 0, "Резервации, които чакат действие от собственик или администратор."],
                    ["Приходи на собственици", formatCurrency(analytics.revenue?.owner_earnings || 0), "Сума, изпратена към свързаните профили на собственици."],
                    ["Стойност на започнати плащания", formatCurrency(analytics.revenue?.pending_checkout_volume || 0), "Започнати онлайн плащания, които още не са завършени."],
                    ["Платени онлайн плащания", analytics.revenue?.paid_payments_count ?? 0, "Успешни Stripe плащания за резервации."],
                    ["Чакащи заявки за собственост", analytics.totals?.pending_owner_claims ?? 0, "Заявки за собственост, които чакат преглед."],
                  ].map(([label, value, hint]) => (
                    <div key={label} className={styles.overviewInfoCard}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{hint}</small>
                    </div>
                  ))}
                </div>

                <Card className={styles.card}>
                  <SectionHeader
                    title="Stripe статуси на собственици"
                    subtitle="Свързани акаунти на собственици, използвани за изплащания по резервации."
                  />
                  {!analytics.revenue?.connected_owner_statuses?.length ? (
                    <div className={styles.muted}>Все още няма свързани акаунти на собственици.</div>
                  ) : (
                    <div className={styles.ownerStatusList}>
                      {paginatedOwnerStatuses.items.map((owner) => {
                        const ready = Boolean(owner.charges_enabled && owner.payouts_enabled);
                        return (
                          <div key={owner.owner_id} className={styles.ownerStatusRow}>
                            <div className={styles.ownerStatusMain}>
                              <FaPlug />
                              <div>
                                <strong>{owner.full_name || owner.email || "Собственик"}</strong>
                                <span>{owner.email || "Няма имейл"} · {owner.owned_lakes_count || 0} водоем(а)</span>
                              </div>
                            </div>
                            <div className={styles.ownerStatusPills}>
                              <span className={ready ? styles.statusGood : styles.statusWarn}>
                                {ready ? "Изплащанията са готови" : "Нужно е действие"}
                              </span>
                              <span>{getConnectStatusLabel(owner.connect_onboarding_status)}</span>
                              <span>Плащания: {owner.charges_enabled ? "активни" : "чакащи"}</span>
                              <span>Изплащания: {owner.payouts_enabled ? "активни" : "чакащи"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {connectedOwnerStatuses.length > OWNER_STATUS_PAGE_SIZE ? (
                    <Pagination
                      currentPage={paginatedOwnerStatuses.currentPage}
                      totalPages={paginatedOwnerStatuses.totalPages}
                      totalItems={paginatedOwnerStatuses.totalItems}
                      startIndex={paginatedOwnerStatuses.startIndex}
                      endIndex={paginatedOwnerStatuses.endIndex}
                      onPageChange={setOwnerStatusPage}
                    />
                  ) : null}
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === "water-bodies" && (
          <div ref={waterBodiesSectionRef} className={styles.card}>
            <SectionHeader
              title="Управление на водоемите"
              action={
                <SearchInput
                  value={lakeSearch}
                  onChange={(e) => setLakeSearch(e.target.value)}
                  placeholder="Търсене на водоеми..."
                />
              }
            />

            {waterBodiesError ? (
              renderError(waterBodiesError, loadWaterBodies)
            ) : loadingWaterBodies ? (
              <SectionLoadingState title="Зареждане на водоеми..." subtitle="Зареждаме списъка с водоеми и техните настройки." cards={2} rows={3} />
            ) : !filteredWaterBodies.length ? (
              <div className={styles.muted}>Няма намерени водоеми.</div>
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
                          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className={ui.fieldLabel}>
                            Име
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
                            Тип
                          </div>
                          <select
                            value={normalizeLakeType(lake.type)}
                            onChange={(e) => updateLakeLocal(lake.id, "type", e.target.value)}
                            className={styles.input}
                          >
                            <option value="reservoir">Язовир</option>
                            <option value="lake">Езеро</option>
                          </select>
                        </div>

                        {lake.owner_id ? (
                          <>
                            <div>
                              <div className={ui.fieldLabel}>
                                Цена на ден (€)
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
                              <div className={ui.helperText}>Показва се на потребителите като {formatCurrency(lake.price_per_day || 0)} на ден</div>
                            </div>

                            <div>
                              <div className={ui.fieldLabel}>
                                Капацитет
                              </div>
                              <input
                                type="number"
                                min="1"
                                value={Number(lake.capacity || 1)}
                                onChange={(e) => updateLakeLocal(lake.id, "capacity", e.target.value)}
                                className={styles.input}
                              />
                            </div>
                          </>
                        ) : null}

                        <div>
                          <div className={ui.fieldLabel}>
                            Режим на водоема
                          </div>
                          <select
                            value={getLakeMode(lake)}
                            onChange={async (e) => {
                              const nextLake = applyLakeMode(lake, e.target.value);
                              setWaterBodies((prev) =>
                                prev.map((item) => (item.id === lake.id ? nextLake : item)),
                              );
                              await saveLake(nextLake, {
                                successMessage: "Режимът на водоема е обновен",
                                showSuccessToast: true,
                              });
                            }}
                            className={styles.input}
                            disabled={savingWaterBodyId === lake.id}
                          >
                            <option value="public">Публичен</option>
                            <option value="private_not_reservable">
                              Частен, без резервации
                            </option>
                            <option value="private_reservable">
                              Частен, с резервации
                            </option>
                          </select>

                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Собственик
                          </div>
                          <select
                            value={lake.owner_id || ""}
                            onChange={(e) =>
                              updateLakeLocal(lake.id, "owner_id", e.target.value || null)
                            }
                            className={styles.input}
                          >
                            <option value="">Без собственик</option>
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
                          Описание
                        </div>
                        <textarea
                          rows={3}
                          value={lake.description || ""}
                          onChange={(e) => updateLakeLocal(lake.id, "description", e.target.value)}
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
                          Собственик:{" "}
                          {lake.owner_name
                            ? `${lake.owner_name} (${lake.owner_email})`
                            : "Без собственик"}
                        </div>

                        <div className={ui.buttonRow}>
                          <ActionButton
                            type="button"
                            disabled={savingWaterBodyId === lake.id}
                            onClick={() => saveLake(lake)}
                            tone="primary"
                          >
                            <FaSave className={ui.buttonIcon} />
                            {savingWaterBodyId === lake.id ? "Запазване..." : "Запази"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            disabled={deletingId === lake.id}
                            onClick={() => deleteLake(lake.id)}
                            tone="danger"
                          >
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === lake.id ? "Изтриване..." : "Изтрий"}
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
              title="Управление на потребители"
              action={
                <SearchInput
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Търсене на потребители..."
                />
              }
            />

            {usersError ? (
              renderError(usersError, loadUsers)
            ) : loadingUsers ? (
              <SectionLoadingState title="Зареждане на потребители..." subtitle="Зареждаме профилите и техните роли." cards={2} rows={3} />
            ) : !filteredUsers.length ? (
              <div className={styles.muted}>Няма намерени потребители.</div>
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
                          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className={ui.fieldLabel}>
                            Име и фамилия
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
                            Имейл
                          </div>
                          <input
                            type="email"
                            value={user.email || ""}
                            className={styles.input}
                            disabled
                            readOnly
                            title="Имейл адресите не могат да се променят от админ панела."
                            style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
                          />
                          <div className={ui.metaText} style={{ marginTop: 6 }}>
                            Имейлът е заключен и не може да се редактира от администратори.
                          </div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Роля
                          </div>
                          <select
                            value={user.role || "user"}
                            onChange={(e) => updateUserLocal(user.id, "role", e.target.value)}
                            className={styles.input}
                          >
                            <option value="user">Потребител</option>
                            <option value="owner">Собственик</option>
                            <option value="admin">Администратор</option>
                          </select>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Статус
                          </div>
                          <div
                            className={styles.input}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              background: user.is_active ? "#f0fdf4" : "#fef2f2",
                              color: user.is_active ? "#166534" : "#991b1b",
                              fontWeight: 700,
                            }}
                          >
                            {user.is_active ? "Активен" : "Блокиран"}
                          </div>
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
                          Създаден: {formatDateTime(user.created_at)} | Потвърден: {user.is_verified ? "Да" : "Не"}
                        </div>

                        <div className={ui.buttonRow}>
                          <ActionButton
                            type="button"
                            disabled={savingUserId === user.id}
                            onClick={() => saveUser(user)}
                            tone="neutral"
                          >
                            <FaSave className={ui.buttonIcon} />
                            {savingUserId === user.id ? "Запазване..." : "Запази"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            disabled={savingUserId === user.id}
                            onClick={() => toggleUserBan(user)}
                            tone={user.is_active ? "danger" : "neutral"}
                          >
                            {user.is_active ? "Блокирай потребителя" : "Отблокирай потребителя"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            disabled={deletingId === user.id}
                            onClick={() => deleteUser(user.id)}
                            tone="danger"
                          >
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === user.id ? "Изтриване..." : "Изтрий"}
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
              title="Управление на отзиви"
              action={
                <SearchInput
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Търсене на отзиви..."
                />
              }
            />

            {reviewsError ? (
              renderError(reviewsError, loadReviews)
            ) : loadingReviews ? (
              <SectionLoadingState title="Зареждане на отзиви..." subtitle="Зареждаме публикуваните оценки и коментари." cards={2} rows={3} />
            ) : !filteredReviews.length ? (
              <div className={styles.muted}>Няма намерени отзиви.</div>
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
                            {review.full_name || "Неизвестен потребител"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            {review.email || "Няма имейл"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 4,
                            }}
                          >
                            Водоем: {review.lake_name || "Неизвестен водоем"}
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
                        {review.comment || "Няма добавен коментар."}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <ActionButton
                          type="button"
                          disabled={deletingId === review.id}
                          onClick={() => deleteReview(review.id)}
                          tone="danger"
                        >
                          <FaTrash className={ui.buttonIcon} />
                          {deletingId === review.id ? "Изтриване..." : "Изтрий отзива"}
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


        {activeTab === "catches" && (
          <div ref={catchLogsSectionRef} className={styles.card}>
            <SectionHeader
              title="Модериране на улови"
              action={
                <SearchInput
                  value={catchSearch}
                  onChange={(e) => setCatchSearch(e.target.value)}
                  placeholder="Търсене по потребител, имейл, водоем, вид, бележки..."
                />
              }
            />

            <div className={styles.muted} style={{ marginBottom: 12 }}>
              Търсенето поддържа име на потребител, имейл, водоем, вид, бележки, тегло и дата.
            </div>

            {catchLogsError ? (
              renderError(catchLogsError, loadCatchLogs)
            ) : loadingCatchLogs ? (
              <SectionLoadingState title="Зареждане на улови..." subtitle="Зареждаме потребителските записи и снимки на улови." cards={2} rows={3} />
            ) : !filteredCatchLogs.length ? (
              <div className={styles.muted}>Няма намерени улови.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12 }}>
                  {paginatedCatchLogs.items.map((item) => {
                    const imageUrl = item.image_url ? getUploadUrl(item.image_url) : null;
                    return (
                      <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "#fff", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "120px 1fr auto", gap: 12, alignItems: "start" }}>
                        {imageUrl ? (
                          <ZoomableImage src={imageUrl} alt={item.species || "Снимка на улова"} imageClassName={styles.adminThumb} />
                        ) : (
                          <div className={styles.adminThumbPlaceholder}><FaFish /></div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{item.species || "Неизвестен вид"} · {item.weight_kg ?? "-"} кг</div>
                          <div className={ui.metaText}>Водоем: {item.lake_name || "Неизвестен водоем"}</div>
                          <div className={ui.metaText}>Потребител: {item.full_name || "Неизвестен потребител"} {item.email ? `(${item.email})` : ""}</div>
                          <div className={ui.metaText}>Създаден: {formatDateTime(item.catch_time || item.created_at)}</div>
                          {item.notes ? <div style={{ marginTop: 8, color: "#334155", lineHeight: 1.5 }}>{item.notes}</div> : null}
                        </div>
                        <div className={ui.buttonRow}>
                          <ActionButton type="button" disabled={deletingId === item.id} onClick={() => deleteCatchLog(item.id)} tone="danger">
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === item.id ? "Изтриване..." : "Изтрий"}
                          </ActionButton>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={paginatedCatchLogs.currentPage}
                  totalPages={paginatedCatchLogs.totalPages}
                  totalItems={paginatedCatchLogs.totalItems}
                  startIndex={paginatedCatchLogs.startIndex}
                  endIndex={paginatedCatchLogs.endIndex}
                  onPageChange={(page) => {
                    setCatchLogsPage(page);
                    scrollToSectionTop(catchLogsSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "gallery-photos" && (
          <div ref={galleryPhotosSectionRef} className={styles.card}>
            <SectionHeader
              title="Модериране на снимки от галерията"
              action={
                <SearchInput
                  value={photoSearch}
                  onChange={(e) => setPhotoSearch(e.target.value)}
                  placeholder="Търсене по водоем, качил потребител, имейл, описание..."
                />
              }
            />

            <div className={styles.muted} style={{ marginBottom: 12 }}>
              Търсенето поддържа име на водоем, име и имейл на качилия потребител, описание, път до файла и дата.
            </div>

            {galleryPhotosError ? (
              renderError(galleryPhotosError, loadGalleryPhotos)
            ) : loadingGalleryPhotos ? (
              <SectionLoadingState title="Зареждане на снимки..." subtitle="Зареждаме качените изображения от галериите." cards={2} rows={2} />
            ) : !filteredGalleryPhotos.length ? (
              <div className={styles.muted}>Няма намерени снимки в галерията.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                  {paginatedGalleryPhotos.items.map((photo) => {
                    const imageUrl = photo.image_url ? getUploadUrl(photo.image_url) : null;
                    return (
                      <div key={photo.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#fff", position: "relative" }}>
                        <button
                          type="button"
                          disabled={deletingId === photo.id}
                          onClick={() => deleteGalleryPhoto(photo.id)}
                          title="Изтрий снимката"
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            zIndex: 2,
                            border: 0,
                            borderRadius: 999,
                            background: "rgba(220, 38, 38, 0.92)",
                            color: "white",
                            width: 36,
                            height: 36,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: deletingId === photo.id ? "not-allowed" : "pointer",
                            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.22)",
                          }}
                        >
                          <FaTrash />
                        </button>
                        {imageUrl ? (
                          <ZoomableImage src={imageUrl} alt={photo.caption || "Снимка от галерията"} imageClassName={styles.adminPhoto} />
                        ) : null}
                        <div style={{ padding: 12, display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{photo.caption || "Снимка на водоема"}</div>
                          <div className={ui.metaText}>Водоем: {photo.lake_name || "Неизвестен водоем"}</div>
                          <div className={ui.metaText}>Качено от: {photo.uploaded_by_name || "Неизвестно"}</div>
                          <div className={ui.metaText}>{formatDateTime(photo.created_at)}</div>
                          <ActionButton type="button" disabled={deletingId === photo.id} onClick={() => deleteGalleryPhoto(photo.id)} tone="danger">
                            <FaTrash className={ui.buttonIcon} />
                            {deletingId === photo.id ? "Изтриване..." : "Изтрий снимката"}
                          </ActionButton>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={paginatedGalleryPhotos.currentPage}
                  totalPages={paginatedGalleryPhotos.totalPages}
                  totalItems={paginatedGalleryPhotos.totalItems}
                  startIndex={paginatedGalleryPhotos.startIndex}
                  endIndex={paginatedGalleryPhotos.endIndex}
                  onPageChange={(page) => {
                    setGalleryPhotosPage(page);
                    scrollToSectionTop(galleryPhotosSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "user-reports" && (
          <div ref={userReportsSectionRef} className={styles.card}>
            <SectionHeader
              title={`Доклади за потребители${pendingUserReportsCount > 0 ? ` (${pendingUserReportsCount})` : ""}`}
              action={
                <SearchInput
                  value={userReportSearch}
                  onChange={(e) => setUserReportSearch(e.target.value)}
                  placeholder="Търсене по водоем, потребител, собственик, причина..."
                />
              }
            />

            <div className={ui.filterRow}>
              {[{ key: "pending", label: "Чакащи" }, { key: "reviewed", label: "Прегледани" }, { key: "resolved", label: "Решени" }, { key: "dismissed", label: "Отхвърлени" }, { key: "all", label: "Всички" }].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setUserReportStatusFilter(filter.key)}
                  className={[ui.filterButton, userReportStatusFilter === filter.key ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {userReportsError ? (
              renderError(userReportsError, loadUserReports)
            ) : loadingUserReports ? (
              <SectionLoadingState title="Зареждане на доклади..." subtitle="Зареждаме подадените сигнали от собственици." cards={2} rows={2} />
            ) : !filteredUserReports.length ? (
              <div className={styles.muted}>Няма намерени доклади.</div>
            ) : (
              <>
                <div className={styles.reportsGrid}>
                  {paginatedUserReports.items.map((report) => {
                    const imageUrl = report.catch_image_url ? getUploadUrl(report.catch_image_url) : null;
                    return (
                      <article key={report.id} className={styles.reportCard}>
                        <div className={styles.reportHeader}>
                          <div>
                            <strong className={styles.reportTitle}>{report.lake_name || "Неизвестен водоем"}</strong>
                            <div className={ui.metaText}>Докладван потребител: {report.reported_user_name || "Неизвестен"} · {report.reported_user_email || "няма имейл"}</div>
                            <div className={ui.metaText}>Докладван от собственик: {report.reported_by_name || "Неизвестен"} · {report.reported_by_email || "няма имейл"}</div>
                          </div>
                          <StatusBadge status={report.status || "pending"} />
                        </div>

                        <div className={styles.reportContent}>
                          {imageUrl ? (
                            <div className={styles.reportImageWrap}>
                              <ZoomableImage src={imageUrl} alt={report.species || "Снимка от докладван улов"} imageClassName={styles.reportImage} />
                            </div>
                          ) : null}

                          <div className={styles.reportDetails}>
                            <div className={styles.reportMetaGrid}>
                              <span>Дата: {formatDateTime(report.created_at)}</span>
                              <span>Улов: {report.species || "неизвестен вид"}{report.weight_kg ? ` · ${report.weight_kg} кг` : ""}</span>
                              {report.catch_time ? <span>Час на улова: {formatDateTime(report.catch_time)}</span> : null}
                            </div>
                            <div><strong>Причина:</strong> {report.reason || "Няма посочена причина"}</div>
                            {report.catch_notes ? <div className={ui.metaText}>Бележка към улова: {report.catch_notes}</div> : null}
                          </div>
                        </div>

                        <label className={styles.reportNoteLabel}>
                          <span className={ui.metaText}>Бележка на администратора</span>
                          <textarea
                            value={report.admin_note || ""}
                            onChange={(e) => updateUserReportLocal(report.id, "admin_note", e.target.value)}
                            rows={2}
                            className={styles.reportTextarea}
                          />
                        </label>

                        <div className={styles.reportActions}>
                          <ActionButton type="button" disabled={savingUserReportId === report.id} onClick={() => reviewUserReport(report.id, "reviewed")} tone="neutral">
                            Прегледан
                          </ActionButton>
                          <ActionButton type="button" disabled={savingUserReportId === report.id} onClick={() => reviewUserReport(report.id, "resolved")} tone="primary">
                            Решен
                          </ActionButton>
                          <ActionButton type="button" disabled={savingUserReportId === report.id} onClick={() => reviewUserReport(report.id, "dismissed")} tone="neutral">
                            Отхвърли
                          </ActionButton>
                          {report.catch_id ? (
                            <ActionButton type="button" disabled={deletingId === report.catch_id} onClick={() => deleteCatchLog(report.catch_id)} tone="danger">
                              <FaTrash className={ui.buttonIcon} />
                              Премахни улова
                            </ActionButton>
                          ) : null}
                          <ActionButton type="button" disabled={deletingId === report.id} onClick={() => deleteUserReport(report.id)} tone="danger">
                            <FaTrash className={ui.buttonIcon} />
                            Изтрий доклада
                          </ActionButton>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={paginatedUserReports.currentPage}
                  totalPages={paginatedUserReports.totalPages}
                  totalItems={paginatedUserReports.totalItems}
                  startIndex={paginatedUserReports.startIndex}
                  endIndex={paginatedUserReports.endIndex}
                  onPageChange={(page) => {
                    setUserReportsPage(page);
                    scrollToSectionTop(userReportsSectionRef);
                  }}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "owner-claims" && (
          <div ref={ownerClaimsSectionRef} className={styles.card}>
            <SectionHeader
              title={`Заявки за верификация на собственост${pendingOwnerClaimsCount > 0 ? ` (${pendingOwnerClaimsCount})` : ""}`}
              action={
                <SearchInput
                  value={ownerClaimSearch}
                  onChange={(e) => setOwnerClaimSearch(e.target.value)}
                  placeholder="Търсене в заявки за собственост..."
                />
              }
            />

            <div className={ui.filterRow}>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("all")}
                className={[ui.filterButton, ownerClaimStatusFilter === "all" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Всички
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("pending")}
                className={[ui.filterButton, ownerClaimStatusFilter === "pending" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Чакащи
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("approved")}
                className={[ui.filterButton, ownerClaimStatusFilter === "approved" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Одобрени
              </button>
              <button
                type="button"
                onClick={() => setOwnerClaimStatusFilter("rejected")}
                className={[ui.filterButton, ownerClaimStatusFilter === "rejected" ? ui.filterButtonActive : ""].filter(Boolean).join(" ")}
              >
                Отхвърлени
              </button>
            </div>

            {ownerClaimsError ? (
              renderError(ownerClaimsError, loadOwnerClaims)
            ) : loadingOwnerClaims ? (
              <SectionLoadingState title="Зареждане на заявки за собственост..." subtitle="Зареждаме чакащите и обработените заявки." cards={2} rows={3} />
            ) : !filteredOwnerClaims.length ? (
              <div className={styles.muted}>Няма намерени заявки за собственост.</div>
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
                            {item.lake_name || "Неизвестен водоем"}
                          </div>
                          <div style={{ fontSize: 14, color: "#334155" }}>
                            {item.full_name} ({item.email})
                          </div>
                          <div className={ui.metaText}>
                            Телефон: {item.phone || "Не е предоставено"}
                          </div>
                          <div className={ui.metaText}>
                            Фирма: {item.company_name || "Не е предоставено"}
                          </div>
                          <div className={ui.metaText}>
                            Изпратена: {formatDateTime(item.created_at)}
                          </div>
                          {item.reviewed_at ? (
                            <div className={ui.metaText}>
                              Прегледана: {formatDateTime(item.reviewed_at)}
                            </div>
                          ) : null}
                        </div>

                        <StatusBadge status={item.status} />
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        <div>
                          <div className={ui.fieldLabel}>
                            Съобщение към заявката
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
                            {item.message || "Няма предоставено съобщение."}
                          </div>
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Документ за доказване
                          </div>
                          {item.proof_document_url ? (
                            <a
                              href={getUploadUrl(item.proof_document_url)}
                              target="_blank"
                              rel="noreferrer"
                              className={ui.inlineLink}
                            >
                              <FaFileAlt />
                              Отвори документа
                            </a>
                          ) : (
                            <div className={styles.muted}>Няма качен документ.</div>
                          )}
                        </div>

                        <div>
                          <div className={ui.fieldLabel}>
                            Бележка от администратор
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
                          Прегледано от: {item.reviewed_by_name || "Все още не е прегледано"}
                        </div>

                        <div className={ui.buttonRow}>
                          {item.status !== "approved" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "approved")}
                              tone="success"
                            >
                              {savingOwnerClaimId === item.id ? "Запазване..." : "Одобри"}
                            </ActionButton>
                          ) : null}

                          {item.status !== "rejected" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "rejected")}
                              tone="danger"
                            >
                              {savingOwnerClaimId === item.id ? "Запазване..." : "Отхвърли"}
                            </ActionButton>
                          ) : null}

                          {item.status !== "pending" ? (
                            <ActionButton
                              type="button"
                              disabled={savingOwnerClaimId === item.id}
                              onClick={() => reviewOwnerClaim(item.id, "pending")}
                              tone="warning"
                            >
                              {savingOwnerClaimId === item.id ? "Запазване..." : "Върни към чакащи"}
                            </ActionButton>
                          ) : null}

                          {item.status === "rejected" ? (
                            <ActionButton
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => deleteOwnerClaim(item.id)}
                              tone="neutral"
                            >
                              {deletingId === item.id ? "Премахване..." : "Скрий отхвърленото"}
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