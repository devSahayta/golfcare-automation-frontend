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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchPortalItems, confirmAllItems, confirmItem as confirmItemApi } from "../api/supplierPortal";

function ItemImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />;
  }
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

function ItemRow({ item, confirmedStatus, onConfirm, busy }) {
  const confirmed = confirmedStatus != null;

  return (
    <li className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
      <ItemImage src={item.imageUrl} />

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
      ) : busy ? (
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
          Saving…
        </span>
      ) : (
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => onConfirm(item, "IN_STOCK")}
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

export default function SupplierCheckin() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState([]);
  const [confirmed, setConfirmed] = useState({}); // supplierProductId -> status
  // A Set, not a single id — clicking a second item before the first
  // item's request resolves must not clear the first item's busy/disabled
  // state. (Confirmed as the actual cause of "no loading shown": a single
  // busyId got overwritten by the next click, silently re-enabling the
  // still-in-flight item's buttons.)
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchPortalItems(token)
      .then((res) => {
        setSupplierName(res.data.supplierName);
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

  async function handleConfirmOne(item, status) {
    if (busyIds.has(item.supplierProductId)) return; // already in flight — ignore a double-click
    setBusyIds((prev) => new Set(prev).add(item.supplierProductId));
    try {
      await confirmItemApi(token, { supplierProductId: item.supplierProductId, status });
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

  const pendingCount = items.length - Object.keys(confirmed).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-lg font-semibold text-gray-900">Golf Care — Stock check-in</h1>

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

            <button
              onClick={handleMarkAllInStock}
              disabled={markingAll || pendingCount === 0}
              className="mt-4 w-full rounded-xl bg-fairway-700 px-4 py-3 text-sm font-semibold text-white hover:bg-fairway-800 disabled:opacity-50"
            >
              {markingAll ? "Saving…" : "Mark all in stock"}
            </button>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <ul>
                {items.map((item) => (
                  <ItemRow
                    key={item.supplierProductId}
                    item={item}
                    confirmedStatus={confirmed[item.supplierProductId] ?? null}
                    onConfirm={handleConfirmOne}
                    busy={busyIds.has(item.supplierProductId)}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
