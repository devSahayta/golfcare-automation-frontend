// src/pages/AuditLog.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAuditLogs, fetchAuditLogMeta } from "../api/auditLogs";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import { ActorBadge, StateDiff } from "../components/AuditLogParts";
import { actionVariant } from "../lib/audit";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { formatDateTime, humanizeAction } from "../lib/format";

const LIMIT = 50;

const inputClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400";

// Only Orders have a screen that can open a specific record today.
function entityHref(log) {
  if (log.entityType === "Order") return `/orders?open=${log.entityId}`;
  return null;
}

function EntityCell({ log }) {
  const href = entityHref(log);
  const short = log.entityId ? String(log.entityId).slice(0, 8) : "—";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-gray-800">{log.entityType}</span>
      {href ? (
        <Link
          to={href}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-fairway-700 hover:underline"
        >
          {short}
        </Link>
      ) : (
        <span className="font-mono text-xs text-gray-400">{short}</span>
      )}
    </span>
  );
}

const COLUMNS = [
  {
    key: "createdAt",
    header: "When",
    render: (row) => (
      <span className="whitespace-nowrap text-gray-600">
        {formatDateTime(row.createdAt)}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    render: (row) => (
      <Badge variant={actionVariant(row.action)}>
        {humanizeAction(row.action)}
      </Badge>
    ),
  },
  {
    key: "actorType",
    header: "Actor",
    render: (row) => (
      <ActorBadge actorType={row.actorType} actorId={row.actorId} />
    ),
  },
  {
    key: "entity",
    header: "Entity",
    render: (row) => <EntityCell log={row} />,
  },
  {
    key: "source",
    header: "Source",
    render: (row) => <span className="text-gray-500">{row.source || "—"}</span>,
  },
];

export default function AuditLog() {
  useDocumentTitle("Audit Log");
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    actorType: "",
    action: "",
    entityType: searchParams.get("entityType") || "",
    source: "",
    from: "",
    to: "",
  });
  // Typed entity id is debounced separately from the dropdown filters.
  const [entityIdInput, setEntityIdInput] = useState(
    searchParams.get("entityId") || "",
  );
  const [entityId, setEntityId] = useState(entityIdInput);
  const debounceRef = useRef(null);

  const [meta, setMeta] = useState({
    actions: [],
    entityTypes: [],
    sources: [],
    actorTypes: [],
  });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchAuditLogMeta()
      .then((res) => setMeta(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs({
      actorType: filters.actorType || undefined,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      source: filters.source || undefined,
      entityId: entityId.trim() || undefined,
      // Date inputs are local calendar days; make "to" inclusive of the day.
      from: filters.from
        ? new Date(`${filters.from}T00:00:00`).toISOString()
        : undefined,
      to: filters.to
        ? new Date(`${filters.to}T23:59:59.999`).toISOString()
        : undefined,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
        setError(null);
      })
      .catch(() => !cancelled && setError("Couldn't load the audit log."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, entityId, offset]);

  function updateFilter(key, value) {
    setLoading(true);
    setOffset(0);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleEntityIdChange(value) {
    setEntityIdInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setOffset(0);
      setEntityId(value);
    }, 400);
  }

  function clearFilters() {
    setLoading(true);
    setOffset(0);
    setFilters({
      actorType: "",
      action: "",
      entityType: "",
      source: "",
      from: "",
      to: "",
    });
    setEntityIdInput("");
    setEntityId("");
  }

  function handlePageChange(newOffset) {
    setLoading(true);
    setOffset(newOffset);
  }

  const hasFilters =
    Object.values(filters).some(Boolean) || entityId.trim() !== "";

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every change made by staff, agents and system integrations."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filters.actorType}
          onChange={(e) => updateFilter("actorType", e.target.value)}
          className={inputClass}
        >
          <option value="">All actors</option>
          {meta.actorTypes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) => updateFilter("action", e.target.value)}
          className={inputClass}
        >
          <option value="">All actions</option>
          {meta.actions.map((v) => (
            <option key={v} value={v}>
              {humanizeAction(v)}
            </option>
          ))}
        </select>
        <select
          value={filters.entityType}
          onChange={(e) => updateFilter("entityType", e.target.value)}
          className={inputClass}
        >
          <option value="">All entities</option>
          {meta.entityTypes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.source}
          onChange={(e) => updateFilter("source", e.target.value)}
          className={inputClass}
        >
          <option value="">All sources</option>
          {meta.sources.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={entityIdInput}
          onChange={(e) => handleEntityIdChange(e.target.value)}
          placeholder="Entity ID"
          className={`${inputClass} w-44 font-mono text-xs`}
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className={inputClass}
          />
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-fairway-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <EmptyState title="Couldn't load audit log" description={error} />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={items}
          loading={loading}
          onRowClick={setSelected}
          emptyTitle="No log entries found"
          emptyDescription={
            hasFilters
              ? "Try widening your filters or date range."
              : "Activity will appear here as the system runs."
          }
        />
      )}

      <div className="mt-4">
        <Pagination
          total={total}
          limit={LIMIT}
          offset={offset}
          onPageChange={handlePageChange}
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? humanizeAction(selected.action) : ""}
        subtitle={selected ? formatDateTime(selected.createdAt) : undefined}
      >
        {selected && (
          <div className="space-y-6">
            <div className="space-y-2 rounded-lg border border-gray-100 p-3 text-sm">
              <p className="flex items-center justify-between text-gray-500">
                <span>Actor</span>
                <ActorBadge
                  actorType={selected.actorType}
                  actorId={selected.actorId}
                />
              </p>
              <p className="flex items-center justify-between text-gray-500">
                <span>Entity</span>
                <EntityCell log={selected} />
              </p>
              <p className="flex items-center justify-between gap-3 text-gray-500">
                <span>Entity ID</span>
                <span className="break-all font-mono text-xs text-gray-700">
                  {selected.entityId || "—"}
                </span>
              </p>
              <p className="flex items-center justify-between text-gray-500">
                <span>Source</span>
                <span className="text-gray-800">{selected.source || "—"}</span>
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                What changed
              </h3>
              <StateDiff
                before={selected.beforeState}
                after={selected.afterState}
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
