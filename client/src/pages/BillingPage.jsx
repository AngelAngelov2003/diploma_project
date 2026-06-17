import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaCreditCard, FaCrown, FaExternalLinkAlt, FaLockOpen } from "react-icons/fa";
import { getBillingStatus, openBillingPortal, startPremiumCheckout } from "../api/billingApi";
import { notifyError, notifySuccess } from "../ui/toast";
import "./BillingPage.css";

const getSubscriptionStatusLabel = (status) => ({
  active: "активен",
  trialing: "пробен период",
  inactive: "неактивен",
  canceled: "отказан",
  cancelled: "отказан",
  past_due: "просрочен",
  unpaid: "неплатен",
}[status] || status || "неактивен");

const formatDate = (value) => {
  if (!value) return "Не е активен";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не е активен";
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

  return (
    <div className="billing-page">
      <section className="billing-hero">
        <div>
          <div className="billing-eyebrow"><FaCrown /> Премиум план</div>
          <h1>Отключете прогнози и умни известия</h1>
          <p>
            Безплатните потребители могат да използват картата и основната информация за водоемите. Премиум потребителите отключват AI риболовната прогноза,
            обясненията към прогнозата и създаването на известия.
          </p>
        </div>
        <div className={`billing-status-card ${hasPremium ? "active" : ""}`}>
          <span>{hasPremium ? "Премиум активен" : "Безплатен план"}</span>
          <strong>{getSubscriptionStatusLabel(billing?.subscription_status)}</strong>
          <small>Край на периода: {formatDate(billing?.current_period_end)}</small>
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
              <li><FaCheckCircle /> AI прогноза и оценка</li>
              <li><FaCheckCircle /> Обяснение на прогнозата</li>
              <li><FaCheckCircle /> Създаване на известия</li>
              <li><FaCheckCircle /> Бъдещи премиум анализи</li>
            </ul>
            {hasPremium ? (
              <button type="button" onClick={handlePortal} disabled={busyAction === "portal"}>
                <FaCreditCard /> Управление на плащанията <FaExternalLinkAlt />
              </button>
            ) : (
              <button type="button" onClick={handleSubscribe} disabled={busyAction === "checkout"}>
                <FaLockOpen /> Надграждане чрез Stripe
              </button>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
