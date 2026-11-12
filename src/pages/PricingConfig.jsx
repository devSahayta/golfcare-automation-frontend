// src/pages/PricingConfig.jsx
//
// Phase 5 — owner-facing pricing config console. A grouped form (member
// pricing / margin / levers / ladder / agent limits / rounding), matching
// the real ~20 flat PricingConfig keys 1:1 (see pricingConfigLoader.js's
// DEFAULTS), plus an inline "Preview impact" panel — Option A (confirmed):
// one real product, before/after effect of whatever's currently unsaved
// in the form, computed with a fixed synthetic customer so the number is
// reproducible no matter which real customer is in view.
//
// Only changed keys are ever sent to the backend (PUT /api/pricing-config
// only wants the diff), and the preview call sends that same diff against
// the live DB config — so "Preview impact" always answers "what would
// happen if I saved right now," not some separately-tracked draft.
//
// Addition: a small "Default" badge per field, using the isDefault flag
// the backend already returns per key (listPricingConfig's comment said
// this was meant for the frontend from the start — just wasn't wired up
// until now). Lets staff see at a glance which settings have ever been
// touched, which is exactly the thing that was hard to tell apart during
// testing when margin.minBelow/lever.richMargin got loosened and needed
// tracking down again to revert.
//
// Addition 2: an (i) info icon per field, tap/hover to reveal a short
// plain-language explanation of what the setting actually does and how
// it affects the price a customer sees. Added after a round of live
// testing turned up real confusion about what several fields do (margin
// floor vs ceiling vs base discount all interacting, in particular) —
// this console has ~25 fields now and most of them don't explain
// themselves. Each FieldRow takes an optional `info` string; nothing
// else about the field's behavior changes.

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchPricingConfig,
  updatePricingConfig,
  previewPricingConfig,
} from "../api/pricingConfig";
import { fetchProducts, fetchProductById } from "../api/products";
import useDocumentTitle from "../hooks/useDocumentTitle";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import { formatCurrency, formatDateTime } from "../lib/format";

// ---------------------------------------------------------------------
// Small field primitives — plain, labeled inputs, no generic JSON editor.
// ---------------------------------------------------------------------

// Tap-or-hover info bubble. Each instance manages its own open state and
// closes on outside click, so it works the same on desktop (hover) and
// mobile (tap) without any shared/global state. Deliberately plain-text
// only — if a hint ever needs a link or formatting, upgrade this then.
function InfoIcon({ text }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!text) return null;

  return (
    <span ref={wrapperRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More info about this setting"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-medium leading-none text-gray-400 hover:border-fairway-400 hover:text-fairway-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-fairway-400"
      >
        i
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-20 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 text-xs leading-relaxed text-gray-600 shadow-lg">
          {text}
        </div>
      )}
    </span>
  );
}

function FieldRow({ label, hint, info, isDefault, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-gray-700">{label}</p>
          <InfoIcon text={info} />
          {isDefault && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              Default
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
  prefix,
  suffix,
  width = "w-28",
}) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className={`${width} rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400`}
      />
      {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
    </div>
  );
}

function BooleanToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 appearance-none items-center rounded-full border-0 p-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fairway-400 focus-visible:ring-offset-2 ${value ? "bg-fairway-600" : "bg-gray-200"}`}
    >
      <span
        className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldGroup({ title, description, children, dirty }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {dirty && <Badge variant="warning">Unsaved</Badge>}
      </div>
      {description && (
        <p className="mb-2 text-xs text-gray-400">{description}</p>
      )}
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------

const TIER_LABELS = {
  STANDARD: "Standard",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export default function PricingConfig() {
  useDocumentTitle("Pricing Config");

  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPricingConfig()
      .then((res) => {
        setRows(res.data.data);
        const d = {};
        res.data.data.forEach((r) => {
          d[r.key] = r.value;
        });
        setDraft(d);
      })
      .catch(() => toast.error("Couldn't load pricing config"))
      .finally(() => setLoading(false));
  }, []);

  const savedByKey = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      m[r.key] = r;
    });
    return m;
  }, [rows]);

  // A key is "Default" if we have no row for it yet, or the row itself
  // says isDefault — i.e. nobody has ever saved an override for it.
  // Deliberately keyed off the loaded `rows`/`savedByKey`, not `draft` —
  // an unsaved edit shouldn't make the badge disappear early; it should
  // disappear only once the save actually lands (rows gets updated in
  // handleSave below).
  function isDefaultKey(key) {
    return !savedByKey[key] || savedByKey[key].isDefault;
  }

  const dirtyKeys = useMemo(
    () =>
      rows
        .filter((r) => JSON.stringify(r.value) !== JSON.stringify(draft[r.key]))
        .map((r) => r.key),
    [rows, draft],
  );
  const dirtySet = useMemo(() => new Set(dirtyKeys), [dirtyKeys]);

  function setKey(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setObjectField(key, field, value) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
  }
  function setArrayIndex(key, index, value) {
    setDraft((d) => {
      const arr = [...(d[key] || [])];
      arr[index] = value;
      return { ...d, [key]: arr };
    });
  }

  async function handleSave() {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    const changes = dirtyKeys.map((key) => ({ key, value: draft[key] }));
    try {
      await updatePricingConfig(changes);
      setRows((prev) =>
        prev.map((r) =>
          dirtySet.has(r.key)
            ? { ...r, value: draft[r.key], isDefault: false }
            : r,
        ),
      );
      toast.success(
        `Saved ${changes.length} setting${changes.length > 1 ? "s" : ""} — live within a minute.`,
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    const d = {};
    rows.forEach((r) => {
      d[r.key] = r.value;
    });
    setDraft(d);
  }

  // --- Preview impact (Option A) ----------------------------------------
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewOptions, setPreviewOptions] = useState([]);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewVariantId, setPreviewVariantId] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewDebounceRef = useRef(null);

  function handlePreviewSearchChange(value) {
    setPreviewSearch(value);
    setPreviewProduct(null);
    setPreviewVariantId("");
    setPreviewResult(null);
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    if (!value.trim()) {
      setPreviewOptions([]);
      return;
    }
    previewDebounceRef.current = setTimeout(() => {
      fetchProducts({ search: value, limit: 8 }).then((res) =>
        setPreviewOptions(res.data.items || []),
      );
    }, 300);
  }

  function selectPreviewProduct(product) {
    setPreviewOptions([]);
    setPreviewSearch(product.title);
    fetchProductById(product.id).then((res) => {
      setPreviewProduct(res.data.product);
      setPreviewVariantId(res.data.product.Variant?.[0]?.id || "");
      setPreviewResult(null);
    });
  }

  async function runPreview() {
    if (!previewVariantId) {
      toast.error("Pick a product and variant first");
      return;
    }
    if (dirtyKeys.length === 0) {
      toast.error(
        "Change a setting below first — preview compares live config vs your unsaved change",
      );
      return;
    }
    setPreviewLoading(true);
    try {
      const changes = dirtyKeys.map((key) => ({ key, value: draft[key] }));
      const res = await previewPricingConfig(previewVariantId, changes);
      setPreviewResult(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Pricing Config"
          subtitle="Member discount, margin floor, and negotiation levers."
        />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  const d = draft;

  return (
    <div>
      <PageHeader
        title="Pricing Config"
        subtitle="Member discount, margin floor, and negotiation levers — changes go live within a minute, no deploy."
        actions={
          dirtyKeys.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {dirtyKeys.length} unsaved
              </span>
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-fairway-900 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <FieldGroup
            title="Member pricing"
            dirty={
              dirtySet.has("member.basePct") || dirtySet.has("member.floorMode")
            }
          >
            <FieldRow
              label="Base member discount"
              hint="Flat % every member gets off list price"
              info="The flat % every member sees off list price, before any other rule applies. If this would push the price below the margin floor, what happens next depends on the 'If base discount is below floor' setting right below."
              isDefault={isDefaultKey("member.basePct")}
            >
              <NumberInput
                value={d["member.basePct"]}
                onChange={(v) => setKey("member.basePct", v)}
                suffix="%"
              />
            </FieldRow>
            <FieldRow
              label="If base discount is below floor"
              hint="Which one wins when the flat discount would cross the margin floor"
              info="The tie-breaker when the flat discount above would sell below the margin floor. 'Floor wins' (recommended) protects margin by using the floor price instead — this is why the member price sometimes doesn't match a simple % off calculation. 'Member price wins' allows selling below the floor on purpose — only use this if you're deliberately overriding margin protection."
              isDefault={isDefaultKey("member.floorMode")}
            >
              <SelectInput
                value={d["member.floorMode"]}
                onChange={(v) => setKey("member.floorMode", v)}
                options={[
                  {
                    value: "margin_wins",
                    label: "Floor wins (never go below margin)",
                  },
                  {
                    value: "member_wins",
                    label: "Member price wins (flat %, even below floor)",
                  },
                ]}
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            title="Minimum margin"
            dirty={[
              "margin.bandThreshold",
              "margin.minBelow",
              "margin.minAbove",
              "margin.smoothing.enabled",
              "margin.smoothing.minProfit",
            ].some((k) => dirtySet.has(k))}
          >
            <FieldRow
              label="Price band threshold"
              hint="List price above this uses the 'above' margin rule instead of 'below'"
              info="The cutoff list price deciding which minimum-margin % applies. Items listed below this threshold use 'Min margin below threshold'; items at or above it use 'Min margin above threshold' instead — expensive items can often afford a lower % margin while still making good ₹ profit per sale."
              isDefault={isDefaultKey("margin.bandThreshold")}
            >
              <NumberInput
                value={d["margin.bandThreshold"]}
                onChange={(v) => setKey("margin.bandThreshold", v)}
                step={100}
                prefix="₹"
              />
            </FieldRow>
            <FieldRow
              label="Min margin below threshold"
              hint="Fraction, e.g. 0.25 = 25%"
              info="The lowest % margin — of the selling price, not of cost — allowed for products listed below the price band threshold. The floor price is cost ÷ (1 − this fraction). Nothing can ever be sold or negotiated below this floor, no matter what discount or lever stacking would otherwise produce."
              isDefault={isDefaultKey("margin.minBelow")}
            >
              <NumberInput
                value={d["margin.minBelow"]}
                onChange={(v) => setKey("margin.minBelow", v)}
                step={0.01}
              />
            </FieldRow>
            <FieldRow
              label="Min margin above threshold"
              hint="Fraction, e.g. 0.15 = 15%"
              info="Same floor protection as above, but for products listed at or above the price band threshold — usually set lower than the 'below' margin, since expensive items still deliver solid ₹ profit even at a smaller margin %."
              isDefault={isDefaultKey("margin.minAbove")}
            >
              <NumberInput
                value={d["margin.minAbove"]}
                onChange={(v) => setKey("margin.minAbove", v)}
                step={0.01}
              />
            </FieldRow>
            <FieldRow
              label="Smoothing enabled"
              hint="Guarantee a flat minimum ₹ profit above the threshold, on top of the % floor"
              info="For items above the price band threshold, adds a second check on top of the % floor: even if the margin % is technically met, also require at least the flat ₹ profit set below. Protects against a correct-looking % margin that's still a tiny ₹ amount on a big-ticket item."
              isDefault={isDefaultKey("margin.smoothing.enabled")}
            >
              <BooleanToggle
                value={!!d["margin.smoothing.enabled"]}
                onChange={(v) => setKey("margin.smoothing.enabled", v)}
              />
            </FieldRow>
            <FieldRow
              label="Smoothing min profit"
              info="The minimum ₹ profit required above the threshold when Smoothing is enabled. When it applies, the floor becomes whichever is higher: the % floor, or cost + this amount."
              isDefault={isDefaultKey("margin.smoothing.minProfit")}
            >
              <NumberInput
                value={d["margin.smoothing.minProfit"]}
                onChange={(v) => setKey("margin.smoothing.minProfit", v)}
                step={100}
                prefix="₹"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            title="Ceiling"
            dirty={dirtySet.has("ceiling.maxTotalPct")}
          >
            <FieldRow
              label="Max total discount"
              hint="Base % + all stacked levers can never exceed this"
              info="A hard cap on the total discount % — base discount plus every stacked lever combined can never exceed this, even if the margin floor would otherwise allow a deeper cut. Keep this comfortably above your base discount, or levers below become pointless (they'll never actually apply)."
              isDefault={isDefaultKey("ceiling.maxTotalPct")}
            >
              <NumberInput
                value={d["ceiling.maxTotalPct"]}
                onChange={(v) => setKey("ceiling.maxTotalPct", v)}
                suffix="%"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            title="Negotiation levers"
            description="Each lever adds extra % room on top of the base discount, when its condition fires. Never stacks below the margin floor."
            dirty={[
              "lever.richMargin",
              "lever.oldModel.pct",
              "lever.offSeason",
              "lever.tier",
              "lever.ltv",
              "lever.bundle",
            ].some((k) => dirtySet.has(k))}
          >
            <FieldRow
              label="Rich margin — min list margin"
              hint="List-price margin needed to qualify"
              info="The raw margin (list price vs cost, before any discount) a product needs to qualify for this lever. Products with unusually fat margins can afford extra negotiating room without breaching the floor."
              isDefault={isDefaultKey("lever.richMargin")}
            >
              <NumberInput
                value={d["lever.richMargin"]?.minListMargin}
                onChange={(v) =>
                  setObjectField("lever.richMargin", "minListMargin", v)
                }
                step={0.01}
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Rich margin — extra room"
              info="Extra % discount room granted on top of the base discount when the rich-margin condition above is met."
              isDefault={isDefaultKey("lever.richMargin")}
            >
              <NumberInput
                value={d["lever.richMargin"]?.pct}
                onChange={(v) => setObjectField("lever.richMargin", "pct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Old model — extra room"
              hint="Fires when a newer model of the same product line exists"
              info="Extra % discount room granted automatically when a newer model of the same product line exists in the catalog — helps move out outgoing stock before it's superseded."
              isDefault={isDefaultKey("lever.oldModel.pct")}
            >
              <NumberInput
                value={d["lever.oldModel.pct"]}
                onChange={(v) => setKey("lever.oldModel.pct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Off-season — months [start, end]"
              hint="Calendar months this applies in, 1–12"
              info="The calendar months (1–12) during which the off-season lever is active — e.g. 4–9 means it applies from April through September."
              isDefault={isDefaultKey("lever.offSeason")}
            >
              <div className="flex items-center gap-1.5">
                <NumberInput
                  value={d["lever.offSeason"]?.months?.[0]}
                  onChange={(v) =>
                    setObjectField("lever.offSeason", "months", [
                      v,
                      d["lever.offSeason"]?.months?.[1],
                    ])
                  }
                  width="w-14"
                />
                <span className="text-gray-400">–</span>
                <NumberInput
                  value={d["lever.offSeason"]?.months?.[1]}
                  onChange={(v) =>
                    setObjectField("lever.offSeason", "months", [
                      d["lever.offSeason"]?.months?.[0],
                      v,
                    ])
                  }
                  width="w-14"
                />
              </div>
            </FieldRow>
            <FieldRow
              label="Off-season — extra room"
              info="Extra % discount room granted during the off-season months set above."
              isDefault={isDefaultKey("lever.offSeason")}
            >
              <NumberInput
                value={d["lever.offSeason"]?.pct}
                onChange={(v) => setObjectField("lever.offSeason", "pct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
            {Object.keys(TIER_LABELS).map((tierKey) => (
              <FieldRow
                key={tierKey}
                label={`Tier — ${TIER_LABELS[tierKey]}`}
                hint={
                  tierKey === "STANDARD"
                    ? "Flat lookup by customer tier"
                    : undefined
                }
                info="Extra % discount room granted automatically based on the customer's membership tier, stacking on top of the base discount. Each tier has its own value — higher tiers typically get more."
                isDefault={isDefaultKey("lever.tier")}
              >
                <NumberInput
                  value={d["lever.tier"]?.[tierKey]}
                  onChange={(v) => setObjectField("lever.tier", tierKey, v)}
                  suffix="%"
                  width="w-20"
                />
              </FieldRow>
            ))}
            <FieldRow
              label="Top LTV — percentile"
              hint="Customer's lifetime-value percentile cutoff (lower = more exclusive)"
              info="The customer's lifetime-value percentile cutoff to qualify for this lever — e.g. 10 means only the top 10% of customers by spend qualify. Lower numbers make this more exclusive."
              isDefault={isDefaultKey("lever.ltv")}
            >
              <NumberInput
                value={d["lever.ltv"]?.topPercentile}
                onChange={(v) =>
                  setObjectField("lever.ltv", "topPercentile", v)
                }
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Top LTV — extra room"
              info="Extra % discount room granted to customers in the top LTV percentile set above."
              isDefault={isDefaultKey("lever.ltv")}
            >
              <NumberInput
                value={d["lever.ltv"]?.pct}
                onChange={(v) => setObjectField("lever.ltv", "pct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Bundle — min items"
              info="Minimum number of distinct items in the cart needed to qualify for the bundle lever."
              isDefault={isDefaultKey("lever.bundle")}
            >
              <NumberInput
                value={d["lever.bundle"]?.minItems}
                onChange={(v) => setObjectField("lever.bundle", "minItems", v)}
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Bundle — min order value"
              info="Minimum total cart value (₹) needed to qualify for the bundle lever, alongside the min items rule above."
              isDefault={isDefaultKey("lever.bundle")}
            >
              <NumberInput
                value={d["lever.bundle"]?.minOrderValue}
                onChange={(v) =>
                  setObjectField("lever.bundle", "minOrderValue", v)
                }
                step={100}
                prefix="₹"
              />
            </FieldRow>
            <FieldRow
              label="Bundle — extra room"
              info="Extra % discount room granted when the bundle conditions above (min items and/or min order value) are met."
              isDefault={isDefaultKey("lever.bundle")}
            >
              <NumberInput
                value={d["lever.bundle"]?.pct}
                onChange={(v) => setObjectField("lever.bundle", "pct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            title="Negotiation ladder"
            description="Suggested concession steps, as a share of the room between member price and the lowest allowed price."
            dirty={
              dirtySet.has("ladder.steps") || dirtySet.has("ladder.thinRoom")
            }
          >
            <FieldRow
              label="Step 1 / 2 / 3 (0–1)"
              info="How a negotiation concedes over multiple pushbacks, as fractions (0–1) of the total room between the member price and the lowest allowed price (the floor). E.g. 0.4 means the first concession gives 40% of the available room; 1.0 means that step reaches the floor exactly — there's nothing left to give after that."
              isDefault={isDefaultKey("ladder.steps")}
            >
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <NumberInput
                    key={i}
                    value={d["ladder.steps"]?.[i]}
                    onChange={(v) => setArrayIndex("ladder.steps", i, v)}
                    step={0.05}
                    width="w-16"
                  />
                ))}
              </div>
            </FieldRow>
            <FieldRow
              label="Thin room — min rupees"
              hint="Below this AND the % below, skip the ladder entirely (nothing worth negotiating)"
              info="If the total negotiating room (member price minus floor) is below both this ₹ amount and the % below, the ladder is skipped entirely — the agent holds the member price firmly instead of offering fake-looking concessions on a product that barely has any room to begin with."
              isDefault={isDefaultKey("ladder.thinRoom")}
            >
              <NumberInput
                value={d["ladder.thinRoom"]?.minRupees}
                onChange={(v) =>
                  setObjectField("ladder.thinRoom", "minRupees", v)
                }
                step={50}
                prefix="₹"
              />
            </FieldRow>
            <FieldRow
              label="Thin room — min %"
              info="The % counterpart to the ₹ amount above — both conditions need to be cleared for the ladder to actually offer negotiation steps."
              isDefault={isDefaultKey("ladder.thinRoom")}
            >
              <NumberInput
                value={d["ladder.thinRoom"]?.minPct}
                onChange={(v) => setObjectField("ladder.thinRoom", "minPct", v)}
                suffix="%"
                width="w-20"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            title="Agent limits & rounding"
            dirty={[
              "agent.maxOrderForLevers",
              "offer.validityHours",
              "rounding",
              "discounting.enabled",
            ].some((k) => dirtySet.has(k))}
          >
            <FieldRow
              label="Max order value for full levers"
              hint="Above this, the agent only offers the first step and must escalate for more"
              info="Above this cart value, the agent only offers the very first concession step and must hand off to a human for anything deeper — a safety check so the agent doesn't give away large discounts on big orders unsupervised."
              isDefault={isDefaultKey("agent.maxOrderForLevers")}
            >
              <NumberInput
                value={d["agent.maxOrderForLevers"]}
                onChange={(v) => setKey("agent.maxOrderForLevers", v)}
                step={1000}
                prefix="₹"
              />
            </FieldRow>
            <FieldRow
              label="Offer validity"
              hint="How long a quoted price stays honorable"
              info="How many hours a quoted negotiated price stays valid before the customer would need a fresh quote if they come back later."
              isDefault={isDefaultKey("offer.validityHours")}
            >
              <NumberInput
                value={d["offer.validityHours"]}
                onChange={(v) => setKey("offer.validityHours", v)}
                suffix="hours"
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Rounding — below ₹10k"
              hint="Round every price up to the nearest multiple of this"
              info="Every computed price below ₹10,000 is rounded up to the nearest multiple of this ₹ amount, so customers never see an odd, over-precise number."
              isDefault={isDefaultKey("rounding")}
            >
              <NumberInput
                value={d.rounding?.below10k}
                onChange={(v) => setObjectField("rounding", "below10k", v)}
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Rounding — above ₹10k"
              info="Same rounding rule as above, but for computed prices ₹10,000 and over — usually a larger ₹ increment, since the price itself is bigger."
              isDefault={isDefaultKey("rounding")}
            >
              <NumberInput
                value={d.rounding?.above10k}
                onChange={(v) => setObjectField("rounding", "above10k", v)}
                width="w-20"
              />
            </FieldRow>
            <FieldRow
              label="Discounting enabled store-wide"
              hint="Off = every member sees list price, no negotiation, everywhere — a kill switch"
              info="A store-wide kill switch. Turn this off and every member sees plain list price everywhere — no base discount, no levers, no negotiation — instantly, with no deploy needed. Use this if something looks wrong and you need pricing to stop immediately while you investigate."
              isDefault={isDefaultKey("discounting.enabled")}
            >
              <BooleanToggle
                value={!!d["discounting.enabled"]}
                onChange={(v) => setKey("discounting.enabled", v)}
              />
            </FieldRow>
          </FieldGroup>
        </div>

        {/* Preview impact panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              Preview impact
            </h3>
            <p className="mb-3 text-xs text-gray-400">
              Pick a real product, then see the before/after effect of
              whatever's unsaved on the left — using a fixed standard-tier
              member, no cart, no campaigns, so the number is reproducible.
            </p>

            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search product…"
                value={previewSearch}
                onChange={(e) => handlePreviewSearchChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
              />
              {previewOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {previewOptions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPreviewProduct(p)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {p.title}
                      {p.vendor && (
                        <span className="ml-1 text-xs text-gray-400">
                          · {p.vendor}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {previewProduct && (
              <div className="mb-3">
                <p className="mb-1 text-xs text-gray-400">Variant</p>
                <select
                  value={previewVariantId}
                  onChange={(e) => {
                    setPreviewVariantId(e.target.value);
                    setPreviewResult(null);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400"
                >
                  {(previewProduct.Variant || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} — {formatCurrency(v.price)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={runPreview}
              disabled={previewLoading || !previewVariantId}
              className="mb-4 w-full rounded-lg bg-fairway-900 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800 disabled:opacity-50"
            >
              {previewLoading ? "Computing…" : "Preview impact"}
            </button>

            {dirtyKeys.length === 0 && (
              <p className="text-xs text-gray-400">
                Change a setting on the left to preview its effect.
              </p>
            )}

            {previewResult && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">
                      Before — member price
                    </p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(previewResult.before.memberPrice)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Lowest:{" "}
                      {formatCurrency(previewResult.before.lowestAgentPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">
                      After — member price
                    </p>
                    <p className="font-semibold text-fairway-700">
                      {formatCurrency(previewResult.after.memberPrice)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Lowest:{" "}
                      {formatCurrency(previewResult.after.lowestAgentPrice)}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                  <p>
                    Floor:{" "}
                    {formatCurrency(previewResult.before._full.floorPrice)} →{" "}
                    {formatCurrency(previewResult.after._full.floorPrice)}
                  </p>
                  <p>
                    Cost: {formatCurrency(previewResult.before._full.costPrice)}
                  </p>
                  <p>
                    Levers applied (after):{" "}
                    {previewResult.after._full.leversApplied.length
                      ? previewResult.after._full.leversApplied
                          .map((l) => l.name)
                          .join(", ")
                      : "none"}
                  </p>
                  {previewResult.after.thinRoom && (
                    <p className="mt-1 text-amber-600">
                      Thin room — no negotiation steps offered.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {Object.keys(savedByKey).length > 0 && (
            <p className="mt-3 px-1 text-xs text-gray-400">
              Last edited:{" "}
              {(() => {
                const mostRecent = rows
                  .filter((r) => r.updatedAt)
                  .sort(
                    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
                  )[0];
                return mostRecent
                  ? `${mostRecent.updatedBy} · ${formatDateTime(mostRecent.updatedAt)}`
                  : "never";
              })()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
