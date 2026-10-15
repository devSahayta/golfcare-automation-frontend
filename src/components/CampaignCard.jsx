// src/components/CampaignCard.jsx
//
// Rendered inside InsightsWidget whenever the agent's reply contains
// action: "SHOW_CAMPAIGN_CARD". Handles the full lifecycle:
//   DRAFT → submit → SUBMITTED (polling) → READY → send → SCHEDULED → COMPLETED
//
// Polling: while status is SUBMITTED or SCHEDULED, polls GET /api/campaigns/:id
// every 10 seconds so the card stays live without a page reload.

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getCampaign,
  submitCampaign,
  sendCampaign,
  cancelCampaign,
} from "../api/campaigns";

const STATUS_LABEL = {
  DRAFT: { text: "Draft", color: "#6b7280" },
  SUBMITTED: { text: "Waiting for Meta…", color: "#d97706" },
  READY: { text: "Meta approved ✓", color: "#16a34a" },
  SCHEDULED: { text: "Sending…", color: "#2563eb" },
  COMPLETED: { text: "Sent ✓", color: "#16a34a" },
  REJECTED: { text: "Meta rejected", color: "#dc2626" },
  CANCELLED: { text: "Cancelled", color: "#6b7280" },
  FAILED: { text: "Failed", color: "#dc2626" },
};

const POLL_INTERVAL_MS = 10000; // 10s
const POLL_STATUSES = new Set(["SUBMITTED", "SCHEDULED"]);

export default function CampaignCard({ campaignId, initialData = {} }) {
  const [campaign, setCampaign] = useState({
    id: campaignId,
    status: "DRAFT",
    ...initialData,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // ── fetch / refresh ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await getCampaign(campaignId);
      setCampaign(res.data.data);
    } catch (err) {
      console.error("CampaignCard refresh failed:", err);
    }
  }, [campaignId]);

  // ── polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (POLL_STATUSES.has(campaign.status)) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [campaign.status, refresh]);

  // ── actions ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await submitCampaign(campaignId);
      await refresh();
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to submit to Meta. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      await sendCampaign(campaignId);
      await refresh();
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to start sending. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this campaign? This cannot be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      await cancelCampaign(campaignId);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to cancel.");
    } finally {
      setLoading(false);
    }
  }

  // ── derived ──────────────────────────────────────────────────────────
  const statusInfo = STATUS_LABEL[campaign.status] || {
    text: campaign.status,
    color: "#6b7280",
  };
  const isDone = ["COMPLETED", "CANCELLED", "FAILED", "REJECTED"].includes(
    campaign.status,
  );
  const canSubmit = campaign.status === "DRAFT";
  const canSend = campaign.status === "READY";
  const canCancel = !isDone;

  const sent = campaign.sentCount ?? 0;
  const failed = campaign.failedCount ?? 0;
  const skipped = campaign.skippedCount ?? 0;
  const total = campaign.audienceSize ?? 0;

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        border: "1px solid #27272a",
        borderRadius: 10,
        padding: "14px 16px",
        marginTop: 8,
        background: "#18181b",
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "#f4f4f5", fontSize: 13 }}>
            📣 {campaign.name || "New Campaign"}
          </div>
          <div style={{ color: statusInfo.color, fontSize: 11, marginTop: 2 }}>
            {statusInfo.text}
          </div>
        </div>
        <div
          style={{
            background: "#27272a",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 11,
            color: "#a1a1aa",
          }}
        >
          {total} recipients
        </div>
      </div>

      {/* Message preview */}
      <div
        style={{
          background: "#27272a",
          borderRadius: 8,
          padding: "10px 12px",
          color: "#d4d4d8",
          fontStyle: "italic",
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 10,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {campaign.bodyText || "…"}
      </div>

      {/* Progress bar while sending */}
      {["SCHEDULED", "COMPLETED"].includes(campaign.status) && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "#a1a1aa",
              marginBottom: 4,
            }}
          >
            <span>
              ✅ {sent} sent &nbsp; ❌ {failed} failed &nbsp;{" "}
              {skipped > 0 && `⏭ ${skipped} skipped`}
            </span>
            <span>
              {total > 0 ? Math.round(((sent + failed) / total) * 100) : 0}%
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: "#3f3f46",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${total > 0 ? Math.round(((sent + failed) / total) * 100) : 0}%`,
                background: "#16a34a",
                borderRadius: 4,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Meta rejection reason */}
      {campaign.status === "REJECTED" && campaign.metaRejectionReason && (
        <div
          style={{
            fontSize: 11,
            color: "#fca5a5",
            background: "#450a0a",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 10,
          }}
        >
          Meta rejection: {campaign.metaRejectionReason}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: "#fca5a5",
            marginBottom: 8,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Action buttons */}
      {!isDone && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={btnStyle("#16a34a", loading)}
            >
              {loading ? "Submitting…" : "✓ Confirm & submit to Meta"}
            </button>
          )}
          {canSend && (
            <button
              onClick={handleSend}
              disabled={loading}
              style={btnStyle("#2563eb", loading)}
            >
              {loading ? "Scheduling…" : "🚀 Send now"}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={loading}
              style={btnStyle("#3f3f46", loading)}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Info note while waiting for Meta */}
      {campaign.status === "SUBMITTED" && (
        <div style={{ fontSize: 11, color: "#71717a", marginTop: 8 }}>
          Checking Meta approval every 10 seconds…
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, disabled) {
  return {
    background: disabled ? "#27272a" : bg,
    color: disabled ? "#52525b" : "#fff",
    border: "none",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
  };
}
