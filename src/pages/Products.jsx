// src/pages/Products.jsx
import { useEffect, useRef, useState } from "react";
import { fetchProducts, fetchProductById } from "../api/products";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";
import Drawer from "../components/ui/Drawer";

const LIMIT = 20;

const AVAIL_VARIANT = {
  IN_STOCK: "positive",
  ON_ORDER: "warning",
  OUT_OF_STOCK: "danger",
  DISCONTINUED: "neutral",
  UNKNOWN: "neutral",
};

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

const COLUMNS = [
  {
    key: "title",
    header: "Product",
    render: (row) => (
      <div className="flex items-center gap-3">
        {row.imageUrls?.[0] ? (
          <img
            src={row.imageUrls[0]}
            alt=""
            className="h-8 w-8 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-md bg-gray-100" />
        )}
        <span className="font-medium text-gray-900">{row.title}</span>
      </div>
    ),
  },
  { key: "vendor", header: "Vendor" },
  { key: "productType", header: "Type" },
  {
    key: "price",
    header: "Price",
    render: (row) =>
      row.priceMin === row.priceMax
        ? formatCurrency(row.priceMin)
        : `${formatCurrency(row.priceMin)} – ${formatCurrency(row.priceMax)}`,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge>{row.status}</Badge>,
  },
  {
    key: "variants",
    header: "Variants",
    render: (row) => (
      <span className="text-gray-500">{row._count?.Variant ?? 0}</span>
    ),
  },
];

export default function Products() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    fetchProducts({
      search: search || undefined,
      status: status || undefined,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [search, status, offset]);

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

  function openProduct(row) {
    setSelectedId(row.id);
    setDetailLoading(true);
    fetchProductById(row.id)
      .then((res) => setDetail(res.data.product))
      .finally(() => setDetailLoading(false));
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Catalog, pricing, and per-variant availability."
        actions={
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => {
                setLoading(true);
                setOffset(0);
                setStatus(e.target.value);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="text"
              placeholder="Search title, vendor, type…"
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
        onRowClick={openProduct}
        emptyTitle="No products found"
        emptyDescription={
          search || status
            ? "Try a different search or status."
            : "Products sync in from Shopify."
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
        title={detail?.title || "Loading…"}
        subtitle={detail?.vendor}
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
                <p className="text-xs text-gray-400">Status</p>
                <Badge className="mt-1">{detail.status}</Badge>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Price range</p>
                <p className="mt-1 text-sm text-gray-800">
                  {formatCurrency(detail.priceMin)} –{" "}
                  {formatCurrency(detail.priceMax)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Variants & availability
              </h3>
              {detail.Variant && detail.Variant.length > 0 ? (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {detail.Variant.map((variant) => (
                    <li
                      key={variant.id}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="text-gray-900">{variant.title}</p>
                        {variant.sku && (
                          <p className="text-xs text-gray-400">
                            SKU {variant.sku}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {formatCurrency(variant.price)}
                        </span>
                        <Badge
                          variant={
                            AVAIL_VARIANT[variant.AvailabilityState?.status] ||
                            "neutral"
                          }
                        >
                          {variant.AvailabilityState?.status || "UNKNOWN"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">
                  No variants on this product.
                </p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
