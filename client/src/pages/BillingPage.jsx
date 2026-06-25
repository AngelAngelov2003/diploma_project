import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaCreditCard, FaCrown, FaExternalLinkAlt, FaInfoCircle, FaLockOpen } from "react-icons/fa";
import { getBillingStatus, openBillingPortal, startPremiumCheckout } from "../api/billingApi";
import { notifyError, notifySuccess } from "../ui/toast";
import "./BillingPage.css";

const getSubscriptionStatusLabel = (status) => ({
  active: "Активен",
  trialing: "Пробен период",
  inactive: "Неактивен",
  canceled: "Отказан",
  cancelled: "Отказан",
  past_due: "Просрочен",
  unpaid: "Неплатен",
}[status] || status || "Неактивен");

const getRoleLabel = (role) => ({
  owner: "собственик",
  admin: "администратор",
}[String(role || "").toLowerCase()] || "потребител");

const formatDate = (value) => {
  if (!value) return "Няма зададен край";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Няма зададен край";
  return date.toLocaleDateString();
};

export default function BillingPage() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");

  const loadBilling = async () => {
    try {
      const data = await getBillingStatus();
      setBilling(data);
    } catch (error) {
      notifyError(error, "Неуспешно зареждане на статуса на плащанията");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notifySuccess("Плащането е завършено. Премиум достъпът ще се появи след потвърждение от Stripe.");
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  const redirectTo = (url) => {
    if (url) window.location.href = url;
  };

  const handleSubscribe = async () => {
    setBusyAction("checkout");
    try {
      const data = await startPremiumCheckout();
      redirectTo(data.url);
    } catch (error) {
      notifyError(error, "Неуспешно стартиране на Stripe checkout");
    } finally {
      setBusyAction("");
    }
  };

  const handlePortal = async () => {
    setBusyAction("portal");
    try {
      const data = await openBillingPortal();
      redirectTo(data.url);
    } catch (error) {
      notifyError(error, "Неуспешно отваряне на Stripe billing портала");
    } finally {
      setBusyAction("");
    }
  };

  const hasPremium = Boolean(billing?.has_premium_access);
  const premiumIncludedByRole = Boolean(billing?.premium_included_by_role);
  const canStartCheckout = Boolean(billing?.can_start_premium_checkout);
  const canManageSubscription = Boolean(billing?.can_manage_premium_subscription);
  const currentPlanName = hasPremium ? "Премиум" : "Безплатен";
  const currentPlanStatus = premiumIncludedByRole
    ? `Включен с роля ${getRoleLabel(billing?.role)}`
    : hasPremium
      ? getSubscriptionStatusLabel(billing?.subscription_status || "active")
      : "Активен";

  return (
    <div className="billing-page">
      <section className="billing-hero">
        <div>
          <div className="billing-eyebrow"><FaCrown /> Премиум план</div>
          <h1>Отключете подробни прогнози и известия</h1>
          <p>
            Безплатните потребители могат да използват картата и основната информация за водоемите. Премиум потребителите отключват подробна риболовна прогноза,
            изчислена по прогнозна формула с метеорологични условия и лунна фаза, както и създаването на известия.
          </p>
        </div>
        <div className={`billing-status-card ${hasPremium ? "active" : ""}`}>
          <span>Текущ достъп</span>
          <strong>{currentPlanName}</strong>
          <small>Статус: {currentPlanStatus}</small>
          {premiumIncludedByRole ? (
            <small>Потребителски Stripe абонамент: Не се изисква</small>
          ) : hasPremium ? (
            <small>Край на периода: {formatDate(billing?.current_period_end)}</small>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="billing-card">Зареждане на плащания...</div>
      ) : (
        <div className="billing-grid">
          <article className="billing-card">
            <h2>Безплатен</h2>
            <div className="billing-price">€0</div>
            <ul>
              <li><FaCheckCircle /> Интерактивна карта</li>
              <li><FaCheckCircle /> Детайли за водоем</li>
              <li><FaCheckCircle /> Любими водоеми</li>
              <li><FaCheckCircle /> Заявки за резервации</li>
            </ul>
          </article>

          <article className="billing-card premium">
            <h2>Премиум</h2>
            <div className="billing-price">Задава се в Stripe</div>
            <ul>
              <li><FaCheckCircle /> Прогнозна оценка за риболов</li>
              <li><FaCheckCircle /> Детайли към прогнозата</li>
              <li><FaCheckCircle /> Създаване на известия</li>
              <li><FaCheckCircle /> Бъдещи премиум статистики</li>
            </ul>

            {premiumIncludedByRole && (
              <div className="billing-info-box">
                <FaInfoCircle />
                <span>
                  Премиум достъпът е включен за {getRoleLabel(billing?.role)}. Месечен потребителски абонамент не е нужен.
                </span>
              </div>
            )}

            {canManageSubscription ? (
              <button type="button" onClick={handlePortal} disabled={busyAction === "portal"}>
                <FaCreditCard /> Управление на плащанията <FaExternalLinkAlt />
              </button>
            ) : canStartCheckout ? (
              <button type="button" onClick={handleSubscribe} disabled={busyAction === "checkout"}>
                <FaLockOpen /> Надграждане чрез Stripe
              </button>
            ) : null}
          </article>
        </div>
      )}
    </div>
  );
}
