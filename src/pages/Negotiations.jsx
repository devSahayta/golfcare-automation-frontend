// src/pages/Negotiations.jsx
//
// Phase 5 — two read-only tabs: Offers (every price the sales agent has
// ever quoted) and Escalations (every conversation the agent flagged for
// a human). Same tab pattern as Settings.jsx.
//
// Real Offer.status values written by salesAgentTools.js are lowercase
// "active" and "superseded" — there's no separate "expired" status write,
// expiry is just the expiresAt timestamp, so an "active" row past its
// expiresAt is shown here as an "Expired" badge derived client-side
// rather than a status value that doesn't actually exist in the DB.

import { useEffect, useState } from "react";
import { fetchOffers } from "../api/offers";
import { fetchEscalations } from "../api/escalations";
import useDocumentTitle from "../hooks/useDocumentTitle";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import { formatCurrency, timeAgo } from "../lib/format";

const TABS = [
  { key: "escalations", label: "Escalations" },
  { key: "offers", label: "Offers" },
];

const LIMIT = 20;

const URGENCY_VARIANT = {
  high: "danger",
  normal: "warning",
  low: "neutral",
};

function offerStatusBadge(row) {
  if (row.status === "superseded") {
    return <Badge>Superseded</Badge>;
  }
  if (row.status === "active" && new Date(row.expiresAt) < new Date()) {
    return <Badge>Expired</Badge>;
  }
  if (row.status === "active") {
    return <Badge variant="info">Active</Badge>;
  }
  return <Badge>{row.status}</Badge>;
}

function customerCell(customer) {
  if (!customer) return <span className="text-gray-400">—</span>;
  const name =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";
  return (
    <div>
      <span className="font-medium text-gray-900">{name}</span>
      <p className="text-xs text-gray-400">
        {customer.memberCode || customer.waPhone}
      </p>
    </div>
  );
}

const OFFER_COLUMNS = [
  {
    key: "customer",
    header: "Customer",
    render: (row) => customerCell(row.Customer),
  },
  {
    key: "variant",
    header: "Product",
    render: (row) => (
      <div>
        <span className="text-gray-900">{row.Variant?.title || "—"}</span>
        {row.Variant?.sku && (
          <p className="text-xs text-gray-400">SKU {row.Variant.sku}</p>
        )}
      </div>
    ),
  },
  {
    key: "listPrice",
    header: "List",
    render: (row) => formatCurrency(row.listPrice),
  },
  {
    key: "offeredPrice",
    header: "Offered",
    render: (row) => formatCurrency(row.offeredPrice),
  },
  {
    key: "step",
    header: "Step",
    render: (row) =>
      row.step === 9 ? <Badge variant="warning">Owner</Badge> : row.step,
  },
  { key: "status", header: "Status", render: offerStatusBadge },
  { key: "createdAt", header: "Made", render: (row) => timeAgo(row.createdAt) },
];

const ESCALATION_COLUMNS = [
  {
    key: "customer",
    header: "Customer",
    render: (row) => customerCell(row.customer),
  },
  { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  {
    key: "urgency",
    header: "Urgency",
    render: (row) => (
      <Badge variant={URGENCY_VARIANT[row.urgency] || "neutral"}>
        {row.urgency || "—"}
      </Badge>
    ),
  },
  {
    key: "offer",
    header: "Current offer",
    render: (row) =>
      row.offer ? (
        <div>
          <span className="text-gray-900">
            {formatCurrency(row.offer.offeredPrice)}
          </span>
          <p className="text-xs text-gray-400">{row.offer.Variant?.title}</p>
        </div>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  {
    key: "liveFloor",
    header: "Floor now",
    render: (row) =>
      row.liveFloor != null ? formatCurrency(row.liveFloor) : "—",
  },
  {
    key: "conversation",
    header: "WhatsApp",
    render: (row) => row.conversation?.waPhone || "—",
  },
  { key: "createdAt", header: "When", render: (row) => timeAgo(row.createdAt) },
];

export default function Negotiations() {
  useDocumentTitle("Negotiations");
  const [tab, setTab] = useState("escalations");

  const [offers, setOffers] = useState([]);
  const [offersTotal, setOffersTotal] = useState(0);
  const [offersOffset, setOffersOffset] = useState(0);
  const [offersStatus, setOffersStatus] = useState("");
  const [offersLoading, setOffersLoading] = useState(true);

  const [escalations, setEscalations] = useState([]);
  const [escalationsTotal, setEscalationsTotal] = useState(0);
  const [escalationsOffset, setEscalationsOffset] = useState(0);
  const [escalationsLoading, setEscalationsLoading] = useState(true);

  useEffect(() => {
    if (tab !== "offers") return;
    fetchOffers({
      page: Math.floor(offersOffset / LIMIT) + 1,
      limit: LIMIT,
      status: offersStatus || undefined,
    })
      .then((res) => {
        setOffers(res.data.data);
        setOffersTotal(res.data.total);
      })
      .finally(() => setOffersLoading(false));
  }, [tab, offersOffset, offersStatus]);

  useEffect(() => {
    if (tab !== "escalations") return;
    fetchEscalations({
      page: Math.floor(escalationsOffset / LIMIT) + 1,
      limit: LIMIT,
    })
      .then((res) => {
        setEscalations(res.data.data);
        setEscalationsTotal(res.data.total);
      })
      .finally(() => setEscalationsLoading(false));
  }, [tab, escalationsOffset]);

  function handleOffersPageChange(newOffset) {
    setOffersLoading(true);
    setOffersOffset(newOffset);
  }

  function handleEscalationsPageChange(newOffset) {
    setEscalationsLoading(true);
    setEscalationsOffset(newOffset);
  }

  return (
    <div>
      <PageHeader
        title="Negotiations"
        subtitle="Every price the sales agent has quoted, and every conversation it flagged for a human."
      />

      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-fairway-600 text-fairway-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "escalations" && (
        <>
          <DataTable
            columns={ESCALATION_COLUMNS}
            rows={escalations}
            loading={escalationsLoading}
            keyField="id"
            emptyTitle="Nothing escalated"
            emptyDescription="The agent flags a conversation here when it can't confirm stock, hits a negotiation limit, or a high-tier customer needs a human."
          />
          <div className="mt-4">
            <Pagination
              total={escalationsTotal}
              limit={LIMIT}
              offset={escalationsOffset}
              onPageChange={handleEscalationsPageChange}
            />
          </div>
        </>
      )}

      {tab === "offers" && (
        <>
          <div className="mb-4">
            <select
              value={offersStatus}
              onChange={(e) => {
                setOffersLoading(true);
                setOffersOffset(0);
                setOffersStatus(e.target.value);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="superseded">Superseded</option>
            </select>
          </div>
          <DataTable
            columns={OFFER_COLUMNS}
            rows={offers}
            loading={offersLoading}
            keyField="id"
            emptyTitle="No offers yet"
            emptyDescription="Every price the sales agent quotes a member will show up here."
          />
          <div className="mt-4">
            <Pagination
              total={offersTotal}
              limit={LIMIT}
              offset={offersOffset}
              onPageChange={handleOffersPageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
