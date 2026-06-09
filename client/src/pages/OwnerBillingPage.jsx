import React, { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaMoneyBillWave,
  FaPlug,
  FaStore,
  FaWallet,
  FaClock,
  FaReceipt,
} from "react-icons/fa";
import {
  getOwnerBillingStatus,
  getOwnerRevenueSummary,
  refreshOwnerConnectStatus,
  startOwnerConnectOnboarding,
} from "../api/billingApi";
import { notifyError, notifySuccess } from "../ui/toast";
import "./OwnerBillingPage.css";

const StatusPill = ({ active, children }) => (
  <span className={`owner-billing-pill ${active ? "active" : "muted"}`}>{children}</span>
);

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: String(currency || "EUR").toUpperCase(),
  }).format(Number(value || 0));

const getConnectStatusLabel = (status) => ({
  not_started: "не е започната",
  pending: "в процес",
  complete: "завършена",
  enabled: "активна",
  restricted: "ограничена",
  inactive: "неактивна",
}[status] || status || "не е започната");

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

export default function OwnerBillingPage() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [revenue, setRevenue] = useState(null);

  const loadBilling = async ({ silent = false } = {}) => {
    try {
      const [data, revenueData] = await Promise.all([
        getOwnerBillingStatus(),
        getOwnerRevenueSummary().catch(() => null),
      ]);
      setBilling(data);
      setRevenue(revenueData);
    } catch (error) {
      if (!silent) notifyError(error, "Неуспешно зареждане на статуса за изплащания");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();

    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "return") {
      notifySuccess("Връщане от настройката на Stripe Connect. Обновяване на статуса на изплащанията.");
      refreshOwnerConnectStatus().then(setBilling).catch(() => loadBilling({ silent: true }));
      window.history.replaceState({}, "", "/owner/billing");
    }
    if (params.get("connect") === "refresh") {
      notifyError("Връзката за Stripe настройка е изтекла. Стартирайте настройката отново.");
      window.history.replaceState({}, "", "/owner/billing");
    }
  }, []);

  const handleConnect = async () => {
    setBusyAction("connect");
    try {
      const data = await startOwnerConnectOnboarding();
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      notifyError(error, "Неуспешно стартиране на Stripe Connect настройка");
    } finally {
      setBusyAction("");
    }
  };

  const handleRefreshConnect = async () => {
    setBusyAction("refresh-connect");
    try {
      const data = await refreshOwnerConnectStatus();
      setBilling(data);
      notifySuccess("Статусът на Stripe Connect е обновен.");
    } catch (error) {
      notifyError(error, "Неуспешно обновяване на Stripe Connect статуса");
    } finally {
      setBusyAction("");
    }
  };

  const connectReady = Boolean(billing?.connect_ready);
  const platformFeePercent = Number.isFinite(Number(billing?.platform_fee_percent))
    ? Number(billing.platform_fee_percent)
    : 10;

  return (
    <div className="owner-billing-page">
      <section className="owner-billing-hero">
        <div>
          <div className="owner-billing-eyebrow"><FaStore /> Изплащания за собственици</div>
          <h1>Stripe плащания и комисиона на платформата</h1>
          <p>
            Собствениците не се нуждаят от абонамент. Потребителите плащат резервациите чрез Stripe, платформата задържа {platformFeePercent}% комисиона,
            а останалата сума се изпраща към свързания акаунт на собственика.
          </p>
        </div>
        <div className={`owner-billing-status-card ${connectReady ? "active" : ""}`}>
          <span>{connectReady ? "Изплащанията са готови" : "Нужна е настройка за изплащания"}</span>
          <strong>{getConnectStatusLabel(billing?.connect_onboarding_status)}</strong>
          <small>Комисиона на платформата: {platformFeePercent}%</small>
        </div>
      </section>

      {loading ? (
        <div className="owner-billing-card">Зареждане на статус...</div>
      ) : (
        <>
          <div className="owner-billing-grid">
            <article className="owner-billing-card">
              <h2>Инструменти за собственици</h2>
              <div className="owner-billing-price">Без месечна такса</div>
              <ul>
                <li><FaCheckCircle /> Управлявайте профила, галерията, местата, стаите и цените на водоема</li>
                <li><FaCheckCircle /> Получавайте ръчни заявки за резервации</li>
                <li><FaCheckCircle /> Използвайте онлайн платени резервации след настройка на Stripe Connect</li>
              </ul>
            </article>

            <article className="owner-billing-card pro">
              <h2>Модел на комисиона</h2>
              <div className="owner-billing-price">{platformFeePercent}% комисиона на платформата</div>
              <ul>
                <li><FaCheckCircle /> Клиентът плаща общата сума на резервацията</li>
                <li><FaCheckCircle /> Платформата задържа комисионата</li>
                <li><FaCheckCircle /> Собственикът получава останалата сума в Stripe Connect</li>
              </ul>
            </article>
          </div>

          <section className="owner-billing-revenue-grid">
            <article className="owner-billing-metric-card">
              <FaWallet />
              <span>Общи приходи</span>
              <strong>{formatMoney(revenue?.total_earnings, revenue?.currency)}</strong>
              <small>Приходи от платени резервации след комисионата на платформата.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaMoneyBillWave />
              <span>Чакащ Stripe баланс</span>
              <strong>{formatMoney(revenue?.pending_balance, revenue?.currency)}</strong>
              <small>Пари, платени от потребители, но все още неналични за изплащане.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaCheckCircle />
              <span>Наличен баланс</span>
              <strong>{formatMoney(revenue?.available_balance, revenue?.currency)}</strong>
              <small>Налично в свързания акаунт на собственика.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaClock />
              <span>Следващо плащане</span>
              <strong className="owner-billing-small-strong">{revenue?.estimated_next_payout || "Седмични автоматични изплащания"}</strong>
              <small>Stripe изпраща изплащания според графика на свързания акаунт.</small>
            </article>
          </section>

          <section className="owner-billing-history-card">
            <div className="owner-billing-history-head">
              <div>
                <div className="owner-billing-eyebrow"><FaReceipt /> История на приходите</div>
                <h2>Плащания по резервации</h2>
              </div>
              <span>{revenue?.paid_payments_count || 0} платени плащания</span>
            </div>
            {!revenue?.history?.length ? (
              <p className="owner-billing-empty">Все още няма онлайн плащания по резервации.</p>
            ) : (
              <div className="owner-billing-history-list">
                {revenue.history.map((item) => (
                  <div key={item.id} className="owner-billing-history-row">
                    <div>
                      <strong>{item.lake_name || "Резервация"}</strong>
                      <small>
                        {item.customer_name || item.customer_email || "Клиент"} · {formatDate(item.arrival_date)} → {formatDate(item.departure_date)}
                      </small>
                    </div>
                    <div className="owner-billing-history-amounts">
                      <strong>{formatMoney(item.owner_amount, item.currency)}</strong>
                      <small>Общо {formatMoney(item.amount_total, item.currency)} · Комисиона {formatMoney(item.platform_fee_amount, item.currency)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="owner-billing-connect-card">
            <div>
              <div className="owner-billing-eyebrow"><FaPlug /> Stripe Connect</div>
              <h2>Настройка на акаунт за изплащания</h2>
              <p>
                Свързаният акаунт е необходим, за да могат онлайн плащанията по резервации да се изпращат към собственика.
              </p>
              <div className="owner-billing-pills">
                <StatusPill active={Boolean(billing?.stripe_connected_account_id)}>
                  Акаунт: {billing?.stripe_connected_account_id ? "създаден" : "не е започнато"}
                </StatusPill>
                <StatusPill active={connectReady}>Настройка: {getConnectStatusLabel(billing?.connect_onboarding_status)}</StatusPill>
                <StatusPill active={Boolean(billing?.charges_enabled)}>Плащания с карта: {billing?.charges_enabled ? "активирано" : "изчаква"}</StatusPill>
                <StatusPill active={Boolean(billing?.payouts_enabled)}>Изплащания: {billing?.payouts_enabled ? "активирано" : "изчаква"}</StatusPill>
              </div>
            </div>
            <div className="owner-billing-connect-actions">
              <button type="button" onClick={handleConnect} disabled={busyAction === "connect"}>
                <FaMoneyBillWave /> {billing?.stripe_connected_account_id ? "Продължи настройката" : "Настрой изплащания"}
              </button>
              <button type="button" className="secondary" onClick={handleRefreshConnect} disabled={busyAction === "refresh-connect"}>
                Обнови статуса
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
