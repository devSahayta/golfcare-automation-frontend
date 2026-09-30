// src/pages/Orders.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOrders, fetchOrderById } from "../api/orders";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";
import EmptyState from "../components/ui/EmptyState";
import { AuditTimeline } from "../components/AuditLogParts";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";

const LIMIT = 20;

const FINANCIAL_OPTIONS = [
  "paid",
  "pending",
  "authorized",
  "partially_paid",
  "partially_refunded",
  "refunded",
  "voided",
];
const FULFILLMENT_OPTIONS = [
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "partial", label: "Partial" },
  { value: "fulfilled", label: "Fulfilled" },
];

function financialVariant(s) {
  if (s === "paid") return "positive";
  if (s === "pending" || s === "authorized" || s === "partially_paid")
    return "warning";
  if (s === "refunded" || s === "partially_refunded" || s === "voided")
    return "danger";
  return "neutral";
}
function fulfillmentVariant(s) {
  if (s === "fulfilled") return "positive";
  if (s === "partial") return "warning";
  return "neutral";
}
const label = (s) => (s || "unfulfilled").replace(/_/g, " ");

function customerName(c) {
  if (!c) return null;
  return (
    [c.firstName, c.lastName].filter(Boolean).join(" ") || c.waPhone || null
  );
}

const COLUMNS = [
  {
    key: "orderNumber",
    header: "Order",
    render: (row) => (
      <span className="font-medium text-gray-900">
        {String(row.orderNumber).startsWith("#")
          ? row.orderNumber
          : `#${row.orderNumber}`}
      </span>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    render: (row) =>
      customerName(row.customer || row.Customer) || (
        <span className="text-gray-400">Guest</span>
      ),
  },
  {
    key: "financialStatus",
    header: "Payment",
    render: (row) => (
      <Badge variant={financialVariant(row.financialStatus)}>
        {label(row.financialStatus)}
      </Badge>
    ),
  },
  {
    key: "fulfillmentStatus",
    header: "Fulfillment",
    render: (row) => (
      <Badge variant={fulfillmentVariant(row.fulfillmentStatus)}>
        {label(row.fulfillmentStatus)}
      </Badge>
    ),
  },
  { key: "itemCount", header: "Items" },
  {
    key: "totalPrice",
    header: "Total",
    render: (row) => formatCurrency(row.totalPrice),
  },
  {
    key: "placedAt",
    header: "Placed",
    render: (row) => formatDate(row.placedAt),
  },
];

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400";

export default function Orders() {
  useDocumentTitle("Orders");
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [financialStatus, setFinancialStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The open order lives in the URL (?open=<id>) so the Audit Log can
  // deep-link straight to an order.
  const selectedId = searchParams.get("open");
  const [detailState, setDetailState] = useState({
    id: null,
    data: null,
    failed: false,
  });

  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrders({
      search: search || undefined,
      financialStatus: financialStatus || undefined,
      fulfillmentStatus: fulfillmentStatus || undefined,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
        setError(null);
      })
      .catch(() => !cancelled && setError("Couldn't load orders."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, financialStatus, fulfillmentStatus, offset]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchOrderById(selectedId)
      .then((res) => {
        if (!cancelled)
          setDetailState({ id: selectedId, data: res.data, failed: false });
      })
      .catch(() => {
        if (!cancelled)
          setDetailState({ id: selectedId, data: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function resetAnd(setter) {
    return (value) => {
      setLoading(true);
      setOffset(0);
      setter(value);
    };
  }
  const applyFinancial = resetAnd(setFinancialStatus);
  const applyFulfillment = resetAnd(setFulfillmentStatus);

  function handleSearchChange(value) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => resetAnd(setSearch)(value), 350);
  }

  function handlePageChange(newOffset) {
    setLoading(true);
    setOffset(newOffset);
  }

  const openOrder = (row) => setSearchParams({ open: row.id });
  const closeDrawer = () => setSearchParams({});

  const detailLoading = !!selectedId && detailState.id !== selectedId;
  const detail = detailState.id === selectedId ? detailState.data : null;
  const customer = detail && (detail.customer || detail.Customer);
  const lineItems = Array.isArray(detail?.lineItems) ? detail.lineItems : [];
  const filtered = search || financialStatus || fulfillmentStatus;

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Orders synced from Shopify, with a change history for each."
        actions={
          <input
            type="text"
            placeholder="Search order #, email, or phone…"
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400 sm:w-72"
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={financialStatus}
          onChange={(e) => applyFinancial(e.target.value)}
          className={selectClass}
        >
          <option value="">All payment statuses</option>
          {FINANCIAL_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          value={fulfillmentStatus}
          onChange={(e) => applyFulfillment(e.target.value)}
          className={selectClass}
        >
          <option value="">All fulfillment statuses</option>
          {FULFILLMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <EmptyState title="Couldn't load orders" description={error} />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={items}
          loading={loading}
          onRowClick={openOrder}
          emptyTitle="No orders found"
          emptyDescription={
            filtered
              ? "Try clearing a filter or searching for something else."
              : "Orders will appear here as Shopify sends them."
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
        open={!!selectedId}
        onClose={closeDrawer}
        title={
          detail
            ? `Order ${String(detail.orderNumber).startsWith("#") ? "" : "#"}${detail.orderNumber}`
            : "Loading…"
        }
        subtitle={detail ? formatDateTime(detail.placedAt) : undefined}
      >
        {detailState.failed && detailState.id === selectedId ? (
          <EmptyState
            title="Order not found"
            description="It may have been removed."
          />
        ) : detailLoading || !detail ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Payment</p>
                <Badge
                  variant={financialVariant(detail.financialStatus)}
                  className="mt-1"
                >
                  {label(detail.financialStatus)}
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Fulfillment</p>
                <Badge
                  variant={fulfillmentVariant(detail.fulfillmentStatus)}
                  className="mt-1"
                >
                  {label(detail.fulfillmentStatus)}
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Total</p>
                <p className="mt-1 text-sm text-gray-800">
                  {formatCurrency(detail.totalPrice)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Fulfilled (first seen)</p>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.deliveredAt ? formatDate(detail.deliveredAt) : "—"}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Customer
              </h3>
              {customer ? (
                <div className="space-y-1 rounded-lg border border-gray-100 p-3 text-sm">
                  <p className="font-medium text-gray-900">
                    {customerName(customer)}
                  </p>
                  {customer.waPhone && (
                    <p className="text-gray-500">{customer.waPhone}</p>
                  )}
                  {customer.email && (
                    <p className="text-gray-500">{customer.email}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Not linked to a customer record.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Items ({lineItems.length})
              </h3>
              {lineItems.length > 0 ? (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {lineItems.map((li, i) => (
                    <li
                      key={li.id || i}
                      className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-gray-900">{li.title || li.name}</p>
                        <p className="text-xs text-gray-400">
                          {[li.variant_title, li.sku && `SKU ${li.sku}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-gray-800">
                          {formatCurrency(
                            Number(li.price) * (li.quantity || 1),
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {li.quantity || 1} × {formatCurrency(li.price)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No line items.</p>
              )}
              {detail.discountCodes?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.discountCodes.map((c) => (
                    <Badge key={c} variant="info">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Activity</h3>
                <Link
                  to={`/audit-log?entityType=Order&entityId=${detail.id}`}
                  className="text-xs text-fairway-700 hover:underline"
                >
                  View in audit log
                </Link>
              </div>
              <AuditTimeline logs={detail.activity} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
