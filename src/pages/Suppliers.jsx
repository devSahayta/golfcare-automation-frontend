// src/pages/Suppliers.jsx
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchSuppliers,
  fetchSupplierById,
  fetchCatalogBrands,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  deleteSupplierPermanently,
  regeneratePortalToken,
} from "../api/suppliers";
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

const CADENCE_OPTIONS = ["DAILY", "WEEKLY", "ON_DEMAND"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // 0=Sun..6=Sat, matches supplierCheckDispatch.js

const EMPTY_FORM = {
  name: "",
  contactName: "",
  waPhone: "",
  email: "",
  checkCadence: "WEEKLY",
  checkDayOfWeek: 1,
  checkHour: 10,
  isActive: true,
  brands: [],
};

function detailToForm(detail) {
  return {
    name: detail.name || "",
    contactName: detail.contactName || "",
    waPhone: detail.waPhone || "",
    email: detail.email || "",
    checkCadence: detail.checkCadence || "WEEKLY",
    checkDayOfWeek: detail.checkDayOfWeek ?? 1,
    checkHour: detail.checkHour ?? 10,
    isActive: detail.isActive ?? true,
    brands: detail.brands || [],
  };
}

function summarizeOutcome({ backfillSummary, cleanupSummary }) {
  const parts = [];
  if (backfillSummary?.variantsLinked) {
    parts.push(`${backfillSummary.variantsLinked} product${backfillSummary.variantsLinked === 1 ? "" : "s"} linked`);
  }
  if (backfillSummary?.transferred) {
    parts.push(
      `${backfillSummary.transferred} transferred from previous supplier (price/lead-time needs reconfirmation)`,
    );
  }
  if (cleanupSummary?.deleted) {
    parts.push(`${cleanupSummary.deleted} unconfirmed link${cleanupSummary.deleted === 1 ? "" : "s"} removed`);
  }
  if (cleanupSummary?.keptForReview) {
    parts.push(`${cleanupSummary.keptForReview} kept for review`);
  }
  return parts.join(", ");
}

// Scrollable checkbox list of real catalog vendor values — pick-from-
// catalog, not free text, so there's no case mismatch against
// backfillSupplierProductsByBrand's exact-string Product.vendor match.
function BrandPicker({ catalogBrands, loading, selected, onToggle, selfSupplierId }) {
  const [filter, setFilter] = useState("");

  const visible = catalogBrands.filter((b) => b.brand.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter brands…"
        className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
        {loading ? (
          <p className="p-3 text-sm text-gray-400">Loading brands…</p>
        ) : visible.length === 0 ? (
          <p className="p-3 text-sm text-gray-400">No brands match.</p>
        ) : (
          visible.map(({ brand, owner }) => {
            const isSelf = owner && owner.ownerSupplierId === selfSupplierId;
            const takenByOther = owner && !isSelf;
            return (
              <label
                key={brand}
                className={`flex items-center justify-between gap-2 border-b border-gray-50 px-3 py-1.5 text-sm last:border-0 ${
                  takenByOther ? "text-gray-400" : "text-gray-800"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(brand)}
                    disabled={takenByOther}
                    onChange={() => onToggle(brand)}
                    className="rounded border-gray-300"
                  />
                  {brand}
                </span>
                {takenByOther && <span className="text-xs text-gray-400">Taken by {owner.ownerSupplierName}</span>}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function SupplierForm({ form, setForm, catalogBrands, catalogLoading, selfSupplierId }) {
  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleBrand(brand) {
    setForm((f) => ({
      ...f,
      brands: f.brands.includes(brand) ? f.brands.filter((b) => b !== brand) : [...f.brands, brand],
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Contact name</label>
        <input
          type="text"
          value={form.contactName}
          onChange={(e) => set("contactName", e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">WhatsApp phone *</label>
        <input
          type="text"
          value={form.waPhone}
          onChange={(e) => set("waPhone", e.target.value)}
          placeholder="91XXXXXXXXXX"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Check cadence *</label>
          <select
            value={form.checkCadence}
            onChange={(e) => set("checkCadence", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
          >
            {CADENCE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Check hour (0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={form.checkHour}
            onChange={(e) => set("checkHour", Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
          />
        </div>
      </div>

      {form.checkCadence === "WEEKLY" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Check day of week</label>
          <select
            value={form.checkDayOfWeek}
            onChange={(e) => set("checkDayOfWeek", Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
          >
            {WEEKDAY_LABELS.map((label, idx) => (
              <option key={label} value={idx}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="rounded border-gray-300"
        />
        Active
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Brands</label>
        <BrandPicker
          catalogBrands={catalogBrands}
          loading={catalogLoading}
          selected={form.brands}
          onToggle={toggleBrand}
          selfSupplierId={selfSupplierId}
        />
      </div>
    </div>
  );
}

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

  // null (viewing, no drawer open yet handled by selectedId) | "view" |
  // "edit" | "create" — the drawer reuses one body for all three, see render.
  const [drawerMode, setDrawerMode] = useState(null);
  const [detailTab, setDetailTab] = useState("products");
  const [form, setForm] = useState(EMPTY_FORM);
  const [catalogBrands, setCatalogBrands] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

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
  }, [search, isActive, offset, refreshTick]);

  function loadCatalogBrands() {
    setCatalogLoading(true);
    fetchCatalogBrands()
      .then((res) => setCatalogBrands(res.data.brands))
      .catch(() => toast.error("Couldn't load catalog brands"))
      .finally(() => setCatalogLoading(false));
  }

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
    setDrawerMode("view");
    setDetailTab("products");
    setDetailLoading(true);
    fetchSupplierById(row.id)
      .then((res) => setDetail(res.data.supplier))
      .finally(() => setDetailLoading(false));
  }

  function openCreate() {
    setSelectedId(null);
    setDetail(null);
    setForm(EMPTY_FORM);
    setDrawerMode("create");
    loadCatalogBrands();
  }

  function startEdit() {
    setForm(detailToForm(detail));
    setDrawerMode("edit");
    loadCatalogBrands();
  }

  function cancelEdit() {
    if (drawerMode === "create") {
      closeDrawer();
    } else {
      setDrawerMode("view");
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDrawerMode(null);
  }

  async function handleSave() {
    if (!form.name || !form.waPhone || !form.checkCadence) {
      toast.error("Name, WhatsApp phone, and check cadence are required");
      return;
    }
    setSaving(true);
    try {
      if (drawerMode === "create") {
        const res = await createSupplier(form);
        toast.success(
          ["Supplier created", summarizeOutcome(res.data)].filter(Boolean).join(" — "),
        );
        closeDrawer();
      } else {
        const res = await updateSupplier(selectedId, form);
        toast.success(["Supplier updated", summarizeOutcome(res.data)].filter(Boolean).join(" — "));
        setDetail(res.data.supplier);
        setDrawerMode("view");
      }
      setRefreshTick((t) => t + 1);
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === "brand_conflict") {
        const names = data.conflicts.map((c) => `${c.brand} (taken by ${c.ownerSupplierName})`).join(", ");
        toast.error(`Brand already assigned: ${names}`);
      } else {
        toast.error(data?.error || "Couldn't save supplier. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!detail) return;
    if (!window.confirm(`Deactivate ${detail.name}? Their brands will be cleared and can be reassigned to another supplier.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await deactivateSupplier(detail.id);
      const cleanup = res.data.cleanupSummary;
      toast.success(
        ["Supplier deactivated", cleanup?.deleted ? `${cleanup.deleted} unconfirmed link(s) removed` : null]
          .filter(Boolean)
          .join(" — "),
      );
      setRefreshTick((t) => t + 1);
      closeDrawer();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't deactivate supplier. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateLink() {
    if (!detail) return;
    if (!window.confirm("Regenerate this supplier's check-in link? The old link will stop working.")) return;

    setSaving(true);
    try {
      const res = await regeneratePortalToken(detail.id);
      setDetail((d) => ({ ...d, portalToken: res.data.supplier.portalToken }));
      toast.success("Check-in link regenerated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't regenerate the link. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function copyPortalLink(portalToken) {
    const url = `${window.location.origin}/supplier-checkin/${portalToken}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied."))
      .catch(() => toast.error("Couldn't copy — select and copy manually."));
  }

  async function handleDeletePermanent() {
    if (!detail) return;
    if (!window.confirm(`Permanently delete ${detail.name}? This cannot be undone.`)) return;

    setSaving(true);
    try {
      await deleteSupplierPermanently(detail.id);
      toast.success(`${detail.name} permanently deleted.`);
      setRefreshTick((t) => t + 1);
      closeDrawer();
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === "has_import_history") {
        toast.error(data.message);
      } else if (data?.error === "has_linked_products") {
        if (window.confirm(`${data.message}\n\nContinue anyway?`)) {
          try {
            await deleteSupplierPermanently(detail.id, { force: true });
            toast.success(`${detail.name} permanently deleted.`);
            setRefreshTick((t) => t + 1);
            closeDrawer();
          } catch (err2) {
            toast.error(err2.response?.data?.message || "Couldn't delete supplier. Try again.");
          }
        }
      } else {
        toast.error(data?.message || data?.error || "Couldn't delete supplier. Try again.");
      }
    } finally {
      setSaving(false);
    }
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
            <button
              onClick={openCreate}
              className="whitespace-nowrap rounded-lg bg-fairway-700 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800"
            >
              New supplier
            </button>
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
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={drawerMode === "create" ? "New supplier" : detail?.name || "Loading…"}
        subtitle={drawerMode === "create" ? undefined : detail?.contactName}
      >
        {drawerMode === "create" || drawerMode === "edit" ? (
          <div className="space-y-5">
            <SupplierForm
              form={form}
              setForm={setForm}
              catalogBrands={catalogBrands}
              catalogLoading={catalogLoading}
              selfSupplierId={drawerMode === "edit" ? selectedId : null}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-fairway-700 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : detailLoading || !detail ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button
                onClick={startEdit}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Edit
              </button>
              {detail.isActive && (
                <button
                  onClick={handleDeactivate}
                  disabled={saving}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Deactivate
                </button>
              )}
              <button
                onClick={handleDeletePermanent}
                disabled={saving}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                title="Permanently removes this supplier and, if confirmed, their linked products and check history. Cannot be undone."
              >
                Delete permanently
              </button>
            </div>

            {detail.portalToken && (
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Stock check-in link</p>
                <p className="mt-1 truncate text-sm text-gray-600" title={`${window.location.origin}/supplier-checkin/${detail.portalToken}`}>
                  {`${window.location.origin}/supplier-checkin/${detail.portalToken}`}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => copyPortalLink(detail.portalToken)}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={handleRegenerateLink}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}

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
              <div className="mb-3 flex gap-1 border-b border-gray-200">
                {[
                  { key: "products", label: "Products supplied", count: detail.SupplierProduct?.length ?? 0 },
                  { key: "checks", label: "Recent stock checks", count: detail.SupplierCheck?.length ?? 0 },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key)}
                    className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      detailTab === t.key
                        ? "border-fairway-600 text-fairway-800"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {detailTab === "products" ? (
                detail.SupplierProduct && detail.SupplierProduct.length > 0 ? (
                  <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
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
                )
              ) : detail.SupplierCheck && detail.SupplierCheck.length > 0 ? (
                <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
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
