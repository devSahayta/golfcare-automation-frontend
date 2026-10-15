// src/pages/Campaigns.jsx
//
// Birthday, replenishment and cross-sell campaigns.
// Static lanes (Birthday, Replenishment) use pre-approved templates sent by
// the scheduler. Dynamic lane (Cross-sell) drafts a per-customer template
// that a human must approve before it goes to Meta.

import { useEffect, useState } from "react";
import {
  fetchCampaignSummary,
  fetchCampaignTemplates,
  fetchCampaignTriggers,
  fetchStaticCampaignTemplate,
  approveCampaignTemplate,
  rejectCampaignTemplate,
} from "../api/campaigns";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { formatDate, formatDateTime } from "../lib/format";
import {
  MegaphoneIcon,
  SparkIcon,
  BagIcon,
  ReceiptIcon,
} from "../components/icons";

const LIMIT = 20;

// Two lanes, matching the backend design: static lanes send a pre-approved
// template with no per-message approval; the dynamic lane drafts a one-off
// template per customer that a human must approve first.
const SCENARIOS = {
  BIRTHDAY: {
    label: "Birthday",
    lane: "Static",
    laneHint: "Pre-approved template, sent on the customer's birthday",
    icon: MegaphoneIcon,
  },
  REPLENISHMENT: {
    label: "Replenishment",
    lane: "Static",
    laneHint: "Pre-approved template, sent when a consumable is due again",
    icon: BagIcon,
  },
  CROSS_SELL: {
    label: "Cross-sell",
    lane: "Dynamic",
    laneHint: "AI-drafted per customer, needs your approval first",
    icon: SparkIcon,
  },
};

const STAGES = {
  AWAITING_APPROVAL: { label: "Awaiting approval", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "danger" },
  META_PENDING: { label: "Awaiting Meta review", variant: "info" },
  META_REJECTED: { label: "Meta rejected", variant: "danger" },
  SCHEDULED: { label: "Scheduled", variant: "info" },
  SENT: { label: "Sent", variant: "positive" },
  SEND_FAILED: { label: "Send failed", variant: "danger" },
  DELETED: { label: "Deleted", variant: "neutral" },
  UNKNOWN: { label: "Unknown", variant: "neutral" },
};

const TRIGGER_STATUSES = {
  PENDING: { label: "Pending", variant: "neutral" },
  TEMPLATE_CREATED: { label: "Template created", variant: "info" },
  SENT: { label: "Sent", variant: "positive" },
  SUPPRESSED: { label: "Suppressed", variant: "warning" },
};

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400";

function formatInr(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toFixed(2)}`;
}

// Same {{n}} substitution the backend uses for the approval page and email.
function fillBody(bodyDraft, variables) {
  let text = bodyDraft || "";
  (variables || []).forEach((v, i) => {
    text = text.replace(`{{${i + 1}}}`, String(v));
  });
  return text;
}

function scenarioLabel(s) {
  return SCENARIOS[s]?.label || s;
}

function StageBadge({ stage }) {
  const meta = STAGES[stage] || STAGES.UNKNOWN;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// Small fetch helper: results are stored with the key that produced them,
// so "loading" is derived instead of set synchronously inside the effect.
function useKeyedFetch(key, fetcher) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((res) => {
        if (!cancelled) setResult({ key, data: res.data, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? false,
    loading: !current,
  };
}

function Pager({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
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

function ApprovalButtons({ busy, onApprove, onReject, size = "md" }) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className={`rounded-lg bg-fairway-700 font-medium text-white hover:bg-fairway-800 disabled:opacity-50 ${pad}`}
      >
        {busy ? "Working…" : "Approve & submit to Meta"}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className={`rounded-lg border border-gray-200 bg-white font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 ${pad}`}
      >
        Reject
      </button>
    </div>
  );
}

function LaneCards({ byScenario, onViewStatic }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Object.entries(SCENARIOS).map(([key, meta]) => {
        const counts = byScenario?.[key] || {};
        const sent = counts.SENT || 0;
        const suppressed = counts.SUPPRESSED || 0;
        const inProgress =
          (counts.PENDING || 0) + (counts.TEMPLATE_CREATED || 0);
        const IconComp = meta.icon;
        return (
          <div
            key={key}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-fairway-600">
                  <IconComp />
                </span>
                <h3 className="text-sm font-medium text-gray-900">
                  {meta.label}
                </h3>
              </div>
              <Badge variant={meta.lane === "Dynamic" ? "info" : "neutral"}>
                {meta.lane}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-gray-400">{meta.laneHint}</p>
            {meta.lane === "Static" && (
              <button
                onClick={() => onViewStatic(key)}
                className="mt-2 text-xs font-medium text-fairway-700 hover:text-fairway-900"
              >
                View message →
              </button>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-gray-900">{sent}</p>
                <p className="text-xs text-gray-400">Sent</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {inProgress}
                </p>
                <p className="text-xs text-gray-400">In progress</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {suppressed}
                </p>
                <p className="text-xs text-gray-400">Suppressed</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ApprovalCard({ template, busy, onOpen, onApprove, onReject }) {
  const body = fillBody(template.bodyDraft, template.variables);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row">
      {template.imageUrl ? (
        <img
          src={template.imageUrl}
          alt=""
          className="h-28 w-full shrink-0 rounded-lg object-cover sm:w-28"
        />
      ) : (
        <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-400 sm:w-28">
          No image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{scenarioLabel(template.scenario)}</Badge>
          <span className="text-xs text-gray-400">
            {formatDateTime(template.createdAt)}
          </span>
        </div>
        <button
          onClick={onOpen}
          className="mt-2 block w-full text-left text-sm text-gray-900 hover:text-fairway-700"
        >
          {body}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          For {template.customer?.name || "Unknown customer"} · drafted{" "}
          {formatInr(template.draftCostInr)}
        </p>
        <div className="mt-3">
          <ApprovalButtons
            busy={busy}
            size="sm"
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      </div>
    </div>
  );
}

function ApprovalQueue({ items, loading, error, busyId, onOpen, onDecide }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Couldn't load the approval queue.
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting for approval"
        description="New AI-drafted campaign messages will appear here for you to approve before they go to Meta."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <ApprovalCard
          key={t.id}
          template={t}
          busy={busyId === t.id}
          onOpen={() => onOpen(t)}
          onApprove={() => onDecide(t.id, "approve")}
          onReject={() => onDecide(t.id, "reject")}
        />
      ))}
    </div>
  );
}

function TemplatesTable({ rows, loading, error, onOpen }) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Couldn't load templates.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No campaign templates yet"
        description="Once a cross-sell draft is created, it shows up here with its progress through approval, Meta review and sending."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-2.5 font-medium">Customer</th>
            <th className="px-4 py-2.5 font-medium">Scenario</th>
            <th className="px-4 py-2.5 font-medium">Message</th>
            <th className="px-4 py-2.5 font-medium">Stage</th>
            <th className="px-4 py-2.5 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((t) => (
            <tr
              key={t.id}
              onClick={() => onOpen(t)}
              className="cursor-pointer hover:bg-fairway-50/30"
            >
              <td className="px-4 py-3 text-gray-900">
                {t.customer?.name || "—"}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {scenarioLabel(t.scenario)}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-gray-500">
                {fillBody(t.bodyDraft, t.variables)}
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={t.stage} />
              </td>
              <td className="px-4 py-3 text-right text-xs text-gray-400">
                {formatDate(t.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriggersTable({ rows, loading, error }) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Couldn't load the trigger log.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        No campaign triggers match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-2.5 font-medium">Customer</th>
            <th className="px-4 py-2.5 font-medium">Scenario</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Note</th>
            <th className="px-4 py-2.5 text-right font-medium">Detected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((t) => {
            const status =
              TRIGGER_STATUSES[t.status] || TRIGGER_STATUSES.PENDING;
            return (
              <tr key={t.id} className="hover:bg-fairway-50/30">
                <td className="px-4 py-3 text-gray-900">
                  {t.customer?.name || "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {scenarioLabel(t.scenario)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-400">
                  {t.suppressedReason || "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {formatDateTime(t.detectedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Read-only view of a pre-approved template behind a static lane.
function StaticTemplateDrawer({ scenario, onClose }) {
  const meta = SCENARIOS[scenario];
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchStaticCampaignTemplate(scenario)
      .then((res) => {
        if (!cancelled)
          setState({ loading: false, data: res.data.data, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            loading: false,
            data: null,
            error: err.response?.data?.error || "Couldn't load the template.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const t = state.data;
  const examples = t?.exampleVariables || [];
  const preview = t ? fillBody(t.bodyText, examples) : "";

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${meta?.label || scenario} message`}
      subtitle="Pre-approved template, sent by the scheduler"
    >
      {state.loading && (
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      {t && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={t.status === "APPROVED" ? "positive" : "warning"}>
              {t.status === "APPROVED" ? "Approved by Meta" : t.status}
            </Badge>
            <Badge variant="neutral">{t.category}</Badge>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400">Message</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-900">
              {preview}
            </p>
            {t.footerText && (
              <p className="mt-2 text-xs text-gray-400">{t.footerText}</p>
            )}
          </div>

          {examples.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400">
                Variables filled from
              </p>
              <ul className="mt-1 space-y-1 text-sm text-gray-700">
                {examples.map((v, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-gray-400">{`{{${i + 1}}}`}</span>{" "}
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-400">Template name</dt>
            <dd className="break-all text-gray-900">{t.templateName}</dd>
            <dt className="text-gray-400">Header</dt>
            <dd className="text-gray-900">{t.headerFormat || "Text only"}</dd>
          </dl>
        </div>
      )}
    </Drawer>
  );
}

function TemplateDrawer({ template, busy, onClose, onDecide }) {
  if (!template) return null;
  const body = fillBody(template.bodyDraft, template.variables);
  const pending = template.internalApprovalStatus === "PENDING";

  return (
    <Drawer
      open
      onClose={onClose}
      title={scenarioLabel(template.scenario)}
      subtitle={template.customer?.name || "Unknown customer"}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={template.stage} />
          <Badge variant="neutral">{template.category}</Badge>
        </div>

        {template.imageUrl && (
          <img
            src={template.imageUrl}
            alt=""
            className="w-full rounded-lg object-cover"
          />
        )}

        <div>
          <p className="text-xs font-medium text-gray-400">Message</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-900">
            {body}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-400">Drafted</dt>
          <dd className="text-gray-900">
            {formatDateTime(template.createdAt)}
          </dd>
          <dt className="text-gray-400">Draft cost</dt>
          <dd className="text-gray-900">{formatInr(template.draftCostInr)}</dd>
          <dt className="text-gray-400">Approved by</dt>
          <dd className="text-gray-900">
            {template.internalApprovedBy || "—"}
          </dd>
          <dt className="text-gray-400">Meta status</dt>
          <dd className="text-gray-900">
            {template.metaStatus?.replace(/_/g, " ").toLowerCase()}
          </dd>
          <dt className="text-gray-400">Sent</dt>
          <dd className="text-gray-900">{formatDateTime(template.sentAt)}</dd>
          <dt className="text-gray-400">Template name</dt>
          <dd className="break-all text-gray-900">{template.templateName}</dd>
        </dl>

        {template.metaRejectionReason && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {template.metaRejectionReason}
          </p>
        )}

        {pending && (
          <ApprovalButtons
            busy={busy}
            onApprove={() => onDecide(template.id, "approve")}
            onReject={() => onDecide(template.id, "reject")}
          />
        )}
      </div>
    </Drawer>
  );
}

const TABS = [
  { id: "queue", label: "Approval queue", icon: SparkIcon },
  { id: "templates", label: "Templates", icon: ReceiptIcon },
  { id: "triggers", label: "Trigger log", icon: MegaphoneIcon },
];

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Campaigns() {
  useDocumentTitle("Campaigns");

  const [tab, setTab] = useState("queue");
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [staticScenario, setStaticScenario] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [tplScenario, setTplScenario] = useState("");
  const [tplPage, setTplPage] = useState(1);
  const [trScenario, setTrScenario] = useState("");
  const [trStatus, setTrStatus] = useState("");
  const [trPage, setTrPage] = useState(1);

  const summary = useKeyedFetch(`summary|${refreshTick}`, () =>
    fetchCampaignSummary(),
  );

  const queue = useKeyedFetch(`queue|${refreshTick}`, () =>
    fetchCampaignTemplates({ approval: "PENDING", limit: 50 }),
  );

  const templates = useKeyedFetch(
    `templates|${tplScenario}|${tplPage}|${refreshTick}`,
    () =>
      fetchCampaignTemplates({
        ...(tplScenario && { scenario: tplScenario }),
        page: tplPage,
        limit: LIMIT,
      }),
  );

  const triggers = useKeyedFetch(
    `triggers|${trScenario}|${trStatus}|${trPage}|${refreshTick}`,
    () =>
      fetchCampaignTriggers({
        ...(trScenario && { scenario: trScenario }),
        ...(trStatus && { status: trStatus }),
        page: trPage,
        limit: LIMIT,
      }),
  );

  const decide = async (id, action) => {
    setBusyId(id);
    setActionError(null);
    try {
      if (action === "approve") await approveCampaignTemplate(id);
      else await rejectCampaignTemplate(id);
      setSelected(null);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setActionError(
        err.response?.data?.error ||
          "Couldn't record that decision. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const s = summary.data;
  const pipeline = s?.pipeline;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Birthday, replenishment and cross-sell messages. AI-drafted messages wait for your approval before they reach Meta."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          label="Awaiting approval"
          value={pipeline?.awaitingApproval}
          loading={!s && !summary.error}
          hint={pipeline?.awaitingApproval ? "Needs your review" : "All clear"}
        />
        <StatCard
          label="Awaiting Meta"
          value={pipeline?.awaitingMeta}
          loading={!s && !summary.error}
        />
        <StatCard
          label="Scheduled"
          value={pipeline?.scheduled}
          loading={!s && !summary.error}
        />
        <StatCard
          label="Sent"
          value={pipeline?.sent}
          loading={!s && !summary.error}
        />
        <StatCard
          label="Failed"
          value={pipeline ? pipeline.failed + pipeline.metaRejected : undefined}
          loading={!s && !summary.error}
          hint="Send or Meta rejections"
        />
        <StatCard
          label="Draft cost"
          value={s ? formatInr(s.draftCostInr) : undefined}
          loading={!s && !summary.error}
          hint="AI drafting, all time"
        />
      </div>

      <div className="mt-6">
        <LaneCards
          byScenario={s?.byScenario}
          onViewStatic={setStaticScenario}
        />
      </div>

      <div className="mt-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-fairway-700 text-fairway-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "queue" && queue.data?.total > 0 && (
                <span className="ml-1 rounded-full bg-gold-300/40 px-1.5 text-xs text-gold-600">
                  {queue.data.total}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </p>
      )}

      <div className="mt-5">
        {tab === "queue" && (
          <ApprovalQueue
            items={queue.data?.data || []}
            loading={queue.loading}
            error={queue.error}
            busyId={busyId}
            onOpen={setSelected}
            onDecide={decide}
          />
        )}

        {tab === "templates" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                value={tplScenario}
                onChange={(e) => {
                  setTplScenario(e.target.value);
                  setTplPage(1);
                }}
                className={selectClass}
              >
                <option value="">All scenarios</option>
                {Object.entries(SCENARIOS).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <TemplatesTable
              rows={templates.data?.data || []}
              loading={templates.loading}
              error={templates.error}
              onOpen={setSelected}
            />
            <Pager
              page={tplPage}
              totalPages={templates.data?.totalPages}
              onPage={setTplPage}
            />
          </>
        )}

        {tab === "triggers" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                value={trScenario}
                onChange={(e) => {
                  setTrScenario(e.target.value);
                  setTrPage(1);
                }}
                className={selectClass}
              >
                <option value="">All scenarios</option>
                {Object.entries(SCENARIOS).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={trStatus}
                onChange={(e) => {
                  setTrStatus(e.target.value);
                  setTrPage(1);
                }}
                className={selectClass}
              >
                <option value="">All statuses</option>
                {Object.entries(TRIGGER_STATUSES).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <TriggersTable
              rows={triggers.data?.data || []}
              loading={triggers.loading}
              error={triggers.error}
            />
            <Pager
              page={trPage}
              totalPages={triggers.data?.totalPages}
              onPage={setTrPage}
            />
          </>
        )}
      </div>

      {staticScenario && (
        <StaticTemplateDrawer
          key={staticScenario}
          scenario={staticScenario}
          onClose={() => setStaticScenario(null)}
        />
      )}

      <TemplateDrawer
        template={selected}
        busy={busyId === selected?.id}
        onClose={() => setSelected(null)}
        onDecide={decide}
      />
    </div>
  );
}
