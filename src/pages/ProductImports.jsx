// src/pages/ProductImports.jsx
//
// New products waiting for approval (both the one-by-one supplier-agent
// flow and bulk catalog imports land in the same ProductDraft queue), and
// the bulk-import batches themselves — progress, margin/GST rates
// applied, timing, and real AI cost. Approving/rejecting here goes
// through the same backend service the emailed approval link uses, so
// the two paths can't drift apart.

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchProductImportSummary,
  fetchProductDrafts,
  approveProductDraft,
  rejectProductDraft,
  fetchProductImportBatches,
  fetchProductImportBatch,
} from "../api/productImports";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { formatCurrency, formatDateTime } from "../lib/format";
import { InboxDownloadIcon, ClipboardListIcon } from "../components/icons";

const LIMIT = 20;

const DRAFT_STATUS = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "positive" },
  REJECTED: { label: "Rejected", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "neutral" },
};

const BATCH_STATUS = {
  PENDING_EXTRACTION: { label: "Parsing document…", variant: "info" },
  PROCESSING: { label: "In progress", variant: "info" },
  DONE: { label: "Done", variant: "positive" },
};

const ITEM_STATUS = {
  PENDING: { label: "Queued", variant: "neutral" },
  RESEARCHING: { label: "Researching", variant: "info" },
  DRAFTED: { label: "Drafted", variant: "positive" },
  LINKED_EXISTING: { label: "Already in catalog", variant: "positive" },
  FAILED: { label: "Failed", variant: "danger" },
  NEEDS_RATE: { label: "Needs margin/GST", variant: "warning" },
  NEEDS_BRAND_REVIEW: { label: "Brand not approved", variant: "warning" },
  ALREADY_DRAFTED: { label: "Already drafted", variant: "positive" },
};

function StatusBadge({ map, status }) {
  const meta = map[status] || { label: status, variant: "neutral" };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

// Results stored with the key that produced them, so "loading" is
// derived instead of set synchronously inside the effect — same pattern
// as Campaigns.jsx.
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
  return { data: current?.data ?? null, error: current?.error ?? false, loading: !current };
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

function ApprovalButtons({ busy, onApprove, onReject }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="rounded-lg bg-fairway-700 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800 disabled:opacity-50"
      >
        {busy ? "Working…" : "Approve & publish"}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

function DraftCard({ draft, busy, onOpen, onApprove, onReject }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row">
      {draft.imageUrl ? (
        <img
          src={draft.imageUrl}
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
          <Badge variant={draft.sourceType === "WEB_SCRAPED" ? "info" : "neutral"}>
            {draft.sourceType === "WEB_SCRAPED" ? "Web-researched" : "Supplier-provided"}
          </Badge>
          {draft.variants && draft.variants.length > 1 && (
            <Badge variant="neutral">{draft.variants.length} variants</Badge>
          )}
          <span className="text-xs text-gray-400">{formatDateTime(draft.createdAt)}</span>
        </div>
        <button
          onClick={onOpen}
          className="mt-2 block text-left text-sm font-medium text-gray-900 hover:text-fairway-700"
        >
          {draft.title || "Untitled product"}
        </button>
        <p className="mt-1 text-xs text-gray-500">
          {draft.supplier?.name || "Unknown supplier"} · {formatCurrency(draft.price)}
          {draft.brand ? ` · ${draft.brand}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center sm:items-end">
        <ApprovalButtons busy={busy} onApprove={onApprove} onReject={onReject} />
      </div>
    </div>
  );
}

function DraftsQueue({ items, loading, error, busyId, onOpen, onDecide }) {
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
        description="New products — from a supplier mentioning one in chat, or a bulk catalog import — show up here before they go live on Shopify."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((d) => (
        <DraftCard
          key={d.id}
          draft={d}
          busy={busyId === d.id}
          onOpen={() => onOpen(d)}
          onApprove={() => onDecide(d.id, "approve")}
          onReject={() => onDecide(d.id, "reject")}
        />
      ))}
    </div>
  );
}

function DraftHistoryTable({ rows, loading, error, onOpen }) {
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Couldn't load product drafts.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        No product drafts match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-2.5 font-medium">Product</th>
            <th className="px-4 py-2.5 font-medium">Supplier</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Decided by</th>
            <th className="px-4 py-2.5 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((d) => (
            <tr key={d.id} onClick={() => onOpen(d)} className="cursor-pointer hover:bg-fairway-50/30">
              <td className="max-w-xs truncate px-4 py-3 text-gray-900">{d.title || "Untitled"}</td>
              <td className="px-4 py-3 text-gray-500">{d.supplier?.name || "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge map={DRAFT_STATUS} status={d.approvalStatus} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {d.decidedBy || (d.approvedVia ? d.approvedVia.toLowerCase() : "—")}
              </td>
              <td className="px-4 py-3 text-right text-xs text-gray-400">{formatDateTime(d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchesTable({ rows, loading, error, onOpen }) {
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        Couldn't load import batches.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No bulk imports yet"
        description="When a supplier sends a large catalog/price list, it shows up here with its progress, margin/GST rules, timing and cost."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-2.5 font-medium">Supplier</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Progress</th>
            <th className="px-4 py-2.5 font-medium">Drafted / Linked / Needs rate / Failed</th>
            <th className="px-4 py-2.5 font-medium">Cost</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 text-right font-medium">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((b) => (
            <tr key={b.id} onClick={() => onOpen(b)} className="cursor-pointer hover:bg-fairway-50/30">
              <td className="px-4 py-3 text-gray-900">{b.supplier?.name || "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge map={BATCH_STATUS} status={b.status} />
              </td>
              <td className="px-4 py-3 text-gray-500">
                {b.processedItems} / {b.totalItems}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                <span className="text-fairway-700">{b.draftedCount}</span>
                {" / "}
                <span className="text-blue-600">{b.linkedCount}</span>
                {" / "}
                <span className={b.needsRateCount > 0 ? "text-gold-600 font-medium" : ""}>{b.needsRateCount}</span>
                {" / "}
                <span className={b.failedCount > 0 ? "text-red-600 font-medium" : ""}>{b.failedCount}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{formatCurrency(b.cost?.costInr)}</td>
              <td className="px-4 py-3 text-gray-500">{formatDuration(b.durationMs)}</td>
              <td className="px-4 py-3 text-right text-xs text-gray-400">{formatDateTime(b.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DraftDrawer({ draft, busy, onClose, onDecide }) {
  if (!draft) return null;
  const pending = draft.approvalStatus === "PENDING";
  const variants = draft.variants || [];

  return (
    <Drawer open onClose={onClose} title={draft.title || "Untitled product"} subtitle={draft.supplier?.name}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge map={DRAFT_STATUS} status={draft.approvalStatus} />
          <Badge variant={draft.sourceType === "WEB_SCRAPED" ? "info" : "neutral"}>
            {draft.sourceType === "WEB_SCRAPED" ? "Web-researched" : "Supplier-provided"}
          </Badge>
        </div>

        {draft.imageUrl && <img src={draft.imageUrl} alt="" className="w-full rounded-lg object-cover" />}

        {draft.specs && (
          <div>
            <p className="text-xs font-medium text-gray-400">Description</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-900">{draft.specs}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-400">Price (MRP)</dt>
          <dd className="text-gray-900">{formatCurrency(draft.price)}</dd>
          <dt className="text-gray-400">Cost price</dt>
          <dd className="text-gray-900">{formatCurrency(draft.costPrice)}</dd>
          <dt className="text-gray-400">Margin / GST</dt>
          <dd className="text-gray-900">
            {draft.marginPercent ?? "—"}% / {draft.gstPercent ?? "—"}%
          </dd>
          <dt className="text-gray-400">Brand</dt>
          <dd className="text-gray-900">{draft.brand || "—"}</dd>
          <dt className="text-gray-400">SKU</dt>
          <dd className="text-gray-900">{draft.sku || "—"}</dd>
          <dt className="text-gray-400">Category</dt>
          <dd className="text-gray-900">{draft.category || "—"}</dd>
        </dl>

        {variants.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Variants ({draft.variantOptionName || "option"})
            </p>
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {variants.map((v, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-900">{v.value || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{v.sku || "—"}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{formatCurrency(v.mrp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {draft.sourceNotes && (
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">{draft.sourceNotes}</p>
        )}

        {!pending && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-500">
            <dt>Decided via</dt>
            <dd>{draft.approvedVia || "—"}</dd>
            <dt>Decided by</dt>
            <dd>{draft.decidedBy || "—"}</dd>
            <dt>Decided at</dt>
            <dd>{formatDateTime(draft.decidedAt)}</dd>
          </dl>
        )}

        {pending && (
          <ApprovalButtons
            busy={busy}
            onApprove={() => onDecide(draft.id, "approve")}
            onReject={() => onDecide(draft.id, "reject")}
          />
        )}
      </div>
    </Drawer>
  );
}

function BatchDrawer({ batchId, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchProductImportBatch(batchId)
      .then((res) => {
        if (!cancelled) setState({ loading: false, data: res.data.data, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ loading: false, data: null, error: err.response?.data?.error || "Couldn't load this batch." });
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const b = state.data;

  return (
    <Drawer open onClose={onClose} title={b?.supplier?.name || "Import batch"} subtitle={b ? formatDateTime(b.createdAt) : undefined}>
      {state.loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {state.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{state.error}</p>}

      {b && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={BATCH_STATUS} status={b.status} />
            <span className="text-xs text-gray-400">
              {b.processedItems} / {b.totalItems} processed
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-400">Drafted</dt>
            <dd className="text-fairway-700">{b.draftedCount}</dd>
            <dt className="text-gray-400">Already in catalog</dt>
            <dd className="text-blue-600">{b.linkedCount}</dd>
            <dt className="text-gray-400">Needs margin/GST</dt>
            <dd className={b.needsRateCount > 0 ? "font-medium text-gold-600" : "text-gray-900"}>
              {b.needsRateCount}
            </dd>
            <dt className="text-gray-400">Failed</dt>
            <dd className={b.failedCount > 0 ? "font-medium text-red-600" : "text-gray-900"}>{b.failedCount}</dd>
            <dt className="text-gray-400">Duration</dt>
            <dd className="text-gray-900">{formatDuration(b.durationMs)}</dd>
            <dt className="text-gray-400">AI cost</dt>
            <dd className="text-gray-900">
              {formatCurrency(b.cost?.costInr)}{" "}
              <span className="text-xs text-gray-400">({b.cost?.calls || 0} calls)</span>
            </dd>
          </dl>

          {Array.isArray(b.rateRules) && b.rateRules.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-400">Margin/GST rules applied</p>
              <ul className="space-y-1 rounded-lg border border-gray-100 p-3 text-xs text-gray-700">
                {b.rateRules.map((r, i) => (
                  <li key={i}>
                    {r.brand || r.category ? (
                      <span className="text-gray-900">{[r.brand, r.category].filter(Boolean).join(" · ")}</span>
                    ) : (
                      <span className="text-gray-900">Default (everything else)</span>
                    )}
                    {" — "}
                    {r.marginPercent}% margin, {r.gstPercent}% GST
                  </li>
                ))}
              </ul>
            </div>
          )}

          {b.extractionError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{b.extractionError}</p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">Items ({b.items.length})</p>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {b.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-gray-900">{item.title}</p>
                    <p className="truncate text-xs text-gray-400">
                      {[item.brand, item.category].filter(Boolean).join(" · ") || "—"}
                      {item.variantCount > 1 ? ` · ${item.variantCount} variants` : ""}
                    </p>
                    {["FAILED", "NEEDS_RATE", "NEEDS_BRAND_REVIEW"].includes(item.status) && item.errorMessage && (
                      <p
                        className={`mt-0.5 truncate text-xs ${item.status === "FAILED" ? "text-red-500" : "text-gold-600"}`}
                      >
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                  <StatusBadge map={ITEM_STATUS} status={item.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

const TABS = [
  { id: "queue", label: "Approval queue", icon: InboxDownloadIcon },
  { id: "drafts", label: "All drafts", icon: ClipboardListIcon },
  { id: "batches", label: "Import batches", icon: InboxDownloadIcon },
];

export default function ProductImports() {
  useDocumentTitle("Product Imports");

  const [tab, setTab] = useState("queue");
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [draftStatus, setDraftStatus] = useState("");
  const [draftPage, setDraftPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);

  const summary = useKeyedFetch(`summary|${refreshTick}`, () => fetchProductImportSummary());

  const queue = useKeyedFetch(`queue|${refreshTick}`, () =>
    fetchProductDrafts({ status: "PENDING", limit: 50 }),
  );

  const drafts = useKeyedFetch(`drafts|${draftStatus}|${draftPage}|${refreshTick}`, () =>
    fetchProductDrafts({ ...(draftStatus && { status: draftStatus }), page: draftPage, limit: LIMIT }),
  );

  const batches = useKeyedFetch(`batches|${batchPage}|${refreshTick}`, () =>
    fetchProductImportBatches({ page: batchPage, limit: LIMIT }),
  );

  const decide = async (id, action) => {
    const title =
      [selectedDraft, ...(queue.data?.data || []), ...(drafts.data?.data || [])].find((d) => d?.id === id)?.title ||
      "Product";
    setBusyId(id);
    setActionError(null);
    try {
      if (action === "approve") await approveProductDraft(id);
      else await rejectProductDraft(id);
      setSelectedDraft(null);
      setRefreshTick((t) => t + 1);
      toast.success(
        action === "approve" ? `${title} approved and published to Shopify` : `${title} rejected and removed from Shopify`,
      );
    } catch (err) {
      const message = err.response?.data?.error || "Couldn't record that decision. Try again.";
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Product Imports"
        subtitle="New products from suppliers — one at a time or a whole catalog — waiting for your approval before they go live on Shopify."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          label="Awaiting approval"
          value={s?.pendingDrafts}
          loading={!s && !summary.error}
          hint={s?.pendingDrafts ? "Needs your review" : "All clear"}
        />
        <StatCard label="Batches in progress" value={s?.batchesInProgress} loading={!s && !summary.error} />
        <StatCard label="Drafted, all time" value={s?.totalDrafted} loading={!s && !summary.error} />
        <StatCard
          label="Needs margin/GST"
          value={s?.totalNeedsRate}
          loading={!s && !summary.error}
          hint={s?.totalNeedsRate ? "Ask the supplier" : undefined}
        />
        <StatCard
          label="Needs brand review"
          value={s?.totalNeedsBrandReview}
          loading={!s && !summary.error}
          hint={s?.totalNeedsBrandReview ? "Confirm supplier's brands" : undefined}
        />
        <StatCard
          label="AI cost, all time"
          value={s ? formatCurrency(s.totalCostInr) : undefined}
          loading={!s && !summary.error}
          hint="Bulk import parsing + research"
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
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-5">
        {tab === "queue" && (
          <DraftsQueue
            items={queue.data?.data || []}
            loading={queue.loading}
            error={queue.error}
            busyId={busyId}
            onOpen={setSelectedDraft}
            onDecide={decide}
          />
        )}

        {tab === "drafts" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                value={draftStatus}
                onChange={(e) => {
                  setDraftStatus(e.target.value);
                  setDraftPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
              >
                <option value="">All statuses</option>
                {Object.entries(DRAFT_STATUS).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <DraftHistoryTable
              rows={drafts.data?.data || []}
              loading={drafts.loading}
              error={drafts.error}
              onOpen={setSelectedDraft}
            />
            <Pager page={draftPage} totalPages={drafts.data?.totalPages} onPage={setDraftPage} />
          </>
        )}

        {tab === "batches" && (
          <>
            <BatchesTable
              rows={batches.data?.data || []}
              loading={batches.loading}
              error={batches.error}
              onOpen={(b) => setSelectedBatchId(b.id)}
            />
            <Pager page={batchPage} totalPages={batches.data?.totalPages} onPage={setBatchPage} />
          </>
        )}
      </div>

      <DraftDrawer
        draft={selectedDraft}
        busy={busyId === selectedDraft?.id}
        onClose={() => setSelectedDraft(null)}
        onDecide={decide}
      />

      {selectedBatchId && (
        <BatchDrawer key={selectedBatchId} batchId={selectedBatchId} onClose={() => setSelectedBatchId(null)} />
      )}
    </div>
  );
}
