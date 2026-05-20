import React, { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaCreditCard,
  FaExternalLinkAlt,
  FaMoneyBillWave,
  FaPlug,
  FaShieldAlt,
  FaStore,
} from "react-icons/fa";
import {
  getOwnerBillingStatus,
  openOwnerBillingPortal,
  refreshOwnerConnectStatus,
  startOwnerConnectOnboarding,
  startOwnerProCheckout,
} from "../api/billingApi";
import OwnerProLockedCard from "../components/common/OwnerProLockedCard";
import { notifyError, notifySuccess } from "../ui/toast";
import "./OwnerBillingPage.css";

const formatDate = (value) => {
  if (!value) return "Not active";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not active";
  return date.toLocaleDateString();
};

const StatusPill = ({ active, children }) => (
  <span className={`owner-billing-pill ${active ? "active" : "muted"}`}>{children}</span>
);

export default function OwnerBillingPage() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");

  const loadBilling = async ({ silent = false } = {}) => {
    try {
      const data = await getOwnerBillingStatus();
      setBilling(data);
    } catch (error) {
      if (!silent) notifyError(error, "Failed to load owner billing status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notifySuccess("Owner Pro checkout completed. Stripe will confirm the subscription shortly.");
      window.history.replaceState({}, "", "/owner/billing");
    }
    if (params.get("connect") === "return") {
      notifySuccess("Stripe Connect onboarding returned. Refreshing payout status.");
      refreshOwnerConnectStatus().then(setBilling).catch(() => loadBilling({ silent: true }));
      window.history.replaceState({}, "", "/owner/billing");
    }
    if (params.get("connect") === "refresh") {
      notifyError("Stripe onboarding link expired. Please start onboarding again.");
      window.history.replaceState({}, "", "/owner/billing");
    }
  }, []);

  const redirectTo = (url) => {
    if (url) window.location.href = url;
  };

  const handleOwnerPro = async () => {
    setBusyAction("owner-pro");
    try {
      const data = await startOwnerProCheckout();
      redirectTo(data.url);
    } catch (error) {
      notifyError(error, "Could not start Owner Pro checkout");
    } finally {
      setBusyAction("");
    }
  };

  const handlePortal = async () => {
    setBusyAction("portal");
    try {
      const data = await openOwnerBillingPortal();
      redirectTo(data.url);
    } catch (error) {
      notifyError(error, "Could not open owner billing portal");
    } finally {
      setBusyAction("");
    }
  };

  const handleConnect = async () => {
    setBusyAction("connect");
    try {
      const data = await startOwnerConnectOnboarding();
      redirectTo(data.url);
    } catch (error) {
      notifyError(error, "Could not start Stripe Connect onboarding");
    } finally {
      setBusyAction("");
    }
  };

  const handleRefreshConnect = async () => {
    setBusyAction("refresh-connect");
    try {
      const data = await refreshOwnerConnectStatus();
      setBilling(data);
      notifySuccess("Stripe Connect status refreshed.");
    } catch (error) {
      notifyError(error, "Could not refresh Stripe Connect status");
    } finally {
      setBusyAction("");
    }
  };

  const hasOwnerPro = Boolean(billing?.has_owner_pro_access);
  const connectReady = Boolean(billing?.connect_ready);

  return (
    <div className="owner-billing-page">
      <section className="owner-billing-hero">
        <div>
          <div className="owner-billing-eyebrow"><FaStore /> Owner billing</div>
          <h1>Owner Pro and payout setup</h1>
          <p>
            Phase 2 adds the owner subscription and Stripe Connect onboarding foundation. Owners can pay for platform tools now;
            reservation split payments and commission payouts are prepared for the next phase.
          </p>
        </div>
        <div className={`owner-billing-status-card ${hasOwnerPro ? "active" : ""}`}>
          <span>{hasOwnerPro ? "Owner Pro active" : "Owner Free"}</span>
          <strong>{billing?.subscription_status || "inactive"}</strong>
          <small>Period end: {formatDate(billing?.current_period_end)}</small>
        </div>
      </section>

      {loading ? (
        <div className="owner-billing-card">Loading owner billing...</div>
      ) : (
        <>
          <div className="owner-billing-grid">
            <article className="owner-billing-card">
              <h2>Owner Free</h2>
              <div className="owner-billing-price">0 BGN</div>
              <ul>
                <li><FaCheckCircle /> Manage basic lake profile</li>
                <li><FaCheckCircle /> Upload gallery photos</li>
                <li><FaCheckCircle /> Configure spots, rooms, and prices</li>
                <li><FaCheckCircle /> Receive manual reservation requests</li>
              </ul>
            </article>

            <article className="owner-billing-card pro">
              <h2>Owner Pro</h2>
              <div className="owner-billing-price">Set in Stripe</div>
              <ul>
                <li><FaCheckCircle /> Prepare online paid bookings</li>
                <li><FaCheckCircle /> Owner revenue dashboard foundation</li>
                <li><FaCheckCircle /> Stripe billing portal</li>
                <li><FaCheckCircle /> Future Connect payouts and commissions</li>
              </ul>
              {hasOwnerPro ? (
                <button type="button" onClick={handlePortal} disabled={busyAction === "portal"}>
                  <FaCreditCard /> Manage Owner Pro <FaExternalLinkAlt />
                </button>
              ) : (
                <button type="button" onClick={handleOwnerPro} disabled={busyAction === "owner-pro"}>
                  <FaShieldAlt /> Upgrade to Owner Pro
                </button>
              )}
            </article>
          </div>

          <section className="owner-billing-connect-card">
            {hasOwnerPro ? (
              <>
                <div>
                  <div className="owner-billing-eyebrow"><FaPlug /> Stripe Connect</div>
                  <h2>Payout account setup</h2>
                  <p>
                    Connect is for the marketplace part: later, users will pay reservations through the platform, the platform keeps
                    a commission, and the owner receives the remaining amount through this connected account.
                  </p>
                  <div className="owner-billing-pills">
                    <StatusPill active={Boolean(billing?.stripe_connected_account_id)}>
                      Account: {billing?.stripe_connected_account_id ? "created" : "not started"}
                    </StatusPill>
                    <StatusPill active={connectReady}>Onboarding: {billing?.connect_onboarding_status || "not started"}</StatusPill>
                    <StatusPill active={Boolean(billing?.charges_enabled)}>Charges: {billing?.charges_enabled ? "enabled" : "pending"}</StatusPill>
                    <StatusPill active={Boolean(billing?.payouts_enabled)}>Payouts: {billing?.payouts_enabled ? "enabled" : "pending"}</StatusPill>
                  </div>
                </div>
                <div className="owner-billing-connect-actions">
                  <button type="button" onClick={handleConnect} disabled={busyAction === "connect"}>
                    <FaMoneyBillWave /> {billing?.stripe_connected_account_id ? "Continue onboarding" : "Set up payouts"}
                  </button>
                  <button type="button" className="secondary" onClick={handleRefreshConnect} disabled={busyAction === "refresh-connect"}>
                    Refresh status
                  </button>
                </div>
              </>
            ) : (
              <OwnerProLockedCard
                className="owner-billing-locked-wide"
                title="Payout account setup"
                message="Stripe Connect payouts are available after upgrading to Owner Pro. Free owners can still prepare their lake profile, but payment and payout tools stay locked."
                bullets={[
                  "Set up Stripe payout account",
                  "Prepare online paid bookings",
                  "Enable future commission-based reservation payments",
                ]}
                onUpgrade={handleOwnerPro}
                buttonLabel={busyAction === "owner-pro" ? "Opening checkout..." : "Upgrade to Owner Pro"}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
