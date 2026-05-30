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
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "EUR").toUpperCase(),
  }).format(Number(value || 0));

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
      if (!silent) notifyError(error, "Failed to load owner payout status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();

    const params = new URLSearchParams(window.location.search);
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

  const handleConnect = async () => {
    setBusyAction("connect");
    try {
      const data = await startOwnerConnectOnboarding();
      if (data?.url) window.location.href = data.url;
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

  const connectReady = Boolean(billing?.connect_ready);
  const platformFeePercent = Number.isFinite(Number(billing?.platform_fee_percent))
    ? Number(billing.platform_fee_percent)
    : 10;

  return (
    <div className="owner-billing-page">
      <section className="owner-billing-hero">
        <div>
          <div className="owner-billing-eyebrow"><FaStore /> Owner payouts</div>
          <h1>Stripe payouts and platform commission</h1>
          <p>
            Owners do not need a subscription. Users pay reservations through Stripe, the platform keeps {platformFeePercent}% commission,
            and the remaining amount is sent to the owner connected account.
          </p>
        </div>
        <div className={`owner-billing-status-card ${connectReady ? "active" : ""}`}>
          <span>{connectReady ? "Payouts ready" : "Payout setup needed"}</span>
          <strong>{billing?.connect_onboarding_status || "not_started"}</strong>
          <small>Platform fee: {platformFeePercent}%</small>
        </div>
      </section>

      {loading ? (
        <div className="owner-billing-card">Loading owner payout status...</div>
      ) : (
        <>
          <div className="owner-billing-grid">
            <article className="owner-billing-card">
              <h2>Owner tools</h2>
              <div className="owner-billing-price">No monthly fee</div>
              <ul>
                <li><FaCheckCircle /> Manage lake profile, gallery, spots, rooms, and prices</li>
                <li><FaCheckCircle /> Receive manual reservation requests</li>
                <li><FaCheckCircle /> Use online paid reservations after Stripe Connect is ready</li>
              </ul>
            </article>

            <article className="owner-billing-card pro">
              <h2>Commission model</h2>
              <div className="owner-billing-price">{platformFeePercent}% platform fee</div>
              <ul>
                <li><FaCheckCircle /> Customer pays the reservation total</li>
                <li><FaCheckCircle /> Platform keeps the commission</li>
                <li><FaCheckCircle /> Owner receives the remaining amount in Stripe Connect</li>
              </ul>
            </article>
          </div>

          <section className="owner-billing-revenue-grid">
            <article className="owner-billing-metric-card">
              <FaWallet />
              <span>Total earnings</span>
              <strong>{formatMoney(revenue?.total_earnings, revenue?.currency)}</strong>
              <small>Paid reservation revenue after platform commission.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaMoneyBillWave />
              <span>Pending Stripe balance</span>
              <strong>{formatMoney(revenue?.pending_balance, revenue?.currency)}</strong>
              <small>Money paid by users but not yet available for payout.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaCheckCircle />
              <span>Available balance</span>
              <strong>{formatMoney(revenue?.available_balance, revenue?.currency)}</strong>
              <small>Available in the owner connected account.</small>
            </article>
            <article className="owner-billing-metric-card">
              <FaClock />
              <span>Estimated next payout</span>
              <strong className="owner-billing-small-strong">{revenue?.estimated_next_payout || "Weekly automatic payouts"}</strong>
              <small>Stripe sends payouts based on the connected account schedule.</small>
            </article>
          </section>

          <section className="owner-billing-history-card">
            <div className="owner-billing-history-head">
              <div>
                <div className="owner-billing-eyebrow"><FaReceipt /> Revenue history</div>
                <h2>Reservation payments</h2>
              </div>
              <span>{revenue?.paid_payments_count || 0} paid payments</span>
            </div>
            {!revenue?.history?.length ? (
              <p className="owner-billing-empty">No online reservation payments yet.</p>
            ) : (
              <div className="owner-billing-history-list">
                {revenue.history.map((item) => (
                  <div key={item.id} className="owner-billing-history-row">
                    <div>
                      <strong>{item.lake_name || "Reservation"}</strong>
                      <small>
                        {item.customer_name || item.customer_email || "Customer"} · {formatDate(item.arrival_date)} → {formatDate(item.departure_date)}
                      </small>
                    </div>
                    <div className="owner-billing-history-amounts">
                      <strong>{formatMoney(item.owner_amount, item.currency)}</strong>
                      <small>Total {formatMoney(item.amount_total, item.currency)} · Fee {formatMoney(item.platform_fee_amount, item.currency)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="owner-billing-connect-card">
            <div>
              <div className="owner-billing-eyebrow"><FaPlug /> Stripe Connect</div>
              <h2>Payout account setup</h2>
              <p>
                This connected account is required before online reservation payments can be sent to the owner.
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
          </section>
        </>
      )}
    </div>
  );
}
