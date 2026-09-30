// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCustomers } from "../api/customers";
import { fetchProducts } from "../api/products";
import { fetchSuppliers } from "../api/suppliers";
import { fetchOrders } from "../api/orders";
import { fetchAuditLogs } from "../api/auditLogs";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import ActivityFeed from "../components/ActivityFeed";
import { ActorBadge } from "../components/AuditLogParts";
import { actionVariant } from "../lib/audit";
import { formatCurrency, humanizeAction, timeAgo } from "../lib/format";
import useDocumentTitle from "../hooks/useDocumentTitle";
import {
  UsersIcon,
  BagIcon,
  TruckIcon,
  ReceiptIcon,
  ClipboardListIcon,
  ChevronRightIcon,
} from "../components/icons";

const QUICK_LINKS = [
  {
    to: "/orders",
    label: "Orders",
    description: "Track orders and their change history",
    icon: ReceiptIcon,
  },
  {
    to: "/customers",
    label: "Customers",
    description: "Search and review customer profiles",
    icon: UsersIcon,
  },
  {
    to: "/products",
    label: "Products",
    description: "Browse the catalog and stock status",
    icon: BagIcon,
  },
  {
    to: "/suppliers",
    label: "Suppliers",
    description: "Reliability and product coverage",
    icon: TruckIcon,
  },
  {
    to: "/audit-log",
    label: "Audit Log",
    description: "Every change by staff, agents and systems",
    icon: ClipboardListIcon,
  },
];

function financialVariant(s) {
  if (s === "paid") return "positive";
  if (s === "pending" || s === "authorized" || s === "partially_paid")
    return "warning";
  if (s === "refunded" || s === "partially_refunded" || s === "voided")
    return "danger";
  return "neutral";
}

function customerName(c) {
  if (!c) return "Guest";
  return (
    [c.firstName, c.lastName].filter(Boolean).join(" ") || c.waPhone || "Guest"
  );
}

function SectionHeader({ title, to, linkLabel = "View all" }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      <Link to={to} className="text-sm text-fairway-700 hover:text-fairway-900">
        {linkLabel}
      </Link>
    </div>
  );
}

function PanelSkeleton({ rows = 4 }) {
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3.5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function PanelMessage({ children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">
      {children}
    </div>
  );
}

function RecentOrders({ orders, error }) {
  if (error) return <PanelMessage>Couldn't load orders.</PanelMessage>;
  if (orders === null) return <PanelSkeleton />;
  if (orders.length === 0) return <PanelMessage>No orders yet.</PanelMessage>;

  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {orders.map((o) => {
        const number = String(o.orderNumber).startsWith("#")
          ? o.orderNumber
          : `#${o.orderNumber}`;
        return (
          <Link
            key={o.id}
            to={`/orders?open=${o.id}`}
            className="flex items-center gap-3 p-3.5 hover:bg-fairway-50/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                {number}
                <span className="ml-2 font-normal text-gray-500">
                  {customerName(o.customer)}
                </span>
              </span>
              <span className="block text-xs text-gray-400">
                {timeAgo(o.placedAt)} · {o.itemCount || 0}{" "}
                {o.itemCount === 1 ? "item" : "items"}
              </span>
            </span>
            <Badge variant={financialVariant(o.financialStatus)}>
              {(o.financialStatus || "unknown").replace(/_/g, " ")}
            </Badge>
            <span className="w-24 text-right text-sm font-medium text-gray-900">
              {formatCurrency(o.totalPrice)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function RecentAuditLogs({ logs, error }) {
  if (error) return <PanelMessage>Couldn't load the audit log.</PanelMessage>;
  if (logs === null) return <PanelSkeleton />;
  if (logs.length === 0)
    return <PanelMessage>No audit entries yet.</PanelMessage>;

  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {logs.map((log) => (
        <Link
          key={log.id}
          to={`/audit-log?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.entityId || "")}`}
          className="block p-3.5 hover:bg-fairway-50/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionVariant(log.action)}>
              {humanizeAction(log.action)}
            </Badge>
            <ActorBadge actorType={log.actorType} />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {log.entityType} · {timeAgo(log.createdAt)}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const [stats, setStats] = useState({
    customers: null,
    products: null,
    suppliers: null,
  });
  const [orderStats, setOrderStats] = useState({
    total: null,
    unfulfilled: null,
  });
  const [recentOrders, setRecentOrders] = useState(null);
  const [ordersError, setOrdersError] = useState(false);
  const [recentLogs, setRecentLogs] = useState(null);
  const [logsError, setLogsError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchCustomers({ limit: 1 }),
      fetchProducts({ limit: 1 }),
      fetchSuppliers({ limit: 1 }),
    ])
      .then(([customers, products, suppliers]) => {
        setStats({
          customers: customers.data.total,
          products: products.data.total,
          suppliers: suppliers.data.total,
        });
      })
      .catch(() => {
        // Leave stats as null — StatCard shows its loading skeleton rather
        // than a broken zero.
      });
  }, []);

  // Orders and audit log load independently so one failing never blanks
  // the rest of the dashboard.
  useEffect(() => {
    Promise.all([
      fetchOrders({ limit: 5 }),
      fetchOrders({ limit: 1, fulfillmentStatus: "unfulfilled" }),
    ])
      .then(([recent, unfulfilled]) => {
        setRecentOrders(recent.data.items);
        setOrderStats({
          total: recent.data.total,
          unfulfilled: unfulfilled.data.total,
        });
      })
      .catch(() => setOrdersError(true));

    fetchAuditLogs({ limit: 6 })
      .then((res) => setRecentLogs(res.data.items))
      .catch(() => setLogsError(true));
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="What's happening across Golf Care right now."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Orders"
          value={orderStats.total}
          loading={orderStats.total === null && !ordersError}
          icon={<ReceiptIcon />}
          hint={
            orderStats.unfulfilled !== null
              ? `${orderStats.unfulfilled} unfulfilled`
              : undefined
          }
        />
        <StatCard
          label="Customers"
          value={stats.customers}
          loading={stats.customers === null}
          icon={<UsersIcon />}
        />
        <StatCard
          label="Products"
          value={stats.products}
          loading={stats.products === null}
          icon={<BagIcon />}
        />
        <StatCard
          label="Suppliers"
          value={stats.suppliers}
          loading={stats.suppliers === null}
          icon={<TruckIcon />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionHeader title="Recent orders" to="/orders" />
            <RecentOrders orders={recentOrders} error={ordersError} />
          </section>

          <section>
            <SectionHeader title="Recent activity" to="/activity" />
            <ActivityFeed limit={6} />
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionHeader title="Recent audit log" to="/audit-log" />
            <RecentAuditLogs logs={recentLogs} error={logsError} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-gray-700">
              Quick links
            </h2>
            <div className="space-y-2">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:border-fairway-200 hover:bg-fairway-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fairway-100 text-fairway-700">
                    <link.icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      {link.label}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {link.description}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
