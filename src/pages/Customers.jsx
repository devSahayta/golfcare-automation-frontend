// src/pages/Customers.jsx
import { useEffect, useRef, useState } from "react";
import { fetchCustomers, fetchCustomerById } from "../api/customers";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";

const LIMIT = 20;

const TIER_VARIANT = {
  PLATINUM: "warning",
  GOLD: "warning",
  SILVER: "info",
  STANDARD: "neutral",
};

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const COLUMNS = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <span className="font-medium text-gray-900">
        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
      </span>
    ),
  },
  { key: "waPhone", header: "Phone" },
  {
    key: "tier",
    header: "Tier",
    render: (row) => (
      <Badge variant={TIER_VARIANT[row.tier] || "neutral"}>{row.tier}</Badge>
    ),
  },
  {
    key: "isMember",
    header: "Member",
    render: (row) =>
      row.isMember ? (
        <Badge variant="positive">Member</Badge>
      ) : (
        <Badge>Guest</Badge>
      ),
  },
  {
    key: "lifetimeValue",
    header: "LTV",
    render: (row) => formatCurrency(row.lifetimeValue),
  },
  {
    key: "lastOrderAt",
    header: "Last order",
    render: (row) => formatDate(row.lastOrderAt),
  },
];

export default function Customers() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    fetchCustomers({ search: search || undefined, limit: LIMIT, offset })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [search, offset]);

  function handleSearchChange(value) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setOffset(0);
      setSearch(value);
    }, 350);
  }

  function handlePageChange(newOffset) {
    setLoading(true);
    setOffset(newOffset);
  }

  function openCustomer(row) {
    setSelectedId(row.id);
    setDetailLoading(true);
    fetchCustomerById(row.id)
      .then((res) => setDetail(res.data.customer))
      .finally(() => setDetailLoading(false));
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Search customer profiles, membership, and order history."
        actions={
          <input
            type="text"
            placeholder="Search name, email, or phone…"
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400 sm:w-72"
          />
        }
      />

      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        onRowClick={openCustomer}
        emptyTitle="No customers found"
        emptyDescription={
          search
            ? "Try a different name, email, or phone number."
            : "Customers will appear here once they message in."
        }
      />

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
            ? [detail.firstName, detail.lastName].filter(Boolean).join(" ") ||
              detail.waPhone
            : "Loading…"
        }
        subtitle={detail?.waPhone}
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Tier</p>
                <Badge
                  variant={TIER_VARIANT[detail.tier] || "neutral"}
                  className="mt-1"
                >
                  {detail.tier}
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Membership</p>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.isMember
                    ? `Member${detail.memberCode ? ` · ${detail.memberCode}` : ""}`
                    : "Guest"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Lifetime value</p>
                <p className="mt-1 text-sm text-gray-800">
                  {formatCurrency(detail.lifetimeValue)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Orders</p>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.orderCount ?? 0}
                </p>
              </div>
            </div>

            {detail.GolferProfile && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  Golfer profile
                </h3>
                <div className="space-y-1.5 rounded-lg border border-gray-100 p-3 text-sm">
                  {detail.GolferProfile.handicap != null && (
                    <p className="flex justify-between text-gray-600">
                      <span>Handicap</span>
                      <span className="text-gray-900">
                        {detail.GolferProfile.handicap}
                      </span>
                    </p>
                  )}
                  {detail.GolferProfile.skillLevel && (
                    <p className="flex justify-between text-gray-600">
                      <span>Skill level</span>
                      <span className="text-gray-900">
                        {detail.GolferProfile.skillLevel}
                      </span>
                    </p>
                  )}
                  {detail.GolferProfile.homeClub && (
                    <p className="flex justify-between text-gray-600">
                      <span>Home club</span>
                      <span className="text-gray-900">
                        {detail.GolferProfile.homeClub}
                      </span>
                    </p>
                  )}
                  {detail.GolferProfile.budgetTier && (
                    <p className="flex justify-between text-gray-600">
                      <span>Budget tier</span>
                      <span className="text-gray-900">
                        {detail.GolferProfile.budgetTier}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Recent orders
              </h3>
              {detail.Order && detail.Order.length > 0 ? (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {detail.Order.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="text-gray-900">#{order.orderNumber}</p>
                        <p className="text-xs text-gray-400">
                          {formatDate(order.placedAt)}
                        </p>
                      </div>
                      <p className="font-medium text-gray-800">
                        {formatCurrency(order.totalPrice)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No orders yet.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
