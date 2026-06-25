import React, { useEffect, useState } from "react";
import {FaChartLine, FaExternalLinkAlt, FaMoneyBillWave, FaPlug, FaUserCog} from "react-icons/fa";
import {
  addBlockedDate,
  createLakeRoom,
  deleteBlockedDate,
  deleteLakePhoto,
  deleteLakeRoom,
  deleteOwnerCatchPhoto,
  getOwnerLakeCatches,
  getOwnerLakeReservations,
  getOwnerLakeSpotAvailability,
  getOwnerLakeEarnings,
  reportOwnerLakeCatch,
  getBlockedDates,
  getLakePhotos,
  getLakeRooms,
  getLakeSpots,
  getOwnerLakes,
  syncLakeSpots,
  updateLakeRoom,
  updateLakeSpot,
  updateOwnerLake,
  uploadLakePhoto,
} from "../api/ownerApi";
import { getOwnerBillingStatus, getOwnerRevenueSummary } from "../api/billingApi";
import { updateReservationStatus } from "../api/reservationsApi";
import OwnerProLockedCard from "../components/common/OwnerProLockedCard";
import { notifyError, notifySuccess } from "../ui/toast";
import { formatCurrency } from "../utils/formatCurrency";
import DatePicker from "../components/ui/DatePicker";
import ZoomableImage from "../components/ui/ZoomableImage";
import styles from "./OwnerPanel.module.css";

const DEFAULT_ROOM_FORM = {
  name: "",
  capacity: 1,
  price_per_night: 0,
  is_active: true,
  sort_order: 0,
};

const SPOTS_PAGE_SIZE = 12;
const BILLING_TRANSACTIONS_PAGE_SIZE = 8;
const MONTHLY_REPORTS_PAGE_SIZE = 4;

const getUploadUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:/i.test(imageUrl) || imageUrl.startsWith("blob:")) return imageUrl;
  return `http://localhost:5000/uploads/${imageUrl}`;
};

const parseMoneyInput = (value) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

const normalizeLakeType = (value) => {
  const raw = String(value || "lake").trim().toLowerCase();
  if (["reservoir", "dam", "язовир"].includes(raw)) return "reservoir";
  return "lake";
};

const formatLakeType = (value) => {
  return normalizeLakeType(value) === "reservoir" ? "Язовир" : "Езеро";
};

const TAB_ITEMS = [
  { key: "overview", label: "Обзор" },
  { key: "reservations", label: "Резервации" },
  { key: "spots", label: "Риболовни места" },
  { key: "rooms", label: "Настаняване / стаи" },
  { key: "gallery", label: "Галерия и медия" },
  { key: "blocked", label: "Блокирани дати" },
  { key: "billing", label: "Плащания и приходи" },
];

const normalizeLakePayload = (lake) => ({
  name: lake.name,
  description: lake.description || "",
  type: lake.type || "",
  is_private: Boolean(lake.is_private),
  price_per_day: Number(lake.price_per_day || 0),
  capacity: Number(lake.capacity || 1),
  spots_count: Number(lake.spots_count || 0),
  is_reservable: Boolean(lake.is_reservable),
  allows_night_fishing: Boolean(lake.allows_night_fishing),
  night_fishing_price: Boolean(lake.allows_night_fishing)
    ? Number(lake.night_fishing_price || 0)
    : 0,
  has_housing: Boolean(lake.has_housing),
});

const formatDate = (value) => {
  if (!value) return "Неизвестна дата";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "Неизвестен час";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("bg-BG");
};


const translateMonthLabel = (label = "") => {
  return String(label)
    .replace(/January/g,"Януари")
    .replace(/February/g,"Февруари")
    .replace(/March/g,"Март")
    .replace(/April/g,"Април")
    .replace(/May/g,"Май")
    .replace(/June/g,"Юни")
    .replace(/July/g,"Юли")
    .replace(/August/g,"Август")
    .replace(/September/g,"Септември")
    .replace(/October/g,"Октомври")
    .replace(/November/g,"Ноември")
    .replace(/December/g,"Декември");
};

const escapeReportHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const buildMonthlyReportHtml = (lake, report) => {
  const monthLabel = translateMonthLabel(report?.month_label || report?.month_key || "месец");
  const generatedAt = new Date().toLocaleString("bg-BG");
  const totalRevenue = Number(report?.total_revenue || 0);
  const platformFee = Number(report?.platform_fee || 0);
  const ownerEarnings = Number(report?.owner_earnings || 0);
  const paidReservations = Number(report?.paid_reservations || 0);
  const averageReservation = paidReservations > 0 ? totalRevenue / paidReservations : 0;
  const commissionPercent = totalRevenue > 0 ? (platformFee / totalRevenue) * 100 : 0;

  return `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <title>Месечен отчет - ${escapeReportHtml(monthLabel)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f7; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 32px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12); }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding: 24px; border-radius: 22px; color: #fff; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 16px; background: rgba(255,255,255,0.14); font-size: 26px; font-weight: 800; }
    .brand h1 { margin: 0; font-size: 25px; letter-spacing: -0.02em; }
    .brand p { margin: 4px 0 0; opacity: 0.84; font-size: 13px; }
    .report-meta { text-align: right; font-size: 13px; line-height: 1.6; opacity: 0.95; }
    .section { margin-top: 24px; }
    .section-title { margin: 0 0 12px; font-size: 16px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.06em; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .info-box, .summary-card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; background: #f8fafc; }
    .label { margin: 0 0 5px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { margin: 0; font-size: 17px; font-weight: 700; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-card { min-height: 100px; background: #fff; }
    .summary-card.important { background: #eff6ff; border-color: #bfdbfe; }
    .summary-card .amount { margin: 8px 0 0; font-size: 21px; font-weight: 800; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; border: 1px solid #e2e8f0; }
    th { background: #1e3a8a; color: #fff; padding: 13px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 13px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    tr:last-child td { border-bottom: 0; }
    .right { text-align: right; }
    .note { margin-top: 24px; padding: 16px 18px; border-left: 4px solid #2563eb; border-radius: 14px; background: #eff6ff; color: #1e3a8a; line-height: 1.5; font-size: 13px; }
    .footer { margin-top: 34px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 16px; color: #64748b; font-size: 12px; }
    .actions { position: fixed; top: 18px; right: 18px; display: flex; gap: 10px; }
    .actions button { border: 0; border-radius: 999px; padding: 10px 16px; color: #fff; background: #1d4ed8; cursor: pointer; font-weight: 700; box-shadow: 0 8px 18px rgba(29, 78, 216, 0.25); }
    @media print { body { background: #fff; } .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; } .actions { display: none; } }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Принтирай / Запази като PDF</button></div>
  <main class="page">
    <header class="header">
      <div class="brand">
        <div class="logo">₣</div>
        <div>
          <h1>Fishing Platform</h1>
          <p>Месечен отчет за приходи на собственик</p>
        </div>
      </div>
      <div class="report-meta">
        <strong>Owner Revenue Statement</strong><br />
        Период: ${escapeReportHtml(monthLabel)}<br />
        Генериран: ${escapeReportHtml(generatedAt)}
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">Информация за отчета</h2>
      <div class="info-grid">
        <div class="info-box">
          <p class="label">Водоем</p>
          <p class="value">${escapeReportHtml(lake?.name || "Неизвестен водоем")}</p>
        </div>
        <div class="info-box">
          <p class="label">Период</p>
          <p class="value">${escapeReportHtml(monthLabel)}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Финансово обобщение</h2>
      <div class="summary-grid">
        <div class="summary-card"><p class="label">Общи приходи</p><p class="amount">${escapeReportHtml(formatCurrency(totalRevenue))}</p></div>
        <div class="summary-card"><p class="label">Комисиона</p><p class="amount">${escapeReportHtml(formatCurrency(platformFee))}</p></div>
        <div class="summary-card important"><p class="label">Приход за собственика</p><p class="amount">${escapeReportHtml(formatCurrency(ownerEarnings))}</p></div>
        <div class="summary-card"><p class="label">Платени резервации</p><p class="amount">${paidReservations}</p></div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Детайли</h2>
      <table>
        <thead>
          <tr><th>Показател</th><th class="right">Стойност</th></tr>
        </thead>
        <tbody>
          <tr><td>Обща стойност на платените резервации</td><td class="right">${escapeReportHtml(formatCurrency(totalRevenue))}</td></tr>
          <tr><td>Комисиона на платформата</td><td class="right">${escapeReportHtml(formatCurrency(platformFee))}</td></tr>
          <tr><td>Нетен приход за собственика</td><td class="right">${escapeReportHtml(formatCurrency(ownerEarnings))}</td></tr>
          <tr><td>Средна стойност на резервация</td><td class="right">${escapeReportHtml(formatCurrency(averageReservation))}</td></tr>
          <tr><td>Процент комисиона</td><td class="right">${commissionPercent.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    </section>

    <div class="note">
      Този отчет е автоматично генериран от системата и служи за справка на собственика.
      Официалните данъчни и банкови документи се управляват в Stripe Connect акаунта.
    </div>

    <footer class="footer">
      <span>Fishing Platform · Автоматично генериран отчет</span>
      <span>${escapeReportHtml(monthLabel)}</span>
    </footer>
  </main>
</body>
</html>`;
};

const downloadMonthlyReportNote = (lake, report) => {
  const html = buildMonthlyReportHtml(lake, report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `monthly-earnings-report-${report?.month_key || "report"}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const isReservationPast = (reservation) => {
  const departure = String(reservation?.departure_date || reservation?.end_date || reservation?.start_date || reservation?.reservation_date || "").slice(0, 10);
  return Boolean(departure && departure < getTodayDateString());
};

const getReservedSpotNumbers = (item) => (
  Array.isArray(item?.spot_numbers)
    ? item.spot_numbers.filter((value) => value !== null && value !== undefined)
    : []
);

const formatReservedSpots = (item) => {
  const numbers = getReservedSpotNumbers(item);
  if (numbers.length) return `${numbers.length} избрани`;
  const count = Number(item?.requested_spots || item?.people_count || 1);
  return `${count} заявени`;
};


const getStatusLabel = (status) => ({
  pending: "Чакаща",
  approved: "Одобрена",
  approved_waiting_payment: "Одобрена, чака плащане",
  rejected: "Отхвърлена",
  cancelled: "Отказана",
  canceled: "Отказана",
  all: "Всички",
  paid: "Платено",
  checkout_started: "Плащането е започнато",
  free: "Свободно",
  reserved: "Заето",
}[String(status || "").toLowerCase()] || status || "Неизвестно");

const getOnboardingStatusLabel = (status) => ({
  not_started: "Не е започната",
  pending: "Чакаща",
  completed: "Завършена",
  restricted: "Ограничена",
  active: "Активна",
}[String(status || "").toLowerCase()] || status || "Не е започната");

const getReservationPaymentLabel = (reservation) => {
  if (reservation?.payment_status === "paid") return "Платено";
  if (reservation?.status === "approved_waiting_payment") return "Очаква плащане от потребителя";
  if (reservation?.payment_status === "checkout_started") return "Плащането е започнато";
  return reservation?.payment_required ? "Изисква се плащане" : "Ръчно / неплатено";
};

function ReservedSpotsBadge({ reservation }) {
  const numbers = getReservedSpotNumbers(reservation);

  return (
    <span className={`${styles.mutedBadge} ${styles.reservationSpotBadge}`}>
      <span>Запазени места: {formatReservedSpots(reservation)}</span>
      {numbers.length ? (
        <details className={styles.reservationSpotDetails}>
          <summary>Виж номерата на местата</summary>
          <span className={styles.reservationSpotList}>
            {numbers.map((value) => (
              <span key={value} className={styles.reservationSpotPill}>
                Място {value}
              </span>
            ))}
          </span>
        </details>
      ) : null}
    </span>
  );
}

const OWNER_RESERVATION_FILTERS = ["pending", "approved_waiting_payment", "approved", "rejected", "cancelled", "all"];

const getLakeModeLabel = (lake) => {
  if (lake.is_private && lake.is_reservable) return "Частен и с резервации";
  if (lake.is_private) return "Частен";
  if (lake.is_reservable) return "Приема резервации";
  return "Публичен";
};

const getTabDescription = (tabKey) => {
  if (tabKey === "overview") {
    return "Управлявайте основните настройки, правилата за резервации и цените на водоема от едно място.";
  }
  if (tabKey === "reservations") {
    return "Преглеждайте заявки за резервации и проверявайте наличността за избрани дати.";
  }
  if (tabKey === "spots") {
    return "Създавайте и управлявайте отделни риболовни места за този водоем.";
  }
  if (tabKey === "rooms") {
    return "Създавайте опции за настаняване като къщи или бунгала за гости.";
  }
  if (tabKey === "gallery") {
    return "Качвайте и управлявайте медията, която се показва за този водоем.";
  }
  if (tabKey === "blocked") {
    return "Предотвратете резервации за дати, запазени за поддръжка, събития или частно ползване.";
  }
  return "Следете приходи от водоема, такси на платформата, печалба на собственика, месечни отчети и готовност за Stripe изплащания.";
};

const LabeledInput = ({ label, children, hint }) => (
  <div>
    <div className={styles.fieldLabel}>{label}</div>
    {children}
    {hint ? <div className={styles.fieldHint}>{hint}</div> : null}
  </div>
);

const SectionCard = ({ title, subtitle, actions, children }) => (
  <section className={styles.sectionCard}>
    <div className={styles.sectionCardHeader}>
      <div>
        <h4 className={styles.subsectionTitle}>{title}</h4>
        {subtitle ? <div className={styles.sectionSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={styles.sectionCardActions}>{actions}</div> : null}
    </div>
    {children}
  </section>
);

export default function OwnerPanel() {
  const [lakes, setLakes] = useState([]);
  const [blockedDatesByLake, setBlockedDatesByLake] = useState({});
  const [blockedDateInputs, setBlockedDateInputs] = useState({});
  const [blockedEndDateInputs, setBlockedEndDateInputs] = useState({});
  const [blockedReasonInputs, setBlockedReasonInputs] = useState({});
  const [spotsByLake, setSpotsByLake] = useState({});
  const [roomsByLake, setRoomsByLake] = useState({});
  const [photosByLake, setPhotosByLake] = useState({});
  const [catchPhotosByLake, setCatchPhotosByLake] = useState({});
  const [reservationsByLake, setReservationsByLake] = useState({});
  const [earningsByLake, setEarningsByLake] = useState({});
  const [reservationFilterByLake, setReservationFilterByLake] = useState({});
  const [spotAvailabilityDateByLake, setSpotAvailabilityDateByLake] = useState({});
  const [spotAvailabilityByLake, setSpotAvailabilityByLake] = useState({});
  const [newRoomByLake, setNewRoomByLake] = useState({});
  const [photoFilesByLake, setPhotoFilesByLake] = useState({});
  const [photoCaptionsByLake, setPhotoCaptionsByLake] = useState({});
  const [photoPreviewsByLake, setPhotoPreviewsByLake] = useState({});
  const [activeTabByLake, setActiveTabByLake] = useState({});
  const [roomModalByLake, setRoomModalByLake] = useState({});
  const [roomDraftByLake, setRoomDraftByLake] = useState({});
  const [spotPageByLake, setSpotPageByLake] = useState({});
  const [billingTransactionPageByLake, setBillingTransactionPageByLake] = useState({});
  const [monthlyReportPageByLake, setMonthlyReportPageByLake] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [busyLakeId, setBusyLakeId] = useState("");
  const [ownerBilling, setOwnerBilling] = useState(null);
  const [ownerRevenue, setOwnerRevenue] = useState(null);

  const loadOwnerPanel = async () => {
    try {
      setLoading(true);
      const [owned, billingStatus, revenueSummary] = await Promise.all([
        getOwnerLakes(),
        getOwnerBillingStatus().catch(() => null),
        getOwnerRevenueSummary().catch(() => null),
      ]);
      const normalizedLakes = Array.isArray(owned) ? owned : [];
      setLakes(normalizedLakes);
      setOwnerBilling(billingStatus);
      setOwnerRevenue(revenueSummary);

      const [blockedEntries, spotEntries, roomEntries, photoEntries, catchPhotoEntries, reservationEntries, earningsEntries] = await Promise.all([
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getBlockedDates(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakeSpots(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakeRooms(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getLakePhotos(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeCatches(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeReservations(lake.id).catch(() => []),
          ])
        ),
        Promise.all(
          normalizedLakes.map(async (lake) => [
            lake.id,
            await getOwnerLakeEarnings(lake.id).catch(() => null),
          ])
        ),
      ]);

      setBlockedDatesByLake(Object.fromEntries(blockedEntries));
      setSpotsByLake(Object.fromEntries(spotEntries));
      setRoomsByLake(Object.fromEntries(roomEntries));
      setPhotosByLake(Object.fromEntries(photoEntries));
      setCatchPhotosByLake(Object.fromEntries(catchPhotoEntries));
      setReservationsByLake(Object.fromEntries(reservationEntries));
      setEarningsByLake(Object.fromEntries(earningsEntries));
      setNewRoomByLake(
        Object.fromEntries(
          normalizedLakes.map((lake) => [lake.id, { ...DEFAULT_ROOM_FORM }])
        )
      );
      const params = new URLSearchParams(window.location.search);
      const shouldOpenBilling = ["success", "cancelled"].includes(params.get("checkout")) ||
        ["return", "refresh"].includes(params.get("connect"));

      setActiveTabByLake(
        Object.fromEntries(normalizedLakes.map((lake, index) => [
          lake.id,
          shouldOpenBilling && index === 0 ? "billing" : "overview",
        ]))
      );

      if (shouldOpenBilling) {
        if (params.get("checkout") === "success") {
          notifySuccess("Настройката за изплащания е обновена.");
        }
        if (params.get("connect") === "return") {
          notifySuccess("Stripe Connect настройката се върна. Обновете статуса, за да потвърдите последното състояние.");
        }
        if (params.get("connect") === "refresh") {
          notifyError("Връзката за Stripe регистрация е изтекла. Стартирайте настройката отново.");
        }
        window.history.replaceState({}, "", "/owner");
      }
      setSpotPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setBillingTransactionPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setMonthlyReportPageByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, 1]))
      );
      setReservationFilterByLake(
        Object.fromEntries(normalizedLakes.map((lake) => [lake.id, "pending"]))
      );
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на водоемите на собственика");
      setLakes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerPanel();
  }, []);

  const updateLocalLake = (lakeId, field, value) => {
    if (field === "has_housing" && !value) {
      setActiveTabByLake((current) => ({
        ...current,
        [lakeId]: current[lakeId] === "rooms" ? "overview" : current[lakeId] || "overview",
      }));
    }

    setLakes((prev) =>
      prev.map((lake) => {
        if (lake.id !== lakeId) {
          return lake;
        }

        if (field === "allows_night_fishing") {
          return {
            ...lake,
            allows_night_fishing: value,
            night_fishing_price: value ? lake.night_fishing_price || 0 : 0,
          };
        }

        return { ...lake, [field]: value };
      })
    );
  };

  const updateNestedItem = (setter, lakeId, itemId, field, value) => {
    setter((prev) => ({
      ...prev,
      [lakeId]: (prev[lakeId] || []).map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSaveLake = async (lake) => {
    if (lake.allows_night_fishing && Number(lake.night_fishing_price || 0) <= 0) {
      notifyError(null, "Добавете валидна цена за нощен риболов преди запазване");
      return;
    }

    try {
      setSavingId(lake.id);
      const updatedLake = await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      setLakes((prev) =>
        prev.map((item) => (item.id === lake.id ? { ...item, ...updatedLake } : item))
      );
      notifySuccess("Настройките на водоема са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на настройките на водоема");
    } finally {
      setSavingId("");
    }
  };

  const handleAddBlockedDate = async (lakeId) => {
    const start_date = blockedDateInputs[lakeId] || "";
    const end_date = blockedEndDateInputs[lakeId] || start_date || "";
    const reason = blockedReasonInputs[lakeId] || "";

    if (!start_date || !end_date) {
      notifyError(null, "Първо изберете начална и крайна дата");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const savedBlockedDates = await addBlockedDate(lakeId, { start_date, end_date, reason });
      const nextItems = Array.isArray(savedBlockedDates) ? savedBlockedDates : [savedBlockedDates];
      setBlockedDatesByLake((prev) => ({
        ...prev,
        [lakeId]: [...(prev[lakeId] || []), ...nextItems]
          .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
          .sort((a, b) => String(a.blocked_date).localeCompare(String(b.blocked_date))),
      }));
      setBlockedDateInputs((prev) => ({ ...prev, [lakeId]: "" }));
      setBlockedEndDateInputs((prev) => ({ ...prev, [lakeId]: "" }));
      setBlockedReasonInputs((prev) => ({ ...prev, [lakeId]: "" }));
      notifySuccess("Диапазонът от блокирани дати е запазен");
    } catch (error) {
      notifyError(error, "Неуспешно запазване на блокираните дати");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteBlockedDate = async (lakeId, blockedDateId) => {
    if (!window.confirm("Сигурни ли сте, че искате да премахнете тази блокирана дата?")) return;
    try {
      setBusyLakeId(lakeId);
      await deleteBlockedDate(lakeId, blockedDateId);
      setBlockedDatesByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== blockedDateId),
      }));
      notifySuccess("Блокираната дата е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на блокираната дата");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleGenerateSpots = async (lake) => {
    const spotsCount = Number(lake.spots_count || 0);

    if (!Number.isInteger(spotsCount) || spotsCount < 0) {
      notifyError(null, "Броят места трябва да е 0 или повече");
      return;
    }

    try {
      setBusyLakeId(lake.id);
      await updateOwnerLake(lake.id, normalizeLakePayload(lake));
      const synced = await syncLakeSpots(lake.id, spotsCount);

      setSpotsByLake((prev) => ({
        ...prev,
        [lake.id]: Array.isArray(synced) ? synced : [],
      }));
      setSpotPageByLake((prev) => ({ ...prev, [lake.id]: 1 }));

      setLakes((prev) =>
        prev.map((item) =>
          item.id === lake.id ? { ...item, spots_count: spotsCount } : item
        )
      );

      notifySuccess("Риболовните места са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно генериране на риболовни места");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleToggleSpotActive = async (lakeId, spot) => {
    try {
      setBusyLakeId(lakeId);
      const updated = await updateLakeSpot(lakeId, spot.id, {
        is_active: !spot.is_active,
      });

      setSpotsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).map((item) =>
          item.id === spot.id ? updated : item
        ),
      }));

      notifySuccess("Мястото е обновено");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на мястото");
    } finally {
      setBusyLakeId("");
    }
  };

  const openCreateRoomModal = (lakeId) => {
    setRoomDraftByLake((prev) => ({
      ...prev,
      [lakeId]: { ...(newRoomByLake[lakeId] || DEFAULT_ROOM_FORM) },
    }));
    setRoomModalByLake((prev) => ({ ...prev, [lakeId]: true }));
  };

  const closeRoomModal = (lakeId) => {
    setRoomModalByLake((prev) => ({ ...prev, [lakeId]: false }));
  };

  const handleRoomDraftChange = (lakeId, field, value) => {
    setRoomDraftByLake((prev) => ({
      ...prev,
      [lakeId]: {
        ...(prev[lakeId] || DEFAULT_ROOM_FORM),
        [field]: value,
      },
    }));
  };

  const handleCreateRoom = async (lakeId) => {
    const payload = roomDraftByLake[lakeId] || newRoomByLake[lakeId] || DEFAULT_ROOM_FORM;

    if (!String(payload.name || "").trim()) {
      notifyError(null, "Първо добавете име на стая");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const created = await createLakeRoom(lakeId, payload);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: [...(prev[lakeId] || []), created],
      }));
      setNewRoomByLake((prev) => ({
        ...prev,
        [lakeId]: { ...DEFAULT_ROOM_FORM },
      }));
      setRoomDraftByLake((prev) => ({
        ...prev,
        [lakeId]: { ...DEFAULT_ROOM_FORM },
      }));
      setRoomModalByLake((prev) => ({ ...prev, [lakeId]: false }));
      notifySuccess("Стаята е добавена");
    } catch (error) {
      notifyError(error, "Неуспешно създаване на стая");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleSaveRoom = async (lakeId, room) => {
    try {
      setBusyLakeId(lakeId);
      const updated = await updateLakeRoom(lakeId, room.id, room);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).map((item) =>
          item.id === room.id ? updated : item
        ),
      }));
      notifySuccess("Стаята е обновена");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на стаята");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteRoom = async (lakeId, roomId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете тази стая?")) return;
    try {
      setBusyLakeId(lakeId);
      await deleteLakeRoom(lakeId, roomId);
      setRoomsByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== roomId),
      }));
      notifySuccess("Стаята е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на стаята");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleRemoveSelectedPhoto = (lakeId, index) => {
    if (!window.confirm("Сигурни ли сте, че искате да премахнете избраната снимка?")) return;
    setPhotoFilesByLake((prev) => {
      const current = [...(prev[lakeId] || [])];
      current.splice(index, 1);
      return { ...prev, [lakeId]: current };
    });
    setPhotoCaptionsByLake((prev) => {
      const current = [...(prev[lakeId] || [])];
      current.splice(index, 1);
      return { ...prev, [lakeId]: current };
    });
    setPhotoPreviewsByLake((prev) => {
      const current = [...(prev[lakeId] || [])];
      const [removed] = current.splice(index, 1);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return { ...prev, [lakeId]: current };
    });
  };

  const handleClearSelectedPhotos = (lakeId) => {
    if (!window.confirm("Сигурни ли сте, че искате да изчистите всички избрани снимки?")) return;
    (photoPreviewsByLake[lakeId] || []).forEach((preview) => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    });
    setPhotoFilesByLake((prev) => ({ ...prev, [lakeId]: [] }));
    setPhotoCaptionsByLake((prev) => ({ ...prev, [lakeId]: [] }));
    setPhotoPreviewsByLake((prev) => ({ ...prev, [lakeId]: [] }));
  };

  const handleUploadPhoto = async (lakeId) => {
    const files = photoFilesByLake[lakeId] || [];

    if (!files.length) {
      notifyError(null, "Първо избери поне една снимка");
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const captions = photoCaptionsByLake[lakeId] || [];
      files.forEach((_, index) => formData.append("captions", captions[index] || ""));
      const result = await uploadLakePhoto(lakeId, formData);
      const uploadedItems = Array.isArray(result?.uploaded) ? result.uploaded : [];
      const failedItems = Array.isArray(result?.failed) ? result.failed : [];
      setPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: [...uploadedItems, ...(prev[lakeId] || [])],
      }));
      setPhotoFilesByLake((prev) => ({ ...prev, [lakeId]: [] }));
      setPhotoCaptionsByLake((prev) => ({ ...prev, [lakeId]: [] }));
      setPhotoPreviewsByLake((prev) => ({ ...prev, [lakeId]: [] }));
      if (failedItems.length) {
        notifySuccess(`${uploadedItems.length} качени, ${failedItems.length} неуспешни`);
      } else {
        notifySuccess(uploadedItems.length > 1 ? "Снимките на водоема са качени" : "Снимката на водоема е качена");
      }
    } catch (error) {
      notifyError(error, "Неуспешно качване на снимка");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeletePhoto = async (lakeId, photoId) => {
    if (!window.confirm("Сигурни ли сте, че искате да премахнете тази снимка от галерията?")) return;
    try {
      setBusyLakeId(lakeId);
      await deleteLakePhoto(lakeId, photoId);
      setPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== photoId),
      }));
      notifySuccess("Снимката е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно изтриване на снимка");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleDeleteCatchPhoto = async (lakeId, catchId) => {
    if (!window.confirm("Сигурни ли сте, че искате да премахнете снимката към този улов?")) return;
    try {
      setBusyLakeId(lakeId);
      await deleteOwnerCatchPhoto(lakeId, catchId);
      setCatchPhotosByLake((prev) => ({
        ...prev,
        [lakeId]: (prev[lakeId] || []).filter((item) => item.id !== catchId),
      }));
      notifySuccess("Снимката към улова на потребителя е премахната");
    } catch (error) {
      notifyError(error, "Неуспешно премахване на снимката към улова на потребителя");
    } finally {
      setBusyLakeId("");
    }
  };


  const refreshOwnerLakeReservations = async (lakeId) => {
    const reservations = await getOwnerLakeReservations(lakeId).catch(() => []);
    setReservationsByLake((prev) => ({ ...prev, [lakeId]: reservations }));
  };

  const handleUpdateReservationStatus = async (lakeId, reservationId, status) => {
    try {
      setBusyLakeId(lakeId);
      await updateReservationStatus(reservationId, status);
      notifySuccess("Резервацията е обновена");
      await refreshOwnerLakeReservations(lakeId);
      const selectedDate = spotAvailabilityDateByLake[lakeId];
      if (selectedDate) {
        const availability = await getOwnerLakeSpotAvailability(lakeId, selectedDate).catch(() => null);
        setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: availability }));
      }
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на резервацията");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleLoadSpotAvailability = async (lakeId, date) => {
    const nextDate = String(date || "").trim();
    setSpotAvailabilityDateByLake((prev) => ({ ...prev, [lakeId]: nextDate }));
    if (!nextDate) {
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: null }));
      return;
    }

    try {
      setBusyLakeId(lakeId);
      const availability = await getOwnerLakeSpotAvailability(lakeId, nextDate);
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: availability }));
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на наличност на местата");
      setSpotAvailabilityByLake((prev) => ({ ...prev, [lakeId]: null }));
    } finally {
      setBusyLakeId("");
    }
  };

  const hasOwnerPro = true;

  const goToOwnerBilling = () => {
    setActiveTabByLake((prev) => {
      const firstLakeId = lakes[0]?.id;
      return firstLakeId ? { ...prev, [firstLakeId]: "billing" } : prev;
    });
  };

  const renderOwnerProLock = ({ title, message, bullets, compact = false } = {}) => (
    <OwnerProLockedCard
      title={title}
      message={message}
      bullets={bullets}
      compact={compact}
      onUpgrade={goToOwnerBilling}
    />
  );

  const handleReportCatchUser = async (lakeId, catchItem) => {
    const reason = window.prompt("Защо искате да докладвате този потребител или снимка на улов?");
    if (!reason || !reason.trim()) return;

    try {
      setBusyLakeId(lakeId);
      await reportOwnerLakeCatch(lakeId, catchItem.id, { reason: reason.trim() });
      notifySuccess("Сигналът е изпратен до администратор");
    } catch (error) {
      notifyError(error, "Неуспешно докладване на потребителя");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleRefreshLakeEarnings = async (lakeId) => {
    try {
      setBusyLakeId(lakeId);
      const earnings = await getOwnerLakeEarnings(lakeId);
      setEarningsByLake((prev) => ({ ...prev, [lakeId]: earnings }));
      setBillingTransactionPageByLake((prev) => ({ ...prev, [lakeId]: 1 }));
      setMonthlyReportPageByLake((prev) => ({ ...prev, [lakeId]: 1 }));
      const revenueSummary = await getOwnerRevenueSummary().catch(() => null);
      if (revenueSummary) setOwnerRevenue(revenueSummary);
      notifySuccess("Приходите са обновени");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на приходите");
    } finally {
      setBusyLakeId("");
    }
  };

  const handleOwnerConnect = async (action) => {
    try {
      setBusyLakeId("billing-action");
      const billingApi = await import("../api/billingApi");
      if (action === "refresh") {
        const [state, revenueSummary] = await Promise.all([
          billingApi.refreshOwnerConnectStatus(),
          billingApi.getOwnerRevenueSummary().catch(() => null),
        ]);
        setOwnerBilling(state);
        if (revenueSummary) setOwnerRevenue(revenueSummary);
        notifySuccess("Статусът за изплащания е обновен");
        return;
      }
      if (action === "portal") {
        const data = await billingApi.openOwnerConnectDashboard();
        if (data?.url) window.location.href = data.url;
        return;
      }
      if (action === "upgrade") {
        setActiveTabByLake((prev) => {
          const firstLakeId = lakes[0]?.id;
          return firstLakeId ? { ...prev, [firstLakeId]: "billing" } : prev;
        });
        return;
      }
      const data = await billingApi.startOwnerConnectOnboarding();
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      notifyError(error, "Неуспешно действие за плащания");
    } finally {
      setBusyLakeId("");
    }
  };


  if (loading) {
    return <div className={styles.loading}>Зареждане на панела на собственика...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>
            <FaUserCog />
            <span>Панел на собственика</span>
          </div>
          <h2 className={styles.heroTitle}>Панел на собственика</h2>
        </div>

        {!lakes.length ? (
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Все още няма одобрени водоеми</h3>
            <div className={styles.emptyState}>
              След като администратор одобри заявката Ви за собственост, Вашите водоеми ще
              се появят тук.
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            {lakes.map((lake) => {
              const activeTab = activeTabByLake[lake.id] || "overview";
              const spotCount = spotsByLake[lake.id]?.length || 0;
              const roomCount = roomsByLake[lake.id]?.length || 0;
              const photoCount = photosByLake[lake.id]?.length || 0;
              const blockedCount = blockedDatesByLake[lake.id]?.length || 0;
              const ownerReservations = reservationsByLake[lake.id] || [];
              const pendingReservationCount = ownerReservations.filter((item) => item.status === "pending").length;
              const activeReservationFilter = reservationFilterByLake[lake.id] || "pending";
              const filteredOwnerReservations = activeReservationFilter === "all"
                ? ownerReservations
                : ownerReservations.filter((item) => item.status === activeReservationFilter);
              const selectedAvailabilityDate = spotAvailabilityDateByLake[lake.id] || "";
              const spotAvailability = spotAvailabilityByLake[lake.id] || null;
              const roomModalOpen = Boolean(roomModalByLake[lake.id]);
              const roomDraft = roomDraftByLake[lake.id] || DEFAULT_ROOM_FORM;
              const sortedSpots = [...(spotsByLake[lake.id] || [])].sort(
                (a, b) => Number(a.spot_number) - Number(b.spot_number)
              );
              const spotTotalPages = Math.max(1, Math.ceil(sortedSpots.length / SPOTS_PAGE_SIZE));
              const spotPage = Math.min(spotPageByLake[lake.id] || 1, spotTotalPages);
              const lakeEarnings = earningsByLake[lake.id] || {};
              const currentMonth = lakeEarnings.current_month || {};
              const monthlyReports = Array.isArray(lakeEarnings.monthly_reports) ? lakeEarnings.monthly_reports : [];
              const billingTransactions = Array.isArray(lakeEarnings.transactions) ? lakeEarnings.transactions : [];
              const monthlyReportTotalPages = Math.max(1, Math.ceil(monthlyReports.length / MONTHLY_REPORTS_PAGE_SIZE));
              const monthlyReportPage = Math.min(monthlyReportPageByLake[lake.id] || 1, monthlyReportTotalPages);
              const visibleMonthlyReports = monthlyReports.slice(
                (monthlyReportPage - 1) * MONTHLY_REPORTS_PAGE_SIZE,
                monthlyReportPage * MONTHLY_REPORTS_PAGE_SIZE
              );
              const billingTransactionTotalPages = Math.max(1, Math.ceil(billingTransactions.length / BILLING_TRANSACTIONS_PAGE_SIZE));
              const billingTransactionPage = Math.min(billingTransactionPageByLake[lake.id] || 1, billingTransactionTotalPages);
              const visibleBillingTransactions = billingTransactions.slice(
                (billingTransactionPage - 1) * BILLING_TRANSACTIONS_PAGE_SIZE,
                billingTransactionPage * BILLING_TRANSACTIONS_PAGE_SIZE
              );
              const payoutStatus = ownerBilling?.connect_ready ? "Свързан" : (ownerBilling?.stripe_connected_account_id ? "Ограничен" : "Не е настроен");
              const visibleSpots = sortedSpots.slice(
                (spotPage - 1) * SPOTS_PAGE_SIZE,
                spotPage * SPOTS_PAGE_SIZE
              );

              return (
                <article key={lake.id} className={styles.lakeCard}>
                  <div className={styles.lakeHeader}>
                    <div className={styles.lakeHeaderMain}>
                      <div className={styles.titleRow}>
                        <h3 className={styles.lakeTitle}>{lake.name}</h3>
                        <span className={styles.modeBadge}>{getLakeModeLabel(lake)}</span>
                        {lake.allows_night_fishing ? (
                          <span className={styles.successBadge}>Нощен риболов</span>
                        ) : null}
                        {lake.has_housing ? (
                          <span className={styles.warningBadge}>Настаняване</span>
                        ) : null}
                      </div>

                      <div className={styles.metaText}>
                        {formatLakeType(lake.type)} · {formatCurrency(lake.price_per_day || 0)} на ден · резервен капацитет {lake.capacity || 1}
                      </div>
                    </div>

                    <div className={styles.headerMetrics}>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Места</span>
                        <span className={styles.metricValue}>{spotCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Стаи</span>
                        <span className={styles.metricValue}>{roomCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Снимки</span>
                        <span className={styles.metricValue}>{photoCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Чакащи</span>
                        <span className={styles.metricValue}>{pendingReservationCount}</span>
                      </div>
                      <div className={styles.metricPill}>
                        <span className={styles.metricLabel}>Блокирани</span>
                        <span className={styles.metricValue}>{blockedCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.tabBar}>
                    {TAB_ITEMS.filter((tab) => lake.has_housing || tab.key !== "rooms").map(
                      (tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={
                            activeTab === tab.key ? styles.tabButtonActive : styles.tabButton
                          }
                          onClick={() =>
                            setActiveTabByLake((prev) => ({ ...prev, [lake.id]: tab.key }))
                          }
                        >
                          <span>{tab.label}</span>
                          {tab.key === "reservations" && pendingReservationCount ? (
                            <span className={styles.tabBadge}>{pendingReservationCount > 99 ? "99+" : pendingReservationCount}</span>
                          ) : null}
                        </button>
                      )
                    )}
                  </div>

                  <div className={styles.tabPanelIntro}>{getTabDescription(activeTab)}</div>

                  {!hasOwnerPro ? (
                    <div className={styles.ownerProNotice}>
                      <div>
                        <strong>Модел на комисиона</strong>
                        <span> Собствениците не плащат месечен абонамент. Онлайн плащанията изискват завършена Stripe настройка за изплащания.</span>
                      </div>
                      <button type="button" onClick={goToOwnerBilling}>Надгради</button>
                    </div>
                  ) : null}

                  <div className={styles.lakeSections}>
                    {activeTab === "overview" ? (
                      <>
                        {!hasOwnerPro ? (
                          <SectionCard
                            title="Бизнес инструменти за собственици"
                            subtitle="Тези инструменти използват модела с комисиона вместо абонамент за собственик."
                          >
                            <div className={styles.ownerProLockGrid}>
                              {renderOwnerProLock({
                                title: "Анализ на приходите",
                                message: "Отключете графики за приходи, анализ на резервациите и табло за печалбите за този водоем.",
                                bullets: ["Графики за приходи", "Анализ на резервациите", "Табло за печалбите"],
                                compact: true,
                              })}
                              {renderOwnerProLock({
                                title: "Онлайн платени резервации",
                                message: "Подгответе този водоем за платени резервации чрез Stripe и бъдещо автоматично разпределяне на плащанията.",
                                bullets: ["Онлайн плащане", "Проследяване на статус на плащане", "Поддръжка на комисиона за платформата"],
                                compact: true,
                              })}
                            </div>
                          </SectionCard>
                        ) : (
                          <SectionCard
                            title="Бизнес инструменти за собственици"
                            subtitle="Собственическите инструменти са активни за този водоем."
                          >
                            <div className={styles.ownerProActiveGrid}>
                              <div className={styles.ownerProActiveTile}>
                                <FaChartLine />
                                <div>
                                  <strong>Анализите на приходите са активни</strong>
                                  <span>Таблата за резервации и приходи са готови за следващия етап с плащания.</span>
                                </div>
                              </div>
                              <div className={styles.ownerProActiveTile}>
                                <FaMoneyBillWave />
                                <div>
                                  <strong>Основата за платени резервации е активна</strong>
                                  <span>Този водоем може да използва Stripe плащане за резервации след завършване на настройката за изплащания.</span>
                                </div>
                              </div>
                            </div>
                          </SectionCard>
                        )}

                        <SectionCard
                          title="Настройки за резервации"
                          subtitle="Основни настройки за резервации, нощен риболов и настаняване."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={savingId === lake.id}
                              onClick={() => handleSaveLake(lake)}
                            >
                              {savingId === lake.id ? "Запазване..." : "Запази промените"}
                            </button>
                          }
                        >
                          <div className={styles.settingsGrid}>
                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.is_private)}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "is_private", event.target.checked)
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Частен водоем</div>
                                <div className={styles.settingText}>
                                  Ограничава водоема като частен управляван обект.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.is_reservable)}
                                onChange={(event) =>
                                  updateLocalLake(
                                    lake.id,
                                    "is_reservable",
                                    event.target.checked
                                  )
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Приема резервации</div>
                                <div className={styles.settingText}>
                                  Позволява на потребителите да изпращат заявки за резервация. Собственикът може да включи тази опция за назначен частен водоем.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.allows_night_fishing)}
                                onChange={(event) =>
                                  updateLocalLake(
                                    lake.id,
                                    "allows_night_fishing",
                                    event.target.checked
                                  )
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Нощен риболов</div>
                                <div className={styles.settingText}>
                                  Показва отделна цена за нощен риболов само когато опцията е включена.
                                </div>
                              </div>
                            </label>

                            <label className={styles.settingTile}>
                              <input
                                type="checkbox"
                                checked={Boolean(lake.has_housing)}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "has_housing", event.target.checked)
                                }
                              />
                              <div>
                                <div className={styles.settingTitle}>Настаняване / стаи</div>
                                <div className={styles.settingText}>
                                  Активира настаняването и отделния раздел за стаи.
                                </div>
                              </div>
                            </label>
                          </div>

                          {lake.allows_night_fishing ? (
                            <div className={styles.revealCard}>
                              <div className={styles.revealTitle}>Цена за нощен риболов</div>
                              <div className={styles.formGrid}>
                                <LabeledInput
                                  label="Цена за нощен риболов (€)"
                                  hint="Задължително поле, когато нощният риболов е активиран."
                                >
                                  <input
                                    className={styles.input}
                                    type="text"
                                    inputMode="decimal"
                                    value={lake.night_fishing_price ?? 0}
                                    onChange={(event) =>
                                      updateLocalLake(
                                        lake.id,
                                        "night_fishing_price",
                                        parseMoneyInput(event.target.value)
                                      )
                                    }
                                  />
                                </LabeledInput>
                              </div>
                            </div>
                          ) : null}
                        </SectionCard>

                        <SectionCard
                          title="Преглед на водоема"
                          subtitle="Основна публична информация и резервни данни за ценообразуване."
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Име на водоема">
                              <input
                                className={styles.input}
                                type="text"
                                value={lake.name || ""}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "name", event.target.value)
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Тип">
                              <input
                                className={styles.input}
                                type="text"
                                value={formatLakeType(lake.type)}
                                readOnly
                                aria-readonly="true"
                              />
                            </LabeledInput>

                            <LabeledInput label="Цена на ден (€)">
                              <input
                                className={styles.input}
                                type="text"
                                inputMode="decimal"
                                value={lake.price_per_day ?? 0}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "price_per_day", parseMoneyInput(event.target.value))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Капацитет">
                              <input
                                className={styles.input}
                                type="number"
                                min="1"
                                step="1"
                                value={lake.capacity ?? 1}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "capacity", event.target.value)
                                }
                              />
                            </LabeledInput>
                          </div>

                          <div className={styles.formStack}>
                            <LabeledInput label="Описание">
                              <textarea
                                className={styles.textarea}
                                rows={5}
                                value={lake.description || ""}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "description", event.target.value)
                                }
                              />
                            </LabeledInput>

                          </div>
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "reservations" ? (
                      <>
                        {!hasOwnerPro ? (
                          renderOwnerProLock({
                            title: "Онлайн плащания за резервации",
                            message: "Собствениците могат да преглеждат ръчни заявки. Онлайн платените резервации изискват завършена настройка за Stripe изплащания.",
                            bullets: ["Платена резервация", "Подготовка за изплащания", "Проследяване на приходи"],
                          })
                        ) : null}

                        <SectionCard
                          title="Заявки за резервации"
                          subtitle="Одобрявайте, отказвайте или връщайте заявки в чакащ статус. Завършените Stripe настройки позволяват платени резервации за потребителя."
                        >
                          <div className={styles.filterRow}>
                            {OWNER_RESERVATION_FILTERS.map((filter) => (
                              <button
                                key={filter}
                                type="button"
                                className={
                                  activeReservationFilter === filter
                                    ? styles.filterButtonActive
                                    : styles.filterButton
                                }
                                onClick={() =>
                                  setReservationFilterByLake((prev) => ({
                                    ...prev,
                                    [lake.id]: filter,
                                  }))
                                }
                              >
                                {getStatusLabel(filter)}
                              </button>
                            ))}
                          </div>

                          {!filteredOwnerReservations.length ? (
                            <div className={styles.emptyState}>Няма резервации с този статус.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {filteredOwnerReservations.map((reservation) => (
                                <div key={reservation.id} className={styles.itemCardCompact} style={{ alignItems: "flex-start" }}>
                                  <div className={styles.ownerReservationDetails}>
                                    <div className={styles.itemTitle}>{reservation.lake_name || lake.name}</div>
                                    <div className={styles.metaText}>
                                      Потребител: {reservation.full_name || "Неизвестен"}{reservation.email ? ` (${reservation.email})` : ""}
                                    </div>
                                    <div className={styles.metaText}>
                                      Престой: {formatDate(reservation.arrival_date || reservation.start_date)} → {formatDate(reservation.departure_date || reservation.end_date)}
                                    </div>
                                    <div className={styles.ownerReservationBadges}>
                                      <span className={styles.mutedBadge}>Създадена: {formatDateTime(reservation.created_at)}</span>
                                      <ReservedSpotsBadge reservation={reservation} />
                                      <span className={styles.mutedBadge}>Дни за риболов: {(reservation.fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Нощен риболов: {(reservation.night_fishing_dates || []).length || 0}</span>
                                      <span className={styles.mutedBadge}>Стаи: {(reservation.room_names || []).length ? reservation.room_names.join(", ") : "Няма"}</span>
                                      <span className={styles.mutedBadge}>Общо: {formatCurrency(reservation.total_amount || 0)}</span>
                                      <span className={styles.mutedBadge}>Плащане: {getReservationPaymentLabel(reservation)}</span>
                                      <span className={styles.mutedBadge}>Комисиона на платформата: {formatCurrency(reservation.platform_fee_amount || 0)}</span>
                                      <span className={styles.mutedBadge}>Сума за собственика: {formatCurrency(reservation.owner_amount || 0)}</span>
                                    </div>
                                    <div className={styles.metaText} style={{ marginTop: "10px" }}>
                                      Бележки: {reservation.notes || "Няма бележки"}
                                    </div>
                                  </div>

                                  <div className={styles.ownerReservationActions}>
                                    <span className={
                                      reservation.status === "approved"
                                        ? styles.successBadge
                                        : reservation.status === "pending" || reservation.status === "approved_waiting_payment"
                                          ? styles.warningBadge
                                          : styles.mutedBadge
                                    }>
                                      {getStatusLabel(reservation.status || "pending")}
                                    </span>
                                    {isReservationPast(reservation) ? (
                                      <span className={styles.mutedBadge}>Минала резервация</span>
                                    ) : (
                                      <div className={styles.ownerReservationButtonRow}>
                                        {reservation.payment_status === "paid" ? (
                                          <span className={styles.successBadge}>Платено</span>
                                        ) : reservation.status === "pending" ? (
                                          <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "approved")}
                                          >
                                            Одобри / заяви плащане
                                          </button>
                                        ) : reservation.status === "approved_waiting_payment" ? (
                                          <span className={styles.warningBadge}>Изчаква плащане</span>
                                        ) : null}

                                        {reservation.payment_status !== "paid" && reservation.status !== "rejected" && reservation.status !== "cancelled" ? (
                                          <button
                                            type="button"
                                            className={styles.dangerButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "rejected")}
                                          >
                                            Отхвърли
                                          </button>
                                        ) : null}

                                        {reservation.payment_status !== "paid" && reservation.status !== "pending" && reservation.status !== "cancelled" ? (
                                          <button
                                            type="button"
                                            className={styles.filterButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleUpdateReservationStatus(lake.id, reservation.id, "pending")}
                                          >
                                            Маркирай като чакаща
                                          </button>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </SectionCard>

                        <SectionCard
                          title="Наличност на местата по дата"
                          subtitle="Изберете дата, за да видите кои номерирани места са свободни, чакащи, одобрени, блокирани или неактивни."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={!selectedAvailabilityDate || busyLakeId === lake.id}
                              onClick={() => handleLoadSpotAvailability(lake.id, selectedAvailabilityDate)}
                            >
                              Обнови
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Дата за проверка">
                              <DatePicker
                                value={selectedAvailabilityDate}
                                onChange={(nextValue) => handleLoadSpotAvailability(lake.id, nextValue)}
                              />
                            </LabeledInput>
                          </div>

                          {!selectedAvailabilityDate ? (
                            <div className={styles.emptyState}>Изберете дата, за да проверите наличността на местата.</div>
                          ) : !spotAvailability ? (
                            <div className={styles.emptyState}>Все още няма заредена наличност за тази дата.</div>
                          ) : (
                            <>
                              {spotAvailability.blocked ? (
                                <div className={styles.emptyState} style={{ marginBottom: "12px" }}>
                                  Тази дата е блокирана{spotAvailability.blocked.reason ? `: ${spotAvailability.blocked.reason}` : "."}
                                </div>
                              ) : null}
                              <div className={styles.spotGrid}>
                                {(spotAvailability.spots || []).map((spot) => {
                                  const status = String(spot.status || "free");
                                  const badgeClass = status === "free"
                                    ? styles.successBadge
                                    : status === "pending"
                                      ? styles.warningBadge
                                      : styles.mutedBadge;
                                  return (
                                    <div key={spot.id} className={styles.spotCard}>
                                      <div className={styles.spotCardHeader}>
                                        <div>
                                          <div className={styles.itemTitle}>Място {spot.spot_number}</div>
                                          <div className={styles.metaText}>
                                            {spot.user_name ? `${spot.user_name}${spot.user_email ? ` (${spot.user_email})` : ""}` : status === "free" ? "Свободно" : getStatusLabel(status)}
                                          </div>
                                        </div>
                                        <span className={badgeClass}>{getStatusLabel(status)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {Array.isArray(spotAvailability.capacity_reservations) && spotAvailability.capacity_reservations.length ? (
                                <div className={styles.emptyState} style={{ marginTop: "12px" }}>
                                  Има {spotAvailability.capacity_reservations.length} резервации по капацитет без конкретни номера на места за тази дата.
                                </div>
                              ) : null}
                            </>
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "spots" ? (
                      <>
                        <SectionCard
                          title="Настройки на местата"
                          subtitle="Задайте желания брой риболовни места и обновете генерирания списък."
                          actions={
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleGenerateSpots(lake)}
                            >
                              {busyLakeId === lake.id ? "Обновяване..." : "Генерирай / обнови местата"}
                            </button>
                          }
                        >
                          <div className={styles.formGrid}>
                            <LabeledInput label="Желан брой места">
                              <input
                                className={styles.input}
                                type="number"
                                min="0"
                                step="1"
                                value={lake.spots_count ?? 0}
                                onChange={(event) =>
                                  updateLocalLake(lake.id, "spots_count", event.target.value)
                                }
                              />
                            </LabeledInput>
                          </div>
                        </SectionCard>

                        <SectionCard
                          title="Генерирани места"
                          subtitle="Активирайте или деактивирайте отделните места, създадени за този водоем."
                        >
                          {!spotsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма генерирани места.</div>
                          ) : (
                            <>
                              <div className={styles.spotGrid}>
                                {visibleSpots.map((spot) => (
                                  <div key={spot.id} className={styles.spotCard}>
                                    <div className={styles.spotCardHeader}>
                                      <div>
                                        <div className={styles.itemTitle}>Място {spot.spot_number}</div>
                                        <div className={styles.metaText}>
                                          {spot.is_active ? "Видимо и резервируемо" : "Скрито или недостъпно"}
                                        </div>
                                      </div>
                                      <span
                                        className={
                                          spot.is_active ? styles.successBadge : styles.mutedBadge
                                        }
                                      >
                                        {spot.is_active ? "Активно" : "Неактивно"}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={
                                        spot.is_active ? styles.dangerButton : styles.secondaryButton
                                      }
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleToggleSpotActive(lake.id, spot)}
                                    >
                                      {spot.is_active ? "Деактивирай" : "Активирай"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {spotTotalPages > 1 ? (
                                <div className={styles.paginationBar}>
                                  <span>
                                    Страница {spotPage} от {spotTotalPages} · {sortedSpots.length} места
                                  </span>
                                  <div className={styles.paginationActions}>
                                    <button
                                      type="button"
                                      className={styles.filterButton}
                                      disabled={spotPage <= 1}
                                      onClick={() =>
                                        setSpotPageByLake((prev) => ({
                                          ...prev,
                                          [lake.id]: Math.max(1, spotPage - 1),
                                        }))
                                      }
                                    >
                                      Предишна
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.primaryButton}
                                      disabled={spotPage >= spotTotalPages}
                                      onClick={() =>
                                        setSpotPageByLake((prev) => ({
                                          ...prev,
                                          [lake.id]: Math.min(spotTotalPages, spotPage + 1),
                                        }))
                                      }
                                    >
                                      Следваща
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </SectionCard>
                      </>
                    ) : null}

                    {activeTab === "rooms" && lake.has_housing ? (
                      <>
                        <SectionCard
                          title="Настаняване"
                          subtitle="Създавайте и управлявайте стаи, бунгала или други помещения за гости."
                          actions={
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => openCreateRoomModal(lake.id)}
                            >
                              + Добави нова стая / бунгало
                            </button>
                          }
                        >
                          {!roomsByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма добавени стаи.</div>
                          ) : (
                            <div className={styles.roomsTableWrap}>
                              <table className={styles.roomsTable}>
                                <thead>
                                  <tr>
                                    <th>Тип / Име</th>
                                    <th>Капацитет</th>
                                    <th>Цена / Нощувка</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {roomsByLake[lake.id].map((room) => (
                                    <tr key={room.id}>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="text"
                                          value={room.name || ""}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "name",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="number"
                                          min="1"
                                          step="1"
                                          value={room.capacity ?? 1}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "capacity",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.input}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={room.price_per_night ?? 0}
                                          onChange={(event) =>
                                            updateNestedItem(
                                              setRoomsByLake,
                                              lake.id,
                                              room.id,
                                              "price_per_night",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <label className={styles.checkboxLabel}>
                                          <input
                                            type="checkbox"
                                            checked={Boolean(room.is_active)}
                                            onChange={(event) =>
                                              updateNestedItem(
                                                setRoomsByLake,
                                                lake.id,
                                                room.id,
                                                "is_active",
                                                event.target.checked
                                              )
                                            }
                                          />
                                          <span>{room.is_active ? "Активно" : "Неактивно"}</span>
                                        </label>
                                      </td>
                                      <td>
                                        <div className={styles.headerActions}>
                                          <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleSaveRoom(lake.id, room)}
                                          >
                                            Запази
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.dangerButton}
                                            disabled={busyLakeId === lake.id}
                                            onClick={() => handleDeleteRoom(lake.id, room.id)}
                                          >
                                            Изтрий
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </SectionCard>

                        {roomModalOpen ? (
                          <div className={styles.modalBackdrop}>
                            <div className={styles.modalCard}>
                              <div className={styles.modalHeader}>
                                <div>
                                  <h4 className={styles.subsectionTitle}>Добави нова стая</h4>
                                  <div className={styles.sectionSubtitle}>
                                    Създайте опция за настаняване, без да заема място в основния изглед.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.filterButton}
                                  onClick={() => closeRoomModal(lake.id)}
                                >
                                  Затвори
                                </button>
                              </div>

                              <div className={styles.formGrid}>
                                <LabeledInput label="Име на стаята">
                                  <input
                                    className={styles.input}
                                    type="text"
                                    value={roomDraft.name || ""}
                                    onChange={(event) =>
                                      handleRoomDraftChange(lake.id, "name", event.target.value)
                                    }
                                  />
                                </LabeledInput>

                                <LabeledInput label="Капацитет">
                                  <input
                                    className={styles.input}
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={roomDraft.capacity ?? 1}
                                    onChange={(event) =>
                                      handleRoomDraftChange(
                                        lake.id,
                                        "capacity",
                                        event.target.value
                                      )
                                    }
                                  />
                                </LabeledInput>

                                <LabeledInput label="Цена за нощувка (€)">
                                  <input
                                    className={styles.input}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={roomDraft.price_per_night ?? 0}
                                    onChange={(event) =>
                                      handleRoomDraftChange(
                                        lake.id,
                                        "price_per_night",
                                        event.target.value
                                      )
                                    }
                                  />
                                </LabeledInput>
                              </div>

                              <div className={styles.modalActions}>
                                <button
                                  type="button"
                                  className={styles.filterButton}
                                  onClick={() => closeRoomModal(lake.id)}
                                >
                                  Откажи
                                </button>
                                <button
                                  type="button"
                                  className={styles.primaryButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleCreateRoom(lake.id)}
                                >
                                  {busyLakeId === lake.id ? "Запазване..." : "Създай стая"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {activeTab === "gallery" ? (
                      <SectionCard
                        title="Галерия на водоема"
                        subtitle="Качете снимки от собственика, които могат да се показват в публичната страница на водоема."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Качи нови снимки</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleUploadPhoto(lake.id)}
                            >
                              Качи избраните снимки
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Файлове със снимки" hint="Можете да изберете една или няколко снимки наведнъж.">
                              <div className={styles.customFilePicker}>
                                <label className={styles.customFileButton}>
                                  Избери снимки
                                  <input
                                    className={styles.hiddenFileInput}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/jpg"
                                    multiple
                                    onClick={(event) => {
                                      event.currentTarget.value = null;
                                    }}
                                    onChange={(event) => {
                                      const files = Array.from(event.target.files || []);
                                      setPhotoFilesByLake((prev) => ({ ...prev, [lake.id]: files }));
                                      setPhotoCaptionsByLake((prev) => ({ ...prev, [lake.id]: files.map(() => "") }));
                                      setPhotoPreviewsByLake((prev) => ({
                                        ...prev,
                                        [lake.id]: files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
                                      }));
                                    }}
                                  />
                                </label>
                                <span className={styles.selectedFilesText}>
                                  {(photoFilesByLake[lake.id] || []).length
                                    ? `${photoFilesByLake[lake.id].length} избрани снимки`
                                    : "Няма избрани снимки"}
                                </span>
                                {(photoFilesByLake[lake.id] || []).length ? (
                                  <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => handleClearSelectedPhotos(lake.id)}
                                  >
                                    Изчисти избраните
                                  </button>
                                ) : null}
                              </div>
                            </LabeledInput>
                          </div>

                          {(photoPreviewsByLake[lake.id] || []).length ? (
                            <div className={styles.itemList}>
                              {(photoPreviewsByLake[lake.id] || []).map((preview, index) => (
                                <div key={`${preview.name}-${index}`} className={styles.photoManagerCard}>
                                  <ZoomableImage src={preview.url} alt={preview.name} imageClassName={styles.photoThumb} />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>{preview.name}</div>
                                    <div className={styles.metaText}>Готово за качване</div>
                                    <input
                                      className={styles.input}
                                      type="text"
                                      placeholder="Описание по избор"
                                      value={(photoCaptionsByLake[lake.id] || [])[index] || ""}
                                      onChange={(event) =>
                                        setPhotoCaptionsByLake((prev) => {
                                          const current = [...(prev[lake.id] || [])];
                                          current[index] = event.target.value;
                                          return { ...prev, [lake.id]: current };
                                        })
                                      }
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => handleRemoveSelectedPhoto(lake.id, index)}
                                  >
                                    Премахни
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {!photosByLake[lake.id]?.length ? (
                          <div className={styles.emptyState}>Все още няма качени снимки в галерията на водоема.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {photosByLake[lake.id].map((photo) => (
                              <div key={photo.id} className={styles.photoManagerCard}>
                                <ZoomableImage
                                  src={getUploadUrl(photo.image_url)}
                                  alt={photo.caption || "Снимка на водоема"}
                                  imageClassName={styles.photoThumb}
                                />
                                <div className={styles.photoManagerBody}>
                                  <div className={styles.blockedDate}>
                                    {photo.caption || "Снимка без заглавие"}
                                  </div>
                                  <div className={styles.metaText}>
                                    Качено на {formatDate(photo.created_at)}
                                  </div>
                                  <div className={styles.photoUrl}>{photo.image_url}</div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeletePhoto(lake.id, photo.id)}
                                >
                                  Премахни
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.galleryDivider} />

                        <SectionCard
                          title="Потребителски снимки на улови"
                          subtitle="Тези снимки идват от риболовните дневници на потребителите. Те са отделени от снимките, качени от собственика."
                        >
                          {!catchPhotosByLake[lake.id]?.length ? (
                            <div className={styles.emptyState}>Все още няма потребителски снимки на улови за този водоем.</div>
                          ) : (
                            <div className={styles.itemList}>
                              {catchPhotosByLake[lake.id].map((item) => (
                                <div key={item.id} className={styles.photoManagerCard}>
                                  <ZoomableImage
                                    src={getUploadUrl(item.image_url)}
                                    alt={item.species || "Потребителски улов"}
                                    imageClassName={styles.photoThumb}
                                  />
                                  <div className={styles.photoManagerBody}>
                                    <div className={styles.blockedDate}>
                                      {item.species || "Снимка на потребителски улов"}
                                    </div>
                                    <div className={styles.metaText}>
                                      От {item.full_name || "Неизвестен потребител"} · {item.weight_kg ?? "-"} кг · {formatDate(item.catch_time || item.created_at)}
                                    </div>
                                    {item.notes ? <div className={styles.photoUrl}>{item.notes}</div> : null}
                                  </div>
                                  <div className={styles.photoActions}>
                                    <button
                                      type="button"
                                      className={styles.filterButton}
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleReportCatchUser(lake.id, item)}
                                    >
                                      Докладвай потребител
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.dangerButton}
                                      disabled={busyLakeId === lake.id}
                                      onClick={() => handleDeleteCatchPhoto(lake.id, item.id)}
                                    >
                                      Премахни снимката
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </SectionCard>
                      </SectionCard>
                    ) : null}


                    {activeTab === "billing" ? (
                      <SectionCard
                        title="Плащания и приходи"
                        subtitle="Приходите са част от управлението на собственика, защото идват от резервации, места, нощен риболов и помещения."
                        actions={
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={busyLakeId === lake.id}
                            onClick={() => handleRefreshLakeEarnings(lake.id)}
                          >
                            {busyLakeId === lake.id ? "Обновяване..." : "Обнови приходите"}
                          </button>
                        }
                      >
                        <div className={styles.earningsSummaryGrid}>
                          <div className={styles.earningsCard}>
                            <span>Общи приходи на собственика</span>
                            <strong>{formatCurrency(ownerRevenue?.total_earnings || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Чакащ Stripe баланс</span>
                            <strong>{formatCurrency(ownerRevenue?.pending_balance || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Наличен Stripe баланс</span>
                            <strong>{formatCurrency(ownerRevenue?.available_balance || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Следващо плащане</span>
                            <strong className={styles.earningsSmallText}>{ownerRevenue?.estimated_next_payout || "Седмични автоматични изплащания"}</strong>
                          </div>
                        </div>

                        <div className={styles.earningsSummaryGrid}>
                          <div className={styles.earningsCard}>
                            <span>Приходи този месец</span>
                            <strong>{formatCurrency(currentMonth.total_revenue || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Комисиона на платформата</span>
                            <strong>{formatCurrency(currentMonth.platform_fee || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Нетни приходи на собственика</span>
                            <strong>{formatCurrency(currentMonth.owner_earnings || 0)}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Платени резервации</span>
                            <strong>{currentMonth.paid_reservations || 0}</strong>
                          </div>
                          <div className={styles.earningsCard}>
                            <span>Чакащи изплащания</span>
                            <strong>{formatCurrency(currentMonth.pending_payouts || 0)}</strong>
                          </div>
                        </div>

                        <div className={styles.billingSubgrid}>
                          <div className={styles.editorCard}>
                            <div className={styles.editorHeader}>
                              <h5 className={styles.editorTitle}>Настройка за Stripe изплащания</h5>
                              <span className={ownerBilling?.connect_ready ? styles.successBadge : styles.warningBadge}>
                                {payoutStatus}
                              </span>
                            </div>
                            <div className={styles.metaText}>
                              Акаунт: {ownerBilling?.stripe_connected_account_id || "не е създаден"} · Регистрация: {getOnboardingStatusLabel(ownerBilling?.connect_onboarding_status)}
                            </div>
                            <div className={styles.billingActions}>
                              {!hasOwnerPro ? (
                                <button type="button" className={styles.primaryButton} onClick={() => handleOwnerConnect("upgrade")}>
                                  Настрой изплащания
                                </button>
                              ) : (
                                <>
                                  <button type="button" className={styles.primaryButton} onClick={() => handleOwnerConnect("connect")}>
                                    <FaPlug /> {ownerBilling?.stripe_connected_account_id ? "Продължи настройката" : "Настрой изплащания"}
                                  </button>
                                  <button type="button" className={styles.filterButton} onClick={() => handleOwnerConnect("refresh")}>
                                    Обнови статуса
                                  </button>
                                  {ownerBilling?.subscription_status !== "inactive" ? (
                                    <button type="button" className={styles.filterButton} onClick={() => handleOwnerConnect("portal")}>
                                      Управление на изплащанията <FaExternalLinkAlt />
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>

                          <div className={styles.editorCard}>
                            <div className={styles.editorHeader}>
                              <h5 className={styles.editorTitle}>Месечни отчети</h5>
                            </div>
                            {!monthlyReports.length ? (
                              <div className={styles.emptyState}>Все още няма платени месечни отчети.</div>
                            ) : (
                              <>
                                <div className={styles.reportList}>
                                  {visibleMonthlyReports.map((report) => (
                                    <div key={report.month_key} className={styles.reportRow}>
                                      <strong>Отчет за {translateMonthLabel(report.month_label)}</strong>
                                      <span>{formatCurrency(report.owner_earnings || 0)} приходи за собственика</span>
                                      <button
                                        type="button"
                                        className={styles.filterButton}
                                        onClick={() => downloadMonthlyReportNote(lake, report)}
                                      >
                                        Изтегли отчет
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                {monthlyReportTotalPages > 1 ? (
                                  <div className={`${styles.paginationBar} ${styles.compactPagination}`}>
                                    <span>
                                      Страница {monthlyReportPage} от {monthlyReportTotalPages} · {monthlyReports.length} отчета
                                    </span>
                                    <div className={styles.paginationActions}>
                                      <button
                                        type="button"
                                        className={styles.filterButton}
                                        disabled={monthlyReportPage <= 1}
                                        onClick={() =>
                                          setMonthlyReportPageByLake((prev) => ({
                                            ...prev,
                                            [lake.id]: Math.max(1, monthlyReportPage - 1),
                                          }))
                                        }
                                      >
                                        Предишна
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.primaryButton}
                                        disabled={monthlyReportPage >= monthlyReportTotalPages}
                                        onClick={() =>
                                          setMonthlyReportPageByLake((prev) => ({
                                            ...prev,
                                            [lake.id]: Math.min(monthlyReportTotalPages, monthlyReportPage + 1),
                                          }))
                                        }
                                      >
                                        Следваща
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

                        {!billingTransactions.length ? (
                          <div className={styles.emptyState}>Все още няма транзакции от платени резервации.</div>
                        ) : (
                          <>
                            <div className={styles.earningsTableWrap}>
                              <table className={styles.earningsTable}>
                                <thead>
                                  <tr>
                                    <th>Дата</th>
                                    <th>Водоем</th>
                                    <th>Клиент</th>
                                    <th>Обща сума</th>
                                    <th>Комисиона на платформата</th>
                                    <th>Сума за собственика</th>
                                    <th>Статус</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleBillingTransactions.map((item) => (
                                    <tr key={item.id}>
                                      <td>{formatDate(item.paid_at || item.created_at)}</td>
                                      <td>{item.lake_name || lake.name}</td>
                                      <td>{item.customer_name || item.customer_email || "Клиент"}</td>
                                      <td>{formatCurrency(item.total_amount || 0)}</td>
                                      <td>{formatCurrency(item.platform_fee_amount || 0)}</td>
                                      <td>{formatCurrency(item.owner_amount || 0)}</td>
                                      <td><span className={styles.successBadge}>{getStatusLabel(item.payment_status || "paid")}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {billingTransactionTotalPages > 1 ? (
                              <div className={styles.paginationBar}>
                                <span>
                                  Страница {billingTransactionPage} от {billingTransactionTotalPages} · {billingTransactions.length} транзакции
                                </span>
                                <div className={styles.paginationActions}>
                                  <button
                                    type="button"
                                    className={styles.filterButton}
                                    disabled={billingTransactionPage <= 1}
                                    onClick={() =>
                                      setBillingTransactionPageByLake((prev) => ({
                                        ...prev,
                                        [lake.id]: Math.max(1, billingTransactionPage - 1),
                                      }))
                                    }
                                  >
                                    Предишна
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.primaryButton}
                                    disabled={billingTransactionPage >= billingTransactionTotalPages}
                                    onClick={() =>
                                      setBillingTransactionPageByLake((prev) => ({
                                        ...prev,
                                        [lake.id]: Math.min(billingTransactionTotalPages, billingTransactionPage + 1),
                                      }))
                                    }
                                  >
                                    Следваща
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </SectionCard>
                    ) : null}

                    {activeTab === "blocked" ? (
                      <SectionCard
                        title="Блокирани дати"
                        subtitle="Изключете поддръжка, частни събития и недостъпни дати от процеса на резервация."
                      >
                        <div className={styles.editorCard}>
                          <div className={styles.editorHeader}>
                            <h5 className={styles.editorTitle}>Добави блокиран период</h5>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyLakeId === lake.id}
                              onClick={() => handleAddBlockedDate(lake.id)}
                            >
                              {busyLakeId === lake.id ? "Запазване..." : "Добави блокиран период"}
                            </button>
                          </div>

                          <div className={styles.formGrid}>
                            <LabeledInput label="Начална дата">
                              <DatePicker
                                value={blockedDateInputs[lake.id] || ""}
                                onChange={(nextValue) =>
                                  setBlockedDateInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: nextValue,
                                  }))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Крайна дата">
                              <DatePicker
                                value={blockedEndDateInputs[lake.id] || ""}
                                min={blockedDateInputs[lake.id] || undefined}
                                onChange={(nextValue) =>
                                  setBlockedEndDateInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: nextValue,
                                  }))
                                }
                              />
                            </LabeledInput>

                            <LabeledInput label="Причина">
                              <input
                                className={styles.input}
                                type="text"
                                value={blockedReasonInputs[lake.id] || ""}
                                onChange={(event) =>
                                  setBlockedReasonInputs((prev) => ({
                                    ...prev,
                                    [lake.id]: event.target.value,
                                  }))
                                }
                                placeholder="Поддръжка, събитие, частна резервация..."
                              />
                            </LabeledInput>
                          </div>
                        </div>

                        {!blockedDatesByLake[lake.id]?.length ? (
                          <div className={styles.emptyState}>Все още няма добавени блокирани дати.</div>
                        ) : (
                          <div className={styles.itemList}>
                            {blockedDatesByLake[lake.id].map((item) => (
                              <div key={item.id} className={styles.itemCardCompact}>
                                <div>
                                  <div className={styles.blockedDate}>
                                    {formatDate(item.blocked_date)}
                                  </div>
                                  <div className={styles.metaText}>
                                    {item.reason || "Няма добавена причина"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  disabled={busyLakeId === lake.id}
                                  onClick={() => handleDeleteBlockedDate(lake.id, item.id)}
                                >
                                  Премахни
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </SectionCard>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
