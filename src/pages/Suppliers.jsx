// src/pages/Suppliers.jsx
import { useEffect, useRef, useState } from "react";
import { fetchSuppliers, fetchSupplierById } from "../api/suppliers";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";

const LIMIT = 20;

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHECK_STATUS_VARIANT = {
  ANSWERED: "positive",
  SENT: "info",
  TIMED_OUT: "warning",
  ESCALATED: "danger",
};

const COLUMNS = [
  {
    key: "name",
    header: "Supplier",
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.name}</p>
        {row.contactName && (
          <p className="text-xs text-gray-400">{row.contactName}</p>
        )}
      </div>
    ),
  },
  { key: "waPhone", header: "Phone" },
  {
    key: "brands",
    header: "Brands",
    render: (row) =>
      row.brands?.length
        ? row.brands.slice(0, 2).join(", ") +
          (row.brands.length > 2 ? ` +${row.brands.length - 2}` : "")
        : "—",
  },
  { key: "checkCadence", header: "Check cadence" },
  {
    key: "reliabilityScore",
    header: "Reliability",
    render: (row) => (
      <span
        className={
          row.reliabilityScore >= 80
            ? "text-fairway-700"
            : row.reliabilityScore >= 50
              ? "text-gold-600"
              : "text-red-600"
        }
      >
        {row.reliabilityScore}
      </span>
    ),
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) =>
      row.isActive ? (
        <Badge variant="positive">Active</Badge>
      ) : (
        <Badge>Inactive</Badge>
      ),
  },
  {
    key: "products",
    header: "Products",
    render: (row) => (
      <span className="text-gray-500">{row._count?.SupplierProduct ?? 0}</span>
    ),
  },
];

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    fetchSuppliers({
      search: search || undefined,
      isActive: isActive || undefined,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [search, isActive, offset]);

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

  function openSupplier(row) {
    setSelectedId(row.id);
    setDetailLoading(true);
    fetchSupplierById(row.id)
      .then((res) => setDetail(res.data.supplier))
      .finally(() => setDetailLoading(false));
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Reliability, product coverage, and stock-check history."
        actions={
          <div className="flex gap-2">
            <select
              value={isActive}
              onChange={(e) => {
                setLoading(true);
                setOffset(0);
                setIsActive(e.target.value);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
            >
              <option value="">All suppliers</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <input
              type="text"
              placeholder="Search name or phone…"
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400 sm:w-64"
            />
          </div>
        }
      />

      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        onRowClick={openSupplier}
        emptyTitle="No suppliers found"
        emptyDescription={
          search
            ? "Try a different name or phone number."
            : "Suppliers appear here once onboarded."
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
        title={detail?.name || "Loading…"}
        subtitle={detail?.contactName}
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
                <p className="text-xs text-gray-400">Reliability score</p>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.reliabilityScore}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Avg. response</p>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.avgResponseMins
                    ? `${detail.avgResponseMins} min`
                    : "—"}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Products supplied
              </h3>
              {detail.SupplierProduct && detail.SupplierProduct.length > 0 ? (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {detail.SupplierProduct.map((sp) => (
                    <li
                      key={sp.id}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="text-gray-900">{sp.Product?.title}</p>
                        {sp.Variant && (
                          <p className="text-xs text-gray-400">
                            {sp.Variant.title}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-600">
                        {formatCurrency(sp.costPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No products linked yet.</p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Recent stock checks
              </h3>
              {detail.SupplierCheck && detail.SupplierCheck.length > 0 ? (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {detail.SupplierCheck.map((check) => (
                    <li
                      key={check.id}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="text-gray-900">{check.type}</p>
                        <p className="text-xs text-gray-400">
                          {formatDateTime(check.sentAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          CHECK_STATUS_VARIANT[check.status] || "neutral"
                        }
                      >
                        {check.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No stock checks yet.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
