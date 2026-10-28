// src/pages/BroadcastCampaigns.jsx
//
// Fully responsive WhatsApp campaign manager.
// Mobile: single-column list → tap → full-screen detail (back button).
// Desktop (lg+): two-panel sidebar + detail.
//
// v2 additions:
//   - Template editor for DRAFT campaigns (Header / Body / Footer / Buttons)
//   - Live WhatsApp mockup preview
//   - PATCH /api/broadcast-campaigns/:id/template to persist template component changes

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  listCampaigns,
  getCampaign,
  submitCampaign,
  sendCampaign,
  cancelCampaign,
  updateCampaignTemplate,
  scheduleCampaign,
  retryCampaign,
} from "../api/broadcast-campaigns";
import { MegaphoneIcon } from "../components/icons";

// ─── date helpers ─────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}
function fmtShort(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return d;
  }
}

// ─── status config ────────────────────────────────────────────────────────────
const STATUS = {
  DRAFT: {
    label: "Draft",
    bar: "bg-slate-300",
    pill: "bg-slate-100 text-slate-600",
    pulse: false,
  },
  SUBMITTED: {
    label: "Awaiting Meta",
    bar: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700",
    pulse: true,
  },
  READY: {
    label: "Approved",
    bar: "bg-green-600",
    pill: "bg-green-50 text-green-700",
    pulse: false,
  },
  SCHEDULED: {
    label: "Sending",
    bar: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700",
    pulse: true,
  },
  PENDING_SCHEDULE: {
    label: "Scheduled",
    bar: "bg-green-500",
    pill: "bg-green-50 text-green-700",
    pulse: false,
  },
  COMPLETED: {
    label: "Completed",
    bar: "bg-green-600",
    pill: "bg-green-50 text-green-700",
    pulse: false,
  },
  REJECTED: {
    label: "Rejected",
    bar: "bg-red-500",
    pill: "bg-red-50 text-red-600",
    pulse: false,
  },
  CANCELLED: {
    label: "Cancelled",
    bar: "bg-slate-300",
    pill: "bg-slate-100 text-slate-500",
    pulse: false,
  },
  FAILED: {
    label: "Failed",
    bar: "bg-red-500",
    pill: "bg-red-50 text-red-600",
    pulse: false,
  },
};

const RSTATUS = {
  PENDING: { label: "Pending", cls: "bg-slate-100 text-slate-500" },
  SCHEDULED: { label: "Queued", cls: "bg-blue-50 text-blue-600" },
  SENT: { label: "Delivered", cls: "bg-green-50 text-green-700" },
  FAILED: { label: "Failed", cls: "bg-red-50 text-red-600" },
  SKIPPED: { label: "Skipped", cls: "bg-slate-100 text-slate-400" },
};

const POLLING = new Set(["SUBMITTED", "SCHEDULED", "PENDING_SCHEDULE"]);
const POLL_MS = 6000;
const DONE = new Set(["COMPLETED", "CANCELLED", "FAILED", "REJECTED"]);

// ─── icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Back: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.5 5L7.5 10l5 5"
      />
    </svg>
  ),
  Clock: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path strokeLinecap="round" d="M10 6v4l2.5 2.5" />
    </svg>
  ),
  Send: (p) => (
    <svg {...p} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.105 3.105a.75.75 0 01.814-.162l13.5 5.625a.75.75 0 010 1.364l-13.5 5.625a.75.75 0 01-1.04-.898L4.96 10 2.879 4.341a.75.75 0 01.226-.736z" />
    </svg>
  ),
  Check: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 10.5l4 4 7-8"
      />
    </svg>
  ),
  X: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5l10 10M15 5L5 15"
      />
    </svg>
  ),
  Warn: (p) => (
    <svg {...p} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  ),
  People: (p) => (
    <svg {...p} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.015-.224A6.5 6.5 0 0113.5 9.5a6.5 6.5 0 016.385 5.204c.006.073.009.148.009.224H1.615zM14.5 16a6.5 6.5 0 00-5.5-6.416A4.001 4.001 0 0118.5 14h-4z" />
    </svg>
  ),
  Edit: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.586 3.586a2 2 0 012.828 2.828L7.5 15.328l-3.5.672.672-3.5 8.914-8.914z"
      />
    </svg>
  ),
  Plus: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
    </svg>
  ),
  Trash: (p) => (
    <svg
      {...p}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 5h8M8 5V3h4v2M7 5v10a1 1 0 001 1h4a1 1 0 001-1V5H7z"
      />
    </svg>
  ),
  Image: (p) => (
    <svg {...p} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
      />
    </svg>
  ),
};

// ─── shared components ────────────────────────────────────────────────────────

function Pill({ status }) {
  const s = STATUS[status] ?? {
    label: status,
    pill: "bg-slate-100 text-slate-600",
    pulse: false,
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.pill}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${s.bar} ${s.pulse ? "animate-pulse" : ""}`}
      />
      {s.label}
    </span>
  );
}

function RBadge({ status }) {
  const s = RSTATUS[status] ?? {
    label: status,
    cls: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function Bar({ sent, failed, total }) {
  const sp = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  const fp =
    total > 0 ? Math.min(100 - sp, Math.round((failed / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>
          {sent} delivered · {failed} failed ·{" "}
          {Math.max(0, total - sent - failed)} pending
        </span>
        <span className="font-semibold text-slate-700">{sp + fp}%</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-green-600 transition-all duration-700"
          style={{ width: `${sp}%` }}
        />
        <div
          className="h-full bg-red-400 transition-all duration-700"
          style={{ width: `${fp}%` }}
        />
      </div>
    </div>
  );
}

function Spin({ cls = "h-4 w-4" }) {
  return (
    <svg
      className={`animate-spin text-slate-400 ${cls}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${accent ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}
    >
      <div
        className={`text-2xl font-bold ${accent ? "text-green-700" : "text-slate-900"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-slate-400">{label}</div>
    </div>
  );
}

function Banner({
  status,
  sentCount,
  completedAt,
  metaRejectionReason,
  scheduledFor,
}) {
  if (status === "SUBMITTED")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Icon.Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Waiting for Meta to approve the template
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            Usually takes 1–10 minutes. This page updates automatically.
          </p>
        </div>
      </div>
    );
  if (status === "SCHEDULED")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Icon.Send className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div>
          <p className="text-sm font-semibold text-blue-800">
            Messages are on their way
          </p>
          <p className="mt-0.5 text-xs text-blue-600">
            Delivery statuses refresh every 6 seconds.
          </p>
        </div>
      </div>
    );
  if (status === "PENDING_SCHEDULE")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <Icon.Clock className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">
            Scheduled to send
          </p>
          <p className="mt-0.5 text-xs text-green-700">
            {scheduledFor
              ? `Will send on ${fmt(scheduledFor)}.`
              : "Will send at the scheduled time."}{" "}
            You can cancel anytime before it starts.
          </p>
        </div>
      </div>
    );
  if (status === "COMPLETED")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">
            Campaign complete
          </p>
          <p className="mt-0.5 text-xs text-green-700">
            {sentCount ?? 0} message{(sentCount ?? 0) !== 1 ? "s" : ""}{" "}
            delivered.
            {completedAt && ` Finished ${fmt(completedAt)}.`}
          </p>
        </div>
      </div>
    );
  if (status === "REJECTED")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <Icon.X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            Template rejected by Meta
          </p>
          {metaRejectionReason && (
            <p className="mt-0.5 text-xs text-red-600">{metaRejectionReason}</p>
          )}
        </div>
      </div>
    );
  if (status === "CANCELLED")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Icon.X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-600">This campaign was cancelled.</p>
      </div>
    );
  return null;
}

// ─── WhatsApp chat preview (flat bubble, no phone frame) ──────────────────────
function WAPreview({ header, body, footer, buttons, createdAt }) {
  const hasButtons = buttons?.filter((b) => b.text?.trim()).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* WA top bar */}
      <div className="flex items-center gap-2.5 rounded-t-xl bg-[#075E54] px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
          GC
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-none">
            Golf Care
          </p>
          <p className="text-[10px] text-white/60 mt-0.5">online</p>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          background: "linear-gradient(180deg,#dfe7dc 0%,#d5dbcf 100%)",
        }}
      >
        {/* Bubble */}
        <div className="max-w-[88%] overflow-hidden rounded-2xl rounded-tl-none bg-white shadow-md">
          {/* Image header */}
          {header?.type === "IMAGE" &&
            (header.imageUrl ? (
              <img
                src={header.imageUrl}
                alt="Header"
                className="w-full h-auto block"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-28 flex-col items-center justify-center gap-1.5 bg-slate-100 text-slate-400">
                <Icon.Image className="h-7 w-7" />
                <span className="text-xs">Image will appear here</span>
              </div>
            ))}

          {/* Text header */}
          {header?.type === "TEXT" && header.text?.trim() && (
            <div className="border-b border-slate-100 px-3.5 pt-3 pb-2">
              <p className="text-sm font-bold leading-snug text-slate-900">
                {header.text}
              </p>
            </div>
          )}

          {/* Body */}
          <div
            className={`px-3.5 pb-1 ${header?.type === "NONE" || (!header?.text?.trim() && header?.type !== "IMAGE") ? "pt-3" : "pt-2.5"}`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {body || (
                <span className="italic text-slate-400">
                  Message body will appear here…
                </span>
              )}
            </p>
          </div>

          {/* Footer + timestamp */}
          <div className="flex items-end justify-between px-3.5 pt-1 pb-2.5">
            {footer?.text?.trim() ? (
              <p className="text-[11px] leading-tight text-slate-400">
                {footer.text}
              </p>
            ) : (
              <span />
            )}
            <p className="ml-3 shrink-0 text-[10px] text-slate-400">
              {fmtShort(createdAt || new Date())} ✓✓
            </p>
          </div>

          {/* Buttons */}
          {hasButtons && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {buttons
                .filter((b) => b.text?.trim())
                .map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center py-2.5"
                  >
                    <span className="text-xs font-semibold text-[#128C7E]">
                      {b.text}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TemplateEditor ────────────────────────────────────────────────────────────
const HEADER_TYPES = ["NONE", "TEXT", "IMAGE"];

function TemplateEditor({ campaign, onSaved }) {
  const [tab, setTab] = useState("body");

  const [header, setHeader] = useState({
    type: campaign.headerType || "NONE",
    text: campaign.headerText || "",
    imageUrl: campaign.headerImageUrl || "",
  });
  const [body, setBody] = useState(campaign.bodyText || "");
  const [footer, setFooter] = useState({ text: campaign.footerText || "" });
  const [buttons, setButtons] = useState(
    campaign.buttons?.length
      ? campaign.buttons
      : [{ type: "QUICK_REPLY", text: "" }],
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const bodyCount = body.length;
  const bodyOver = bodyCount > 1024;

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "" }]);
  }
  function removeButton(i) {
    setButtons((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateButton(i, field, value) {
    setButtons((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const payload = {
        bodyText: body,
        headerType: header.type,
        headerText: header.type === "TEXT" ? header.text : null,
        headerImageUrl: header.type === "IMAGE" ? header.imageUrl : null,
        footerText: footer.text || null,
        buttons: buttons
          .filter((b) => b.text?.trim())
          .map((b) => ({ type: b.type, text: b.text.trim() })),
      };
      const res = await updateCampaignTemplate(campaign.id, payload);
      setSaved(true);
      onSaved?.(res.data.data ?? { ...campaign, ...payload });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.response?.data?.error ?? "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { id: "body", label: "Body" },
    { id: "header", label: "Header" },
    { id: "footer", label: "Footer" },
    { id: "buttons", label: "Buttons" },
  ];

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon.Edit className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Edit Template
          </span>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 border border-amber-200">
          Draft — not yet submitted
        </span>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ── Left: editor ── */}
        <div className="flex flex-col flex-1 min-w-0 border-b border-slate-100 lg:border-b-0 lg:border-r lg:border-slate-100">
          {/* Section tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/60">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? "border-b-2 border-green-600 bg-white text-green-700"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-5 space-y-4">
            {/* BODY */}
            {tab === "body" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Message Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className={`w-full rounded-lg border px-3.5 py-3 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 resize-none ${
                    bodyOver
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                  placeholder="Hi {{1}}, ..."
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Must start with{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      Hi {"{{1}}"},
                    </code>
                  </p>
                  <span
                    className={`text-xs font-semibold tabular-nums ${bodyOver ? "text-red-500" : bodyCount > 900 ? "text-amber-500" : "text-slate-400"}`}
                  >
                    {bodyCount} / 1024
                  </span>
                </div>
              </div>
            )}

            {/* HEADER */}
            {tab === "header" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Header Type
                  </label>
                  <div className="flex gap-2">
                    {HEADER_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setHeader((h) => ({ ...h, type: t }))}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                          header.type === t
                            ? "bg-green-700 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t === "NONE"
                          ? "None"
                          : t === "TEXT"
                            ? "Text"
                            : "Image"}
                      </button>
                    ))}
                  </div>
                </div>

                {header.type === "TEXT" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Header Text
                    </label>
                    <input
                      type="text"
                      value={header.text}
                      onChange={(e) =>
                        setHeader((h) => ({ ...h, text: e.target.value }))
                      }
                      maxLength={60}
                      placeholder="e.g. New Arrivals at Golf Care"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">
                      Max 60 characters · No variables
                    </p>
                  </div>
                )}

                {header.type === "IMAGE" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={header.imageUrl}
                      onChange={(e) =>
                        setHeader((h) => ({ ...h, imageUrl: e.target.value }))
                      }
                      placeholder="https://..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-600 mb-1">
                        Meta image requirements
                      </p>
                      <p>· Dimensions: 800 × 418 px (16:9)</p>
                      <p>· Max file size: 5 MB</p>
                      <p>· Formats: JPG, PNG</p>
                      <p>· Text overlay: less than 20% of image</p>
                    </div>
                  </div>
                )}

                {header.type === "NONE" && (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic text-slate-400">
                    No header — message starts directly with the body.
                  </p>
                )}
              </div>
            )}

            {/* FOOTER */}
            {tab === "footer" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Footer Text
                </label>
                <input
                  type="text"
                  value={footer.text}
                  onChange={(e) => setFooter({ text: e.target.value })}
                  maxLength={60}
                  placeholder="e.g. Reply STOP to opt out"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Shown in small muted text below the body. Recommended for
                  opt-out instructions.
                </p>
              </div>
            )}

            {/* BUTTONS */}
            {tab === "buttons" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reply Buttons
                  </label>
                  <button
                    onClick={addButton}
                    disabled={buttons.length >= 3}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    Add button
                  </button>
                </div>

                {buttons.length === 0 && (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic text-slate-400">
                    No buttons. Add up to 3 quick-reply buttons.
                  </p>
                )}

                <div className="space-y-2">
                  {buttons.map((btn, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={btn.text}
                        onChange={(e) =>
                          updateButton(i, "text", e.target.value)
                        }
                        maxLength={25}
                        placeholder={`Button ${i + 1} label`}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                      />
                      <select
                        value={btn.type}
                        onChange={(e) =>
                          updateButton(i, "type", e.target.value)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600 focus:border-green-500 focus:outline-none"
                      >
                        <option value="QUICK_REPLY">Quick Reply</option>
                        <option value="PHONE_NUMBER">Call</option>
                        <option value="URL">URL</option>
                      </select>
                      <button
                        onClick={() => removeButton(i)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Icon.Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Max 3 buttons · 25 characters each
                </p>
              </div>
            )}
          </div>

          {/* Save bar — pinned to bottom of editor */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 flex items-center gap-3">
            {saveError && (
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <Icon.Warn className="h-3.5 w-3.5 shrink-0 text-red-500" />
                {saveError}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || bodyOver}
              className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Spin cls="h-4 w-4" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                <Icon.Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col overflow-hidden rounded-b-xl lg:rounded-b-none lg:rounded-r-xl">
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-500">
              Live preview
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <WAPreview
              header={header}
              body={body}
              footer={footer}
              buttons={buttons}
              createdAt={campaign.createdAt}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function BroadcastCampaigns() {
  useEffect(() => {
    document.title = "Broadcast Campaigns — GolfCare";
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  const [campaigns, setCampaigns] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(searchParams.get("id") ?? null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [mobileView, setMobileView] = useState(
    searchParams.get("id") ? "detail" : "list",
  );
  const pollRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const res = await listCampaigns({ limit: 50 });
      const list = res.data.data ?? [];
      setCampaigns(list);
      return list;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await getCampaign(id);
      const c = res.data.data;
      setDetail(c);
      setCampaigns((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: c.status,
                sentCount: c.sentCount,
                failedCount: c.failedCount,
                skippedCount: c.skippedCount,
                audienceSize: c.audienceSize,
              }
            : x,
        ),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const detailId = detail?.id;
  const detailStatus = detail?.status;
  useEffect(() => {
    clearInterval(pollRef.current);
    if (detailId && POLLING.has(detailStatus)) {
      pollRef.current = setInterval(() => loadDetail(detailId), POLL_MS);
    }
    return () => clearInterval(pollRef.current);
  }, [detailStatus, detailId, loadDetail]);

  function select(id) {
    setSelectedId(id);
    setSearchParams(id ? { id } : {});
    setDetail(null);
    setActionError(null);
    setShowScheduler(false);
    setScheduledAt("");
    setLoadingDetail(true);
    setMobileView("detail");
    loadDetail(id);
  }

  function goBack() {
    setMobileView("list");
    setSelectedId(null);
    setDetail(null);
    setSearchParams({});
  }

  useEffect(() => {
    async function init() {
      const list = await loadList();
      const urlId = new URLSearchParams(window.location.search).get("id");
      if (urlId) {
        setLoadingDetail(true);
        loadDetail(urlId);
      } else if (list.length > 0) {
        select(list[0].id);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadList, loadDetail]);

  async function handleSubmit() {
    setActionLoading(true);
    setActionError(null);
    try {
      await submitCampaign(detail.id);
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setActionError(e.response?.data?.error ?? "Failed to submit.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSend() {
    setActionLoading(true);
    setActionError(null);
    try {
      await sendCampaign(detail.id);
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setActionError(e.response?.data?.error ?? "Failed to send.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSchedule() {
    if (!scheduledAt) {
      setActionError("Please pick a date and time to schedule the send.");
      return;
    }
    const iso = new Date(scheduledAt).toISOString();
    const now = new Date();
    if (new Date(scheduledAt) <= now) {
      setActionError("Scheduled time must be in the future.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await scheduleCampaign(detail.id, iso);
      setShowScheduler(false);
      setScheduledAt("");
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setActionError(e.response?.data?.error ?? "Failed to schedule.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this campaign? This cannot be undone.")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelCampaign(detail.id);
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setActionError(e.response?.data?.error ?? "Failed to cancel.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetry() {
    const failedRecipientCount =
      detail.BroadcastRecipient?.filter((r) => r.status === "FAILED").length ||
      0;
    if (!window.confirm(`Retry ${failedRecipientCount} failed message(s)?`))
      return;
    setActionLoading(true);
    setActionError(null);
    try {
      await retryCampaign(detail.id);
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setActionError(e.response?.data?.error ?? "Failed to retry.");
    } finally {
      setActionLoading(false);
    }
  }

  // ─── list panel ─────────────────────────────────────────────────────────────
  const ListPanel = (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700">
            <MegaphoneIcon />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Broadcast Campaigns
            </h1>
            <p className="text-xs text-slate-400 sm:text-sm">
              WhatsApp broadcast messages
            </p>
          </div>
        </div>
      </div>

      {loadingList ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
          <Spin /> Loading…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
            <MegaphoneIcon />
          </div>
          <div>
            <p className="font-semibold text-slate-700">No campaigns yet</p>
            <p className="mt-1 max-w-xs text-sm text-slate-400">
              Open the Insights widget and ask it to send a message to your
              members.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {campaigns.map((c) => {
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`group w-full border-b border-slate-100 px-4 py-3.5 text-left transition-colors last:border-b-0 sm:px-5
                  ${active ? "border-l-[3px] border-l-green-700 bg-green-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`min-w-0 truncate text-sm font-semibold leading-snug ${active ? "text-green-800" : "text-slate-800"}`}
                  >
                    {c.name}
                  </span>
                  <Pill status={c.status} />
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <Icon.People className="h-3 w-3" />
                  <span>{c.audienceSize ?? 0}</span>
                  <span className="mx-1 text-slate-200">|</span>
                  <span>{fmtShort(c.createdAt)}</span>
                </div>
                {["SCHEDULED", "COMPLETED", "PENDING_SCHEDULE"].includes(
                  c.status,
                ) && (
                  <div className="mt-2.5">
                    <Bar
                      sent={c.sentCount || 0}
                      failed={c.failedCount || 0}
                      total={c.audienceSize || 0}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── detail panel ─────────────────────────────────────────────────────────
  const DetailPanel = (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* mobile back bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={goBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
        >
          <Icon.Back className="h-4 w-4" />
          Campaigns
        </button>
      </div>

      {loadingDetail && !detail ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
          <Spin /> Loading…
        </div>
      ) : !detail ? (
        <div className="hidden flex-1 items-center justify-center text-sm text-slate-300 lg:flex">
          Select a campaign
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          {/* title */}
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                {detail.name}
              </h2>
              <Pill status={detail.status} />
              {loadingDetail && <Spin />}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Created {fmt(detail.createdAt)}
              {detail.confirmedAt && ` · Submitted ${fmt(detail.confirmedAt)}`}
              {detail.metaApprovedAt &&
                ` · Approved ${fmt(detail.metaApprovedAt)}`}
            </p>
          </div>

          {/* status banner */}
          <Banner
            status={detail.status}
            sentCount={detail.sentCount}
            completedAt={detail.completedAt}
            metaRejectionReason={detail.metaRejectionReason}
            scheduledFor={detail.scheduledFor}
          />

          {/* Retry failed messages — near the top so staff see it right
             away, without scrolling past stats/preview/recipients.
             Derived from the actual recipient rows rather than
             detail.failedCount, which is a denormalized counter that can
             drift from reality. */}
          {(() => {
            const failedRecipientCount =
              detail.BroadcastRecipient?.filter((r) => r.status === "FAILED")
                .length || 0;
            if (
              (detail.status !== "COMPLETED" && detail.status !== "FAILED") ||
              failedRecipientCount === 0
            ) {
              return null;
            }
            return (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <Icon.Warn className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">
                      {failedRecipientCount} message
                      {failedRecipientCount !== 1 ? "s" : ""} failed to send
                    </p>
                    <p className="mt-0.5 text-xs text-orange-600">
                      Consent will be re-checked before resending.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {actionLoading ? (
                    <>
                      <Spin /> Retrying…
                    </>
                  ) : (
                    <>
                      <Icon.Send className="h-4 w-4" />
                      Retry {failedRecipientCount} message
                      {failedRecipientCount !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            );
          })()}

          {/* stats */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Audience" value={detail.audienceSize ?? 0} />
            <Stat label="Delivered" value={detail.sentCount ?? 0} accent />
            <Stat label="Failed" value={detail.failedCount ?? 0} />
            <Stat label="Skipped" value={detail.skippedCount ?? 0} />
          </div>

          {/* progress bar */}
          {["SCHEDULED", "COMPLETED", "PENDING_SCHEDULE"].includes(
            detail.status,
          ) && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
              <Bar
                sent={detail.sentCount || 0}
                failed={detail.failedCount || 0}
                total={detail.audienceSize || 0}
              />
            </div>
          )}

          {/* Template editor (DRAFT only) */}
          {detail.status === "DRAFT" && (
            <TemplateEditor
              campaign={detail}
              onSaved={(updated) =>
                setDetail((prev) => ({ ...prev, ...updated }))
              }
            />
          )}

          {/* Message preview (non-DRAFT) */}
          {detail.status !== "DRAFT" && (
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Message Preview
                </span>
                {detail.templateName && (
                  <code className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {detail.templateName}
                  </code>
                )}
              </div>

              {/* WhatsApp chat background */}
              <div
                className="px-5 py-5"
                style={{
                  background: "linear-gradient(180deg,#dfe7dc 0%,#d5dbcf 100%)",
                }}
              >
                {/* Bubble */}
                <div className="max-w-sm overflow-hidden rounded-2xl rounded-tl-none bg-white shadow-md">
                  {/* Header image */}
                  {detail.headerImageUrl && (
                    <div className="w-full overflow-hidden rounded-t-2xl bg-slate-100">
                      <img
                        src={detail.headerImageUrl}
                        alt="Campaign image"
                        className="w-full h-auto block"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentNode.style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Header text */}
                  {detail.headerText && (
                    <div className="border-b border-slate-100 px-3.5 pt-3 pb-2">
                      <p className="text-sm font-bold leading-snug text-slate-900">
                        {detail.headerText}
                      </p>
                    </div>
                  )}

                  {/* Body */}
                  <div
                    className={`px-3.5 ${detail.headerImageUrl || detail.headerText ? "pt-2.5" : "pt-3"} pb-1`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                      {detail.bodyText}
                    </p>
                  </div>

                  {/* Footer + timestamp */}
                  <div className="flex items-end justify-between px-3.5 pt-1 pb-2.5">
                    {detail.footerText ? (
                      <p className="text-[11px] leading-tight text-slate-400">
                        {detail.footerText}
                      </p>
                    ) : (
                      <span />
                    )}
                    <p className="ml-3 shrink-0 text-[10px] text-slate-400">
                      {fmtShort(detail.createdAt)} ✓✓
                    </p>
                  </div>

                  {/* Buttons */}
                  {detail.buttons?.filter((b) => b.text?.trim()).length > 0 && (
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {detail.buttons
                        .filter((b) => b.text?.trim())
                        .map((b, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center py-2.5"
                          >
                            <span className="text-xs font-semibold text-[#128C7E]">
                              {b.text}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Meta info footer */}
              {detail.agentPrompt && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-[11px] italic text-slate-400">
                    AI prompt: "{detail.agentPrompt}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* recipients */}
          {detail.BroadcastRecipient?.length > 0 && (
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-400">
                  Recipients
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {detail.BroadcastRecipient.length}
                </span>
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-400">
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Phone</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.BroadcastRecipient.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {r.firstName || "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                          {r.phone}
                        </td>
                        <td className="px-4 py-2.5">
                          <RBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">
                          {r.skipReason ||
                            r.errorMessage ||
                            (r.sentAt ? fmt(r.sentAt) : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 sm:hidden">
                {detail.BroadcastRecipient.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {r.firstName || "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {r.phone}
                      </p>
                      {(r.skipReason || r.errorMessage || r.sentAt) && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {r.skipReason || r.errorMessage || fmt(r.sentAt)}
                        </p>
                      )}
                    </div>
                    <RBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* action error */}
          {actionError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <Icon.Warn className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              {actionError}
            </div>
          )}

          {/* actions */}
          {!DONE.has(detail.status) && (
            <div className="flex flex-col gap-3">
              {detail.status === "DRAFT" && (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <button
                    onClick={handleSubmit}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {actionLoading ? (
                      <>
                        <Spin /> Submitting…
                      </>
                    ) : (
                      "Submit to Meta for approval"
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {detail.status === "READY" && (
                <div className="flex flex-col gap-3">
                  {/* Primary action row */}
                  <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                    {/* Send now */}
                    <button
                      onClick={handleSend}
                      disabled={actionLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {actionLoading && !showScheduler ? (
                        <>
                          <Spin /> Sending…
                        </>
                      ) : (
                        <>
                          <Icon.Send className="h-4 w-4" /> Send now ·{" "}
                          {detail.audienceSize ?? 0} members
                        </>
                      )}
                    </button>

                    {/* Schedule toggle */}
                    <button
                      onClick={() => {
                        setShowScheduler((v) => !v);
                        setActionError(null);
                      }}
                      disabled={actionLoading}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                        showScheduler
                          ? "border-green-600 bg-green-700 text-white hover:bg-green-800"
                          : "border-green-700 bg-white text-green-700 hover:bg-green-50"
                      }`}
                    >
                      <Icon.Clock className="h-4 w-4" />
                      {showScheduler ? "Hide scheduler" : "Schedule for later"}
                    </button>

                    {/* Cancel */}
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      Cancel campaign
                    </button>
                  </div>

                  {/* Scheduler panel — slides open below the buttons */}
                  {showScheduler && (
                    <div className="overflow-hidden rounded-xl border border-green-200 bg-green-50">
                      {/* Header */}
                      <div className="flex items-center gap-2.5 border-b border-green-200 px-4 py-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-700">
                          <Icon.Clock className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-900">
                            Schedule send
                          </p>
                          <p className="text-xs text-green-600">
                            Pick when this campaign goes out to{" "}
                            {detail.audienceSize ?? 0} members
                          </p>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                          {/* Date/time input */}
                          <div className="flex flex-1 flex-col gap-1.5">
                            <label className="text-xs font-semibold text-green-800">
                              Date &amp; time
                            </label>
                            <input
                              type="datetime-local"
                              value={scheduledAt}
                              onChange={(e) => setScheduledAt(e.target.value)}
                              min={new Date(Date.now() + 60_000)
                                .toISOString()
                                .slice(0, 16)}
                              className="w-full rounded-lg border border-green-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                            />
                            <p className="flex items-center gap-1 text-xs text-green-600">
                              <Icon.Clock className="h-3 w-3" />
                              Time is in your local timezone (IST)
                            </p>
                          </div>

                          {/* Confirm button */}
                          <button
                            onClick={handleSchedule}
                            disabled={actionLoading || !scheduledAt}
                            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            {actionLoading && showScheduler ? (
                              <>
                                <Spin /> Scheduling…
                              </>
                            ) : (
                              <>
                                <Icon.Clock className="h-4 w-4" /> Confirm
                                schedule
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail.status === "SUBMITTED" && (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {detail.status === "PENDING_SCHEDULE" && (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {actionLoading ? (
                      <>
                        <Spin /> Cancelling…
                      </>
                    ) : (
                      "Cancel scheduled send"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="hidden h-full lg:flex">
        <div className="w-72 shrink-0 overflow-hidden border-r border-slate-200 bg-white xl:w-80">
          {ListPanel}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          {DetailPanel}
        </div>
      </div>
      <div className="flex h-full flex-col lg:hidden">
        {mobileView === "list" ? ListPanel : DetailPanel}
      </div>
    </div>
  );
}
