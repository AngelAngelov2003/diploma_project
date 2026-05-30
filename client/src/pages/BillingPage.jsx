import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaCreditCard, FaCrown, FaExternalLinkAlt, FaLockOpen } from "react-icons/fa";
import { getBillingStatus, openBillingPortal, startPremiumCheckout } from "../api/billingApi";
import { notifyError, notifySuccess } from "../ui/toast";
import "./BillingPage.css";

const formatDate = (value) => {
  if (!value) return "Not active";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not active";
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
      notifyError(error, "Failed to load billing status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notifySuccess("Payment completed. Your Premium access will appear after Stripe confirms it.");
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
      notifyError(error, "Could not start Stripe checkout");
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
      notifyError(error, "Could not open Stripe billing portal");
    } finally {
      setBusyAction("");
    }
  };

  const hasPremium = Boolean(billing?.has_premium_access);

  return (
    <div className="billing-page">
      <section className="billing-hero">
        <div>
          <div className="billing-eyebrow"><FaCrown /> Premium plan</div>
          <h1>Unlock forecasts and smart alerts</h1>
          <p>
            Free users can use the map and basic lake information. Premium users unlock the AI fishing forecast,
            forecast explanations, and alert creation.
          </p>
        </div>
        <div className={`billing-status-card ${hasPremium ? "active" : ""}`}>
          <span>{hasPremium ? "Premium active" : "Free plan"}</span>
          <strong>{billing?.subscription_status || "inactive"}</strong>
          <small>Period end: {formatDate(billing?.current_period_end)}</small>
        </div>
      </section>

      {loading ? (
        <div className="billing-card">Loading billing...</div>
      ) : (
        <div className="billing-grid">
          <article className="billing-card">
            <h2>Free</h2>
            <div className="billing-price">€0</div>
            <ul>
              <li><FaCheckCircle /> Interactive map</li>
              <li><FaCheckCircle /> Lake details</li>
              <li><FaCheckCircle /> Favorites</li>
              <li><FaCheckCircle /> Reservation requests</li>
            </ul>
          </article>

          <article className="billing-card premium">
            <h2>Premium</h2>
            <div className="billing-price">Set in Stripe</div>
            <ul>
              <li><FaCheckCircle /> AI forecast and score</li>
              <li><FaCheckCircle /> Forecast explanation</li>
              <li><FaCheckCircle /> Alert creation</li>
              <li><FaCheckCircle /> Future premium analytics</li>
            </ul>
            {hasPremium ? (
              <button type="button" onClick={handlePortal} disabled={busyAction === "portal"}>
                <FaCreditCard /> Manage billing <FaExternalLinkAlt />
              </button>
            ) : (
              <button type="button" onClick={handleSubscribe} disabled={busyAction === "checkout"}>
                <FaLockOpen /> Upgrade with Stripe
              </button>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
