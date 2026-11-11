// src/pages/SupplierCheckin.jsx
//
// Public, token-authed page a supplier opens from the link in their
// WhatsApp stock-check template — no login, no sidebar, mobile-first
// (this is opened on a phone). Lets a supplier see every pending item and
// mark stock status, instead of being asked to do it over chat, which
// doesn't scale to a real catalog (confirmed: a ~1,400-item check-in
// can't be listed in a WhatsApp message, so chat falls back to a blanket
// "all in stock" with no real per-item visibility). Drives the same
// backend confirmation logic the WhatsApp agent uses (see
// supplierCheckinService.js on the backend) — whichever way a supplier
// confirms, chat or this page, it's the same source of truth.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchPortalItems,
  confirmAllItems,
  confirmItem as confirmItemApi,
  uploadItemImage as uploadItemImageApi,
  fetchItemStock,
  createNewProduct,
} from "../api/supplierPortal";

// Real Shopify collection titles, copied from the store's collections list
// and filtered down to the ones that are genuine product categories — the
// brand/vendor collections (e.g. "TaylorMade", "Adidas" — each one a
// "Vendor is equal to X" collection, not a category) are deliberately left
// out, since brand already has its own dropdown sourced from the
// supplier's own allowed-brands list. "Home page" and the empty default
// Shopify example collection are left out too — neither is a real category.
const SHOPIFY_CATEGORIES = [
  "Apparels", "Arm Sleeves", "Back Pack", "Bags", "Bags Junior Bags", "Ball Bags",
  "Ball Pouches & Holders", "Balls", "Belt", "Belts", "Boston Bags", "Cart Bags",
  "Chippers", "Cleaning & Repair Tools", "Clubmaking", "Clubs", "Clubs Package Sets",
  "Daily Needs", "Drivers", "Duffle Bags", "Eyewear", "Fairway Woods",
  "Four Wheel Trolleys", "Gloves", "Golf Gifts", "Grips", "Hat Clips & Markers",
  "Headcovers", "Headwear", "High Visibility Balls", "Holiday Bags", "Hybrids",
  "Individual Club", "Individual Irons", "Irons", "Junior Individual Club",
  "Junior's", "Junior's Apparels", "Junior's Gloves", "Junior's Junior Bags",
  "Junior's Package Sets", "Junior's Shoes", "Manual Trolleys", "Mats",
  "Nearly New Balls", "On-Course Accessories", "Organiser Bags",
  "Performance Wearables", "Personalized Bags", "Practice Bags", "Practice Balls",
  "Practice Nets", "Putters", "Putting Practice", "Rain Covers", "Rain Wear",
  "Rangefinders", "Shoe Bags", "Shoes", "Shorts", "Sippers", "Socks", "Stand Bags",
  "Staff Bags", "Swing Correction", "T-Shirts", "Technology", "Tees",
  "Three Wheel Trolleys", "Towels", "Training", "Travel Bags", "Travel Cover Bags",
  "Trolley Accessories", "Trolleys", "Trousers", "Two Wheel Trolleys", "Umbrellas",
  "Utility Irons", "Vests", "Wedges", "Winter Wear", "Women's", "Women's Apparels",
  "Women's Clubs", "Women's Gloves", "Women's Shoes",
];

// uploadState: undefined (idle) | "uploading" | "pending" — only relevant
// when the product has no image at all; the upload gate itself is
// enforced server-side against Product.imageUrls regardless of what this
// shows, so this is purely a display concern.
function ItemImage({ src, uploadState, onUploadImage }) {
  const [failed, setFailed] = useState(false);

  if (src) {
    if (failed) return <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />;
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-lg border border-gray-100 object-cover"
      />
    );
  }

  if (uploadState === "uploading") {
    return <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-gray-200" />;
  }

  if (uploadState === "pending") {
    return (
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 p-0.5 text-center">
        <span className="text-[8px] font-medium leading-tight text-amber-700">Pending review</span>
      </div>
    );
  }

  return (
    <label className="flex h-12 w-12 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-fairway-300 hover:text-fairway-600">
      <span className="text-base leading-none">+</span>
      <span className="text-[8px] leading-tight">Add photo</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUploadImage(file);
        }}
      />
    </label>
  );
}

// A small inline number input + Confirm/Cancel, swapped in for the plain
// "In stock" button once tapped — lets the supplier see (once the lazy
// fetchItemStock call resolves) and correct the real Shopify stock number
// instead of silently accepting the system default. "Out of stock" has no
// equivalent — it always means 0, nothing to show or edit.
function StockEditor({ stockEdit, busy, onChangeQuantity, onConfirm, onCancel }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <input
        type="number"
        min="0"
        inputMode="numeric"
        placeholder={stockEdit.loading ? "…" : "Qty"}
        value={stockEdit.quantity}
        onChange={(e) => onChangeQuantity(e.target.value)}
        disabled={stockEdit.loading || busy}
        className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900 disabled:bg-gray-50"
      />
      <button
        onClick={onConfirm}
        disabled={busy}
        className="rounded-lg bg-fairway-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-fairway-800 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Confirm"}
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
      >
        ✕
      </button>
    </div>
  );
}

function ItemRow({
  item,
  confirmedStatus,
  onConfirm,
  busy,
  imageUploadState,
  onUploadImage,
  stockEdit,
  onStartStockEdit,
  onChangeStockQuantity,
  onConfirmStock,
  onCancelStockEdit,
}) {
  const confirmed = confirmedStatus != null;

  return (
    <li className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
      <ItemImage src={item.imageUrl} uploadState={imageUploadState} onUploadImage={onUploadImage} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{item.productTitle}</p>
        {item.variantTitle && <p className="truncate text-xs text-gray-400">{item.variantTitle}</p>}
        {item.sku && <p className="truncate text-xs text-gray-300">SKU: {item.sku}</p>}
      </div>

      {confirmed ? (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            confirmedStatus === "IN_STOCK" ? "bg-fairway-50 text-fairway-700" : "bg-red-50 text-red-600"
          }`}
        >
          {confirmedStatus === "IN_STOCK" ? "In stock" : "Out of stock"}
        </span>
      ) : stockEdit ? (
        <StockEditor
          stockEdit={stockEdit}
          busy={busy}
          onChangeQuantity={(v) => onChangeStockQuantity(item, v)}
          onConfirm={() => onConfirmStock(item)}
          onCancel={() => onCancelStockEdit(item)}
        />
      ) : busy ? (
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
          Saving…
        </span>
      ) : (
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => onStartStockEdit(item)}
            className="rounded-lg border border-fairway-200 bg-white px-2.5 py-1.5 text-xs font-medium text-fairway-700 hover:bg-fairway-50"
          >
            In stock
          </button>
          <button
            onClick={() => onConfirm(item, "OUT_OF_STOCK")}
            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Out of stock
          </button>
        </div>
      )}
    </li>
  );
}

// The portal's own equivalent of the WhatsApp chat's create_product_draft —
// same required fields (title, brand, MRP, margin %, GST %, a photo), same
// end state (a staff approval email). Margin %/GST % are the supplier's
// own commercial terms, not Golf Care's internal numbers, so asking for
// them directly here matches what the chat flow already asks for.
function AddProductForm({ brands, submitting, onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [marginPercent, setMarginPercent] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [quantity, setQuantity] = useState("");
  const [specs, setSpecs] = useState("");
  const [file, setFile] = useState(null);

  // Local-only object URL, never uploaded anywhere — just lets the
  // supplier see what they picked before submitting. Derived straight
  // from `file` (not its own state) so there's nothing to get out of
  // sync; the effect below only revokes the previous URL, it never sets
  // state itself.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title || !brand || !price || !marginPercent || !gstPercent || !file) {
      toast.error("Title, brand, MRP, margin %, GST %, and a photo are required.");
      return;
    }
    onSubmit({ title, brand, category, sku, price, marginPercent, gstPercent, quantity, specs }, file);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder="Product title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      >
        <option value="">Brand *</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Category</option>
          {SHOPIFY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min="0"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="MRP *"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          type="number"
          min="0"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Margin % *"
          value={marginPercent}
          onChange={(e) => setMarginPercent(e.target.value)}
        />
        <input
          type="number"
          min="0"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="GST % *"
          value={gstPercent}
          onChange={(e) => setGstPercent(e.target.value)}
        />
      </div>
      <input
        type="number"
        min="0"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder="Stock quantity (optional)"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        rows={2}
        placeholder="Description"
        value={specs}
        onChange={(e) => setSpecs(e.target.value)}
      />
      <label className="block text-xs text-gray-500">
        Photo *
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs"
        />
      </label>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected photo preview"
          className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
        />
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-fairway-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fairway-800 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Submit for review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// A small "what does this page do" explainer, since a supplier opening
// this cold (just a WhatsApp link, no onboarding) has no way to know what
// the two newer features — adding a product, and editing the stock
// number — actually do just by looking at the buttons. Kept as a toggled
// popover rather than always-visible text so it doesn't compete with the
// actual check-in list for attention on a small phone screen.
function InfoPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="What can I do on this page?"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:border-fairway-300 hover:text-fairway-700"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 w-72 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900">About this page</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <ul className="mt-2 list-disc space-y-2 pl-4">
            <li>
              Tap <span className="font-medium">In stock</span> to see the real current stock number for that
              item and change it if it's wrong, before confirming.
            </li>
            <li>
              Got something to sell that isn't in the list at all? Use{" "}
              <span className="font-medium">+ Add a new product</span> below — Golf Care staff reviews it before
              it goes live.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Plain overlay + centered card — no modal library in this codebase yet,
// and this page only ever needs the one. Closes on backdrop click; the
// card itself stops that click from bubbling so clicking inside the form
// doesn't dismiss it.
function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SupplierCheckin() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [brands, setBrands] = useState([]);
  const [items, setItems] = useState([]);
  const [confirmed, setConfirmed] = useState({}); // supplierProductId -> status
  // A Set, not a single id — clicking a second item before the first
  // item's request resolves must not clear the first item's busy/disabled
  // state. (Confirmed as the actual cause of "no loading shown": a single
  // busyId got overwritten by the next click, silently re-enabling the
  // still-in-flight item's buttons.)
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);
  // supplierProductId -> "uploading" | "pending" — a missing-image photo
  // submission in progress or already sent for staff review this session.
  const [imageUploads, setImageUploads] = useState({});
  // supplierProductId -> { quantity: string, loading: boolean } — the
  // inline stock editor that replaces the plain "In stock" button once
  // tapped. Absent entirely = not editing (shows the normal buttons).
  const [stockEdits, setStockEdits] = useState({});
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductSubmitting, setAddProductSubmitting] = useState(false);
  // Filters the visible list only — doesn't touch pendingCount or "Mark
  // all in stock", which still apply to every pending item regardless of
  // what's currently filtered into view.
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPortalItems(token)
      .then((res) => {
        setSupplierName(res.data.supplierName);
        setBrands(res.data.brands || []);
        setItems(res.data.items);
        const alreadyConfirmed = {};
        for (const item of res.data.items) {
          if (item.confirmedStatus) alreadyConfirmed[item.supplierProductId] = item.confirmedStatus;
        }
        setConfirmed(alreadyConfirmed);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleConfirmOne(item, status, quantity) {
    if (busyIds.has(item.supplierProductId)) return; // already in flight — ignore a double-click
    setBusyIds((prev) => new Set(prev).add(item.supplierProductId));
    try {
      await confirmItemApi(token, { supplierProductId: item.supplierProductId, status, quantity });
      setConfirmed((c) => ({ ...c, [item.supplierProductId]: status }));
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(item.supplierProductId);
        return next;
      });
    }
  }

  // Tapping "In stock" doesn't confirm immediately anymore — it opens this
  // inline editor, pre-filled (once the lazy fetchItemStock call resolves)
  // with the real current Shopify stock number instead of asking the
  // supplier to type one blind. "Out of stock" has no equivalent — it
  // always means 0, see handleConfirmOne's direct OUT_OF_STOCK call site.
  async function handleStartStockEdit(item) {
    setStockEdits((s) => ({ ...s, [item.supplierProductId]: { quantity: "", loading: true } }));
    try {
      const res = await fetchItemStock(token, item.supplierProductId);
      const available = res.data?.available;
      setStockEdits((s) => ({
        ...s,
        [item.supplierProductId]: { quantity: available != null ? String(available) : "", loading: false },
      }));
    } catch {
      setStockEdits((s) => ({ ...s, [item.supplierProductId]: { quantity: "", loading: false } }));
    }
  }

  function handleChangeStockQuantity(item, value) {
    setStockEdits((s) => ({ ...s, [item.supplierProductId]: { ...s[item.supplierProductId], quantity: value } }));
  }

  function handleCancelStockEdit(item) {
    setStockEdits((s) => {
      const next = { ...s };
      delete next[item.supplierProductId];
      return next;
    });
  }

  function handleConfirmStock(item) {
    const raw = stockEdits[item.supplierProductId]?.quantity;
    // Blank stays blank, not 0 — an empty field means "use the normal
    // default," not "set stock to zero while marking it in stock."
    const quantity = raw !== "" && raw != null ? Number(raw) : undefined;
    handleConfirmOne(item, "IN_STOCK", quantity);
  }

  async function handleMarkAllInStock() {
    const pending = items.filter((item) => confirmed[item.supplierProductId] == null);
    if (!window.confirm(`Mark all ${pending.length} item(s) as in stock?`)) return;
    setMarkingAll(true);
    try {
      const res = await confirmAllItems(token, { status: "IN_STOCK" });
      if (res.data.error) {
        toast.error("Nothing to confirm right now.");
      } else {
        // Backend only touches items not already individually confirmed
        // (see confirmAllPendingItems) — mirror that here so an item
        // already marked Out of stock doesn't flip back to In stock in
        // the UI either.
        setConfirmed((c) => {
          const next = { ...c };
          for (const item of pending) next[item.supplierProductId] = "IN_STOCK";
          return next;
        });
        toast.success(`Confirmed ${res.data.confirmedCount} item(s) as in stock.`);
      }
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleUploadImage(item, file) {
    setImageUploads((u) => ({ ...u, [item.supplierProductId]: "uploading" }));
    try {
      await uploadItemImageApi(token, item.supplierProductId, file);
      setImageUploads((u) => ({ ...u, [item.supplierProductId]: "pending" }));
      toast.success("Photo sent for review.");
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "submission_already_pending") {
        setImageUploads((u) => ({ ...u, [item.supplierProductId]: "pending" }));
        toast("A photo for this product is already pending review.");
        return;
      }
      setImageUploads((u) => {
        const next = { ...u };
        delete next[item.supplierProductId];
        return next;
      });
      if (code === "product_already_has_image") {
        toast.error("This product already has an image now.");
      } else if (err?.response?.status === 400) {
        toast.error(err.response.data?.error || "That file can't be used — try a JPEG, PNG, or WebP under 8MB.");
      } else {
        toast.error("Couldn't upload that photo — try again.");
      }
    }
  }

  async function handleCreateProduct(fields, file) {
    setAddProductSubmitting(true);
    try {
      const res = await createNewProduct(token, fields, file);
      if (res.data.productAlreadyExisted) {
        toast.success(`"${res.data.matchedProductTitle}" already exists — linked to you and stock updated instead.`);
      } else {
        toast.success("Sent for staff review.");
      }
      setShowAddProduct(false);
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "brand_not_allowed") {
        toast.error(err.response.data?.message || "This brand isn't set up on your account yet.");
      } else if (code === "draft_already_exists") {
        toast.error("A product with this title is already pending review.");
      } else if (err?.response?.status === 400) {
        toast.error(err.response.data?.error || "Check the required fields and try again.");
      } else {
        toast.error("Couldn't submit that — try again.");
      }
    } finally {
      setAddProductSubmitting(false);
    }
  }

  const pendingCount = items.length - Object.keys(confirmed).length;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter((item) =>
        [item.productTitle, item.variantTitle, item.sku].some((v) => v?.toLowerCase().includes(normalizedSearch)),
      )
    : items;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-gray-900">Golf Care — Stock check-in</h1>
          {!loading && !invalid && <InfoPopover />}
        </div>

        {!loading && !invalid && (
          <div className="mt-4">
            <button
              onClick={() => setShowAddProduct(true)}
              className="w-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-500 hover:border-fairway-300 hover:text-fairway-700"
            >
              + Add a new product
            </button>
          </div>
        )}

        {showAddProduct && (
          <Modal title="Add a new product" onClose={() => setShowAddProduct(false)}>
            <AddProductForm
              brands={brands}
              submitting={addProductSubmitting}
              onSubmit={handleCreateProduct}
              onCancel={() => setShowAddProduct(false)}
            />
          </Modal>
        )}

        {loading ? (
          <div className="mt-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : invalid ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm font-medium text-gray-900">This link isn't valid</p>
            <p className="mt-1 text-sm text-gray-500">
              It may have expired or been replaced with a new one. Please reach out to Golf Care for a fresh link.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm font-medium text-gray-900">Hi {supplierName},</p>
            <p className="mt-1 text-sm text-gray-500">Nothing pending right now — you're all caught up.</p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              Hi {supplierName}, you have{" "}
              <span className="font-medium text-gray-700">{pendingCount} item(s)</span> to confirm.
            </p>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name or SKU…"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400"
            />

            <button
              onClick={handleMarkAllInStock}
              disabled={markingAll || pendingCount === 0}
              className="mt-3 w-full rounded-xl bg-fairway-700 px-4 py-3 text-sm font-semibold text-white hover:bg-fairway-800 disabled:opacity-50"
            >
              {markingAll ? "Saving…" : "Mark all in stock"}
            </button>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {filteredItems.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No items match "{searchQuery}".</p>
              ) : (
                <ul>
                  {filteredItems.map((item) => (
                    <ItemRow
                      key={item.supplierProductId}
                      item={item}
                      confirmedStatus={confirmed[item.supplierProductId] ?? null}
                      onConfirm={handleConfirmOne}
                      busy={busyIds.has(item.supplierProductId)}
                      imageUploadState={imageUploads[item.supplierProductId]}
                      onUploadImage={(file) => handleUploadImage(item, file)}
                      stockEdit={stockEdits[item.supplierProductId]}
                      onStartStockEdit={handleStartStockEdit}
                      onChangeStockQuantity={handleChangeStockQuantity}
                      onConfirmStock={handleConfirmStock}
                      onCancelStockEdit={handleCancelStockEdit}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
