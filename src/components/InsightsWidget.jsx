// src/components/InsightsWidget.jsx
//
// Module 7. Wired to POST /api/insights/ask — read-only helper agent, no
// conversation persisted server-side, so the widget's own local message
// state is the only history and gets sent back with each request.
//
// Campaign flow (v2):
//   1. Agent calls preview_audience → confirms audience in chat
//   2. Agent calls suggest_campaign_content → returns 3 variants (no DB write)
//      Each variant: { label, tone, bodyText, headerType, headerText, headerImagePromptHint, headerImageHeadline, headerImageProductTitles, footerText, buttons }
//      headerImageHeadline is optional short wording (e.g. "Celebrate Diwali with Us")
//      rendered directly into the generated image — see imageGenerationService.js
//      for why that's a deliberate trade-off, not a default.
//      headerImageProductTitles is optional — set only when the campaign names real
//      catalog products the agent already confirmed via check_product_photo. When
//      present, the backend composites those REAL photos into the image instead of
//      drawing a generic AI stand-in — see imageCompositingService.js. The widget
//      surfaces which titles matched/didn't under the preview (see imgS.matchedProductTitles
//      / imgS.unmatchedProductTitles below) so staff can see this at a glance.
//   3. Frontend shows CampaignContentPicker with 3 selectable variants + editable text
//   4. Staff picks/edits → clicks "Save Draft" → frontend POSTs to /api/campaigns/draft
//      then PATCHes /api/campaigns/:id/template with full component data
//      (IMAGE headerType stored as-is; image is generated at submit time)
//   5. Card flips to CampaignSavedCard with "Open in Campaigns →"

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askInsights } from "../api/insights";
import {
  saveCampaignDraft,
  updateCampaignTemplate,
  previewCampaignImage as previewCampaignImageApi,
  recomposeCampaignImageText as recomposeCampaignImageTextApi,
} from "../api/broadcast-campaigns";
import {
  GolfFlagMark,
  ChatBubbleIcon,
  CloseIcon,
  SparkIcon,
  BarChartIcon,
  TruckIcon,
  UserCheckIcon,
  ChevronRightIcon,
  SendIcon,
} from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// CampaignContentPicker
//
// Shown when the agent calls suggest_campaign_content (action: SHOW_CONTENT_PICKER).
// Lets staff pick from 3 variants (with optional header/footer/buttons), edit,
// then Save Draft.
// ─────────────────────────────────────────────────────────────────────────────
function CampaignContentPicker({ data, onSaved }) {
  const [selectedIdx, setSelectedIdx] = useState(data.recommendedIndex ?? 0);
  const [editedText, setEditedText] = useState(
    data.variants[data.recommendedIndex ?? 0]?.bodyText || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Cache key for sessionStorage — scoped to this campaign so different campaigns
  // don't share each other's images within the same browser tab.
  const imageCacheKey = `imgcache:${data.campaignName}`;

  // IMAGE preview state — keyed by variant index so each variant has its own image.
  // Seed priority (highest → lowest):
  //   1. headerImageUrl already saved on the variant (backend returned a saved draft URL)
  //   2. sessionStorage cache from a previous generation this browser session
  //   3. Empty — will trigger a fresh Replicate call
  const [imageState, setImageState] = useState(() => {
    // Start from backend-saved URLs
    const initial = {};
    data.variants.forEach((v, idx) => {
      if (v.headerType === "IMAGE" && v.headerImageUrl) {
        initial[idx] = { url: v.headerImageUrl, loading: false, error: null };
      }
    });
    // Fill any gaps from sessionStorage (survives widget close/reopen this tab)
    try {
      const cached = JSON.parse(sessionStorage.getItem(imageCacheKey) || "{}");
      Object.entries(cached).forEach(([idx, url]) => {
        const i = Number(idx);
        if (!initial[i] && url) {
          initial[i] = { url, loading: false, error: null };
        }
      });
    } catch (_) {
      /* sessionStorage unavailable — ignore */
    }
    return initial;
  });

  // Persist generated URLs to sessionStorage whenever imageState changes
  useEffect(() => {
    try {
      const toCache = {};
      Object.entries(imageState).forEach(([idx, state]) => {
        if (state?.url) toCache[idx] = state.url;
      });
      if (Object.keys(toCache).length > 0) {
        sessionStorage.setItem(imageCacheKey, JSON.stringify(toCache));
      }
    } catch (_) {
      /* sessionStorage unavailable — ignore */
    }
  }, [imageState, imageCacheKey]);

  // Tracks which variant indices have had a generation started — prevents React strict-mode
  // double-fire and any other re-render from firing a second Replicate request
  const generatingRef = useRef(new Set());

  // Staff-editable overrides for the on-image eyebrow/headline/badge text,
  // keyed by variant index. Starts undefined (falls back to the agent's own
  // wording) and is only populated once staff actually edits a field —
  // see wordingFor() below, which merges this over the agent's defaults.
  const [wordingEdits, setWordingEdits] = useState({});
  const [wordingSaving, setWordingSaving] = useState({});

  function wordingFor(idx) {
    const variant = data.variants[idx] || {};
    const override = wordingEdits[idx] || {};
    return {
      eyebrow: override.eyebrow ?? variant.headerImageEyebrow ?? "",
      headline: override.headline ?? variant.headerImageHeadline ?? "",
      badgeText: override.badgeText ?? variant.headerImageBadgeText ?? "",
    };
  }

  function setWordingField(idx, field, value) {
    setWordingEdits((prev) => ({
      ...prev,
      [idx]: { ...wordingFor(idx), [field]: value },
    }));
  }

  // Re-draws the text layer over the already-generated backdrop — no new
  // Flux call, near-instant. Only available once a composite preview has
  // returned a backdropUrl (the real-product-photo path); the plain
  // AI-scene path doesn't have a backdrop separate from its final image.
  async function handleUpdateWording(idx) {
    const imgS = imageState[idx];
    if (!imgS?.backdropUrl) return;
    const variant = data.variants[idx] || {};
    const wording = wordingFor(idx);
    setWordingSaving((prev) => ({ ...prev, [idx]: true }));
    try {
      const json = await recomposeCampaignImageTextApi({
        backdropUrl: imgS.backdropUrl,
        headerImageProductTitles: variant.headerImageProductTitles || null,
        headerImageEyebrow: wording.eyebrow || null,
        headerImageHeadline: wording.headline || null,
        headerImageBadgeText: wording.badgeText || null,
        campaignName: data.campaignName,
      });
      setImageState((prev) => ({
        ...prev,
        [idx]: { ...prev[idx], url: json.imageUrl },
      }));
    } catch (err) {
      console.error("recomposeCampaignImageText failed:", err);
      setError("Failed to update the image wording. Try again.");
    } finally {
      setWordingSaving((prev) => ({ ...prev, [idx]: false }));
    }
  }

  const selectedVariant = data.variants[selectedIdx] || {};

  // Auto-generate image when an IMAGE variant is first selected.
  // React strict-mode double-invokes effects: mount → cleanup → mount again.
  // We use a module-level flag (not a ref) per component instance so the
  // second mount sees it already set and skips the duplicate Replicate call.
  useEffect(() => {
    const variant = data.variants[selectedIdx];
    if (!variant || variant.headerType !== "IMAGE") return;
    // Already have an image (or in-flight) for this variant — skip
    if (imageState[selectedIdx]?.url || imageState[selectedIdx]?.loading)
      return;
    // Deduplicate: set the ref BEFORE the async call, clear on cleanup so
    // the second strict-mode invocation is blocked but a tab-switch retry works.
    if (generatingRef.current.has(selectedIdx)) return;
    generatingRef.current.add(selectedIdx);

    let cancelled = false;
    resolveImageForVariant(selectedIdx, variant, () => cancelled);

    return () => {
      // On strict-mode cleanup, remove so the real second mount can proceed.
      // But only if no image loaded yet — don't cancel a completed generation.
      if (!imageState[selectedIdx]?.url) {
        generatingRef.current.delete(selectedIdx);
      }
    };
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Path A(composite) / Path B gate for a variant's IMAGE header.
  //
  // The agent — not the frontend — decides whether a real catalog photo
  // belongs in this image. It runs check_product_photo on every specific
  // product it finds in the request and, if a real photo should be used
  // (one product or several — see insightsAgentConfig.js STEP 2.5), sets
  // headerImageProductTitles with the exact confirmed title(s).
  //
  //   - headerImageProductTitles present → generateImageForVariant, which
  //     composites those exact real photos onto an AI backdrop.
  //   - headerImageProductTitles absent → generateImageForVariant, which
  //     generates a fully AI scene from headerImagePromptHint.
  //
  // This used to also run its OWN independent check here: fuzzy-matching
  // the entire campaignName string against the catalog (resolveProductImageApi)
  // and silently swapping in whatever it found — regardless of what the
  // agent and staff had already decided. That is what caused a real bug:
  // a campaign named "Diwali Gift Box - Titleist Pro V1 & Pro V1x Golf
  // Balls" coincidentally fuzzy-matched a single catalog product by name
  // alone, and got shown even after the staff explicitly chose "generic
  // themed image instead". The agent's decision is now the only source of
  // truth for which path to take — this function no longer re-guesses.
  async function resolveImageForVariant(
    idx,
    variant,
    isCancelled = () => false,
  ) {
    generatingRef.current.add(idx);
    setImageState((prev) => ({
      ...prev,
      [idx]: {
        url: null,
        loading: true,
        error: null,
        source: null,
        stage: "checking",
      },
    }));
    await generateImageForVariant(idx, variant, isCancelled);
  }

  // Staff picked a specific product out of an ambiguous match list.
  //
  // Kept for a possible future "swap in a different catalog photo manually"
  // affordance, but nothing currently calls this automatically — the blind
  // campaign-name-based auto-lookup that used to drive it was removed (see
  // resolveImageForVariant above) because it could override the agent's and
  // staff's own explicit decision about whether to use a real photo at all.
  function pickProductCandidate(idx, product) {
    setImageState((prev) => ({
      ...prev,
      [idx]: {
        url: product.imageUrls[0],
        loading: false,
        error: null,
        source: "catalog",
        images: product.imageUrls,
        imageIdx: 0,
        productTitle: product.title,
      },
    }));
  }

  // Cycle to the next real photo for the matched product ("Try another photo").
  function cycleCatalogImage(idx) {
    setImageState((prev) => {
      const cur = prev[idx];
      if (!cur?.images?.length) return prev;
      const nextIdx = (cur.imageIdx + 1) % cur.images.length;
      return {
        ...prev,
        [idx]: { ...cur, imageIdx: nextIdx, url: cur.images[nextIdx] },
      };
    });
  }

  // Staff rejected every real photo (or every ambiguous candidate) —
  // drop down to Path B and generate a themed scene instead.
  function switchToGeneration(idx, variant) {
    generatingRef.current.delete(idx);
    generateImageForVariant(idx, variant);
  }

  // PRODUCT_PHOTOS_UNRESOLVED recovery — the confirmed product's photo
  // couldn't be found at generation time. "Try again" re-sends the exact
  // same request (the lookup failure may be transient); "Generate AI scene
  // instead" explicitly strips headerImageProductTitles so the backend
  // takes the fully-AI path on purpose, with the staff member having
  // chosen that knowingly rather than it happening silently.
  function retryUnresolved(idx, variant) {
    generatingRef.current.delete(idx);
    generateImageForVariant(idx, variant);
  }
  function proceedAiOnly(idx, variant) {
    generatingRef.current.delete(idx);
    generateImageForVariant(idx, {
      ...variant,
      headerImageProductTitles: null,
      imageMode: null,
    });
  }

  // RAW_PHOTO tab switcher — moves to the matched product's next real
  // catalog photo. Re-calls the backend (passing the new index) rather
  // than swapping the <img> src to the raw catalog URL directly: the raw
  // photo may not be square, and the backend's padded/composited version
  // is what actually gets submitted to Meta, so the preview has to show
  // that exact version, not a stand-in. This path has no AI call, so the
  // round trip is effectively instant either way.
  function cyclePhotoTab(idx, variant) {
    const cur = imageState[idx];
    if (!cur?.availableProductImages?.length) return;
    const nextIdx =
      ((cur.selectedProductImageIndex ?? 0) + 1) %
      cur.availableProductImages.length;
    generatingRef.current.delete(idx);
    generateImageForVariant(idx, variant, () => false, nextIdx);
  }

  async function generateImageForVariant(
    idx,
    variant,
    isCancelled = () => false,
    selectedProductImageIndex = 0,
  ) {
    // Mark as in-flight (deduplicate) and set loading state
    generatingRef.current.add(idx);
    setImageState((prev) => ({
      ...prev,
      [idx]: { url: null, loading: true, error: null, stage: "generating" },
    }));
    try {
      const json = await previewCampaignImageApi({
        campaignName: data.campaignName,
        intent: data.intent || "golf campaign",
        context: variant.bodyText?.slice(0, 200) || "",
        headerImagePromptHint: variant.headerImagePromptHint || null,
        headerImageEyebrow: variant.headerImageEyebrow || null,
        headerImageHeadline: variant.headerImageHeadline || null,
        headerImageBadgeText: variant.headerImageBadgeText || null,
        headerImageProductTitles: variant.headerImageProductTitles || null,
        // "AI_SCENE" (Flux backdrop + real photo composited) or
        // "RAW_PHOTO" (real photo on a plain backdrop, no AI call at all)
        // — the staff member's explicit choice, stamped onto the variant
        // by suggest_campaign_content. null when there's no real product
        // photo to choose a presentation for.
        imageMode: variant.imageMode || null,
        // RAW_PHOTO only: which of the matched product's real catalog
        // photos to use, when it has more than one. See cyclePhotoTab.
        selectedProductImageIndex,
      });
      if (!isCancelled()) {
        setImageState((prev) => ({
          ...prev,
          [idx]: {
            url: json.imageUrl,
            // The plain backdrop (AI scene, or on the raw-photo path a flat
            // brand-color panel) before products/text — kept so staff can
            // edit the wording afterward without regenerating (see
            // handleUpdateWording above).
            backdropUrl: json.backdropUrl || null,
            loading: false,
            error: null,
            unresolved: false,
            imageMode: json.imageMode || null,
            // Present only when headerImageProductTitles was sent — lets staff
            // see at a glance whether their REAL catalog photos made it into
            // the composited image, or whether one silently fell back to AI
            // (e.g. archived between check_product_photo and now).
            matchedProductTitles: json.matchedProductTitles || null,
            unmatchedProductTitles: json.unmatchedProductTitles || null,
            // RAW_PHOTO only, and only when the matched product has more
            // than one real photo on file — drives the "Photo 1/3" tab
            // switcher instead of the AI "Generate new image" button,
            // which this path never shows (see cyclePhotoTab).
            availableProductImages: json.availableProductImages || null,
            selectedProductImageIndex: json.selectedProductImageIndex ?? 0,
          },
        }));
        // Reset any stale wording overrides from a previous image for this
        // variant — the fresh generation already has the agent's latest
        // eyebrow/headline/badge baked in as the starting point.
        setWordingEdits((prev) => {
          if (!prev[idx]) return prev;
          const next = { ...prev };
          delete next[idx];
          return next;
        });
      }
    } catch (err) {
      // Clear the ref on error so the user can retry via "Generate new image"
      generatingRef.current.delete(idx);
      // PRODUCT_PHOTOS_UNRESOLVED (409) — the confirmed product's photo
      // couldn't be found at generation time (e.g. archived since
      // check_product_photo ran). This used to silently fall back to a
      // fully AI-imagined product with no signal to staff at all; now the
      // backend stops and tells us, so give staff an actual choice instead
      // of a generic error string.
      const data = err.response?.data;
      if (data?.error === "PRODUCT_PHOTOS_UNRESOLVED") {
        setImageState((prev) => ({
          ...prev,
          [idx]: {
            url: null,
            loading: false,
            error: null,
            unresolved: true,
            unmatchedProductTitles: data.unmatchedProductTitles || null,
            message: data.message,
          },
        }));
        return;
      }
      setImageState((prev) => ({
        ...prev,
        [idx]: { url: null, loading: false, error: err.message },
      }));
    }
  }

  // When user picks a different variant, pre-fill the edit area with it
  function selectVariant(idx) {
    setSelectedIdx(idx);
    setEditedText(data.variants[idx].bodyText);
    setError(null);
  }

  // Count characters of the full bodyText (WhatsApp counts total, not just after greeting)
  const charCount = editedText.length;
  const charOver = charCount > 1024;
  const charWarning = charCount > 800 && !charOver;

  async function handleSaveDraft() {
    if (!editedText.trim() || charOver) return;
    if (!editedText.startsWith("Hi {{1}},")) {
      setError('Message must start with "Hi {{1}},"');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // Step 1: create the draft (bodyText + audience)
      const res = await saveCampaignDraft({
        name: data.campaignName,
        bodyText: editedText.trim(),
        audienceRules: data.audienceRules,
        agentPrompt: data.agentPrompt || data.intent || "",
      });

      const campaignId = res.data.campaignId;

      // Step 2: patch template components onto the draft.
      // For IMAGE headers: save the already-generated preview URL into the DB
      // so submit time can use it directly (no re-generation needed).
      const previewImageUrl =
        selectedVariant.headerType === "IMAGE"
          ? imageState[selectedIdx]?.url || null
          : null;

      const hasComponents =
        selectedVariant.headerType ||
        selectedVariant.headerText ||
        selectedVariant.footerText ||
        (Array.isArray(selectedVariant.buttons) &&
          selectedVariant.buttons.length > 0);

      if (hasComponents) {
        await updateCampaignTemplate(campaignId, {
          bodyText: editedText.trim(),
          headerType: selectedVariant.headerType || "NONE",
          headerText: selectedVariant.headerText || null,
          headerImageUrl: previewImageUrl,
          footerText: selectedVariant.footerText || null,
          buttons: selectedVariant.buttons || [],
        });
      }

      onSaved({
        campaignId,
        name: res.data.campaignName,
        audienceSize: res.data.audienceSize,
        bodyText: res.data.bodyText,
      });
    } catch (err) {
      console.error("saveCampaignDraft failed:", err);
      setError("Failed to save draft. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e4e4e7",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#f4f6f4",
          borderBottom: "1px solid #e4e4e7",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#18181b" }}>
            📣 {data.campaignName}
          </div>
          <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>
            {data.audienceSize} recipient{data.audienceSize !== 1 ? "s" : ""} ·
            Choose a message
          </div>
        </div>
      </div>

      {/* Variant selector tabs */}
      <div style={{ padding: "10px 14px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#52525b",
            marginBottom: 6,
          }}
        >
          PICK A VERSION
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.variants.map((v, idx) => {
            const isSelected = idx === selectedIdx;
            const isRecommended = idx === (data.recommendedIndex ?? 0);
            const hasImageHeader = v.headerType === "IMAGE";
            const hasTextHeader = v.headerType === "TEXT" && v.headerText;
            const hasFooter = !!v.footerText;
            const hasButtons = Array.isArray(v.buttons) && v.buttons.length > 0;
            const hasAnyComponent =
              hasImageHeader || hasTextHeader || hasFooter || hasButtons;

            return (
              <button
                key={idx}
                onClick={() => selectVariant(idx)}
                style={{
                  textAlign: "left",
                  background: isSelected ? "#f0fdf4" : "#fafafa",
                  border: isSelected
                    ? "1.5px solid #16a34a"
                    : "1.5px solid #e4e4e7",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {/* Label row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isSelected ? "#16a34a" : "#71717a",
                    }}
                  >
                    {v.label}
                  </span>
                  {isRecommended && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#fef9c3",
                        color: "#854d0e",
                        border: "1px solid #fde047",
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      ✦ Recommended
                    </span>
                  )}
                </div>

                {/* IMAGE header — show thumbnail if generated, spinner if loading */}
                {hasImageHeader &&
                  (() => {
                    const imgS = imageState[idx];
                    if (imgS?.loading) {
                      return (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#7c3aed",
                            background: "#f5f3ff",
                            border: "1px solid #ddd6fe",
                            borderRadius: 4,
                            padding: "5px 8px",
                            marginBottom: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              border: "2px solid #7c3aed",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 0.7s linear infinite",
                            }}
                          />
                          <span>Generating AI golf scene…</span>
                        </div>
                      );
                    }
                    if (imgS?.url) {
                      return (
                        <div
                          style={{
                            marginBottom: 4,
                            borderRadius: 6,
                            overflow: "hidden",
                            border: "1px solid #ddd6fe",
                          }}
                        >
                          <img
                            src={imgS.url}
                            alt="AI-generated golf scene"
                            style={{
                              width: "100%",
                              display: "block",
                              aspectRatio: "1/1",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      );
                    }
                    if (imgS?.error) {
                      return (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#dc2626",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 4,
                            padding: "4px 8px",
                            marginBottom: 4,
                          }}
                        >
                          ⚠ Image failed · will retry on select
                        </div>
                      );
                    }
                    return (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#7c3aed",
                          background: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          borderRadius: 4,
                          padding: "3px 8px",
                          marginBottom: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span>🖼</span>
                        <span>AI golf scene</span>
                      </div>
                    );
                  })()}

                {/* TEXT header preview */}
                {hasTextHeader && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#3f3f46",
                      background: "#f4f4f5",
                      borderRadius: 4,
                      padding: "2px 6px",
                      marginBottom: 4,
                      display: "inline-block",
                    }}
                  >
                    🏷 {v.headerText}
                  </div>
                )}

                {/* Body text */}
                <div
                  style={{ fontSize: 12, color: "#3f3f46", lineHeight: 1.4 }}
                >
                  {v.bodyText}
                </div>

                {/* Footer preview */}
                {hasFooter && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "#71717a",
                      marginTop: 3,
                      fontStyle: "italic",
                    }}
                  >
                    {v.footerText}
                  </div>
                )}

                {/* Buttons preview */}
                {hasButtons && (
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      flexWrap: "wrap",
                      marginTop: 5,
                    }}
                  >
                    {v.buttons.map((btn, bi) => (
                      <span
                        key={bi}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: "#0ea5e9",
                          border: "1px solid #bae6fd",
                          background: "#f0f9ff",
                          borderRadius: 4,
                          padding: "2px 7px",
                        }}
                      >
                        {btn.text}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tone + components indicator row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#a1a1aa" }}>{v.tone}</div>
                  {hasAnyComponent && (
                    <div style={{ fontSize: 10, color: "#7c3aed" }}>
                      {[
                        hasImageHeader && "image",
                        hasTextHeader && "header",
                        hasFooter && "footer",
                        hasButtons && "buttons",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable text area */}
      <div style={{ padding: "10px 14px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#52525b",
            marginBottom: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>EDIT MESSAGE</span>
          <span
            style={{
              fontSize: 11,
              color: charOver ? "#ef4444" : charWarning ? "#f59e0b" : "#a1a1aa",
              fontWeight: charOver || charWarning ? 700 : 400,
            }}
          >
            {charCount}/1024
          </span>
        </div>
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "#18181b",
            background: "#fafafa",
            border: `1.5px solid ${charOver ? "#ef4444" : "#e4e4e7"}`,
            borderRadius: 8,
            padding: "8px 10px",
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = charOver ? "#ef4444" : "#16a34a")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = charOver ? "#ef4444" : "#e4e4e7")
          }
        />
        {charOver && (
          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>
            Message is too long — keep it under 1024 characters.
          </div>
        )}
        {!charOver &&
          !editedText.startsWith("Hi {{1}},") &&
          editedText.length > 0 && (
            <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 3 }}>
              Message should start with "Hi {"{{1}}"},"
            </div>
          )}
      </div>

      {/* Selected variant component summary (if any) */}
      {selectedVariant.headerType === "IMAGE" ||
      (selectedVariant.headerType === "TEXT" && selectedVariant.headerText) ||
      selectedVariant.footerText ||
      (Array.isArray(selectedVariant.buttons) &&
        selectedVariant.buttons.length > 0) ? (
        <div
          style={{
            margin: "8px 14px 0",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 6,
            padding: "7px 10px",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#7c3aed",
              marginBottom: 4,
            }}
          >
            TEMPLATE COMPONENTS
          </div>

          {/* IMAGE header — Path A (real catalog photo) or Path B (AI-generated scene) */}
          {selectedVariant.headerType === "IMAGE" &&
            (() => {
              const imgS = imageState[selectedIdx];

              // ── Loading (either the catalog lookup or a Replicate call) ──
              if (imgS?.loading) {
                return (
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 0",
                        fontSize: 11,
                        color: "#7c3aed",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          border: "2px solid #7c3aed",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      {imgS.stage === "generating"
                        ? "Generating your campaign scene… (~7 seconds)"
                        : "Checking the catalog for a matching product photo…"}
                    </div>
                  </div>
                );
              }

              // ── Ambiguous: several products matched the campaign name ──
              if (imgS?.source === "catalog-ambiguous") {
                return (
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#52525b",
                        marginBottom: 6,
                      }}
                    >
                      Header: which product did you mean?
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {imgS.candidates.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => pickProductCandidate(selectedIdx, p)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            border: "1px solid #ddd6fe",
                            background: "#f5f3ff",
                            borderRadius: 6,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                        >
                          <img
                            src={p.imageUrls[0]}
                            alt={p.title}
                            style={{
                              width: 28,
                              height: 28,
                              objectFit: "cover",
                              borderRadius: 4,
                            }}
                          />
                          <span style={{ fontSize: 11, color: "#3f3f46" }}>
                            {p.title}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        switchToGeneration(selectedIdx, selectedVariant)
                      }
                      style={{
                        marginTop: 6,
                        fontSize: 10.5,
                        color: "#71717a",
                        background: "none",
                        border: "none",
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      None of these — generate an image instead
                    </button>
                  </div>
                );
              }

              // ── Real catalog photo (Path A) ──
              if (imgS?.source === "catalog") {
                return (
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#52525b",
                        marginBottom: 4,
                      }}
                    >
                      Header: 📦 real photo — {imgS.productTitle}
                    </div>
                    {imgS.url && (
                      <div
                        style={{
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid #bbf7d0",
                          marginBottom: 6,
                        }}
                      >
                        <img
                          src={imgS.url}
                          alt={`${imgS.productTitle} — catalog photo`}
                          style={{
                            width: "100%",
                            display: "block",
                            aspectRatio: "1/1",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {imgS.images?.length > 1 && (
                        <button
                          onClick={() => cycleCatalogImage(selectedIdx)}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#15803d",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            borderRadius: 5,
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          🔄 Try another photo ({imgS.imageIdx + 1}/
                          {imgS.images.length})
                        </button>
                      )}
                      <button
                        onClick={() =>
                          switchToGeneration(selectedIdx, selectedVariant)
                        }
                        style={{
                          fontSize: 10.5,
                          color: "#71717a",
                          background: "none",
                          border: "1px solid #e4e4e7",
                          borderRadius: 5,
                          padding: "4px 10px",
                          cursor: "pointer",
                        }}
                      >
                        None of these — generate instead
                      </button>
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: "#15803d",
                        lineHeight: 1.4,
                      }}
                    >
                      ✦ This is the real product photo from your catalog — no AI
                      generation involved. It will be submitted to Meta as-is.
                    </div>
                  </div>
                );
              }

              // ── Staff chose RAW_PHOTO (STEP 2.6) — real product photo
              //    as-is, no AI generation, no "Generate new image" button
              //    (there's nothing for it to regenerate). When the matched
              //    product has more than one real photo on file, show a
              //    "Photo 1/3" switcher instead — that's the staff's actual
              //    lever on this path. ──
              if (imgS?.imageMode === "RAW_PHOTO") {
                return (
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#52525b",
                        marginBottom: 4,
                      }}
                    >
                      Header: 📦 real product photo
                      {imgS.matchedProductTitles?.length > 0 &&
                        ` — ${imgS.matchedProductTitles.join(", ")}`}
                    </div>
                    {imgS.url && (
                      <div
                        style={{
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid #bbf7d0",
                          marginBottom: 6,
                        }}
                      >
                        <img
                          src={imgS.url}
                          alt="Real product photo preview"
                          style={{
                            width: "100%",
                            display: "block",
                            aspectRatio: "1/1",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}
                    {imgS?.error && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#dc2626",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: 5,
                          padding: "5px 8px",
                          marginBottom: 5,
                        }}
                      >
                        ⚠ {imgS.error}
                      </div>
                    )}
                    {imgS.availableProductImages?.length > 1 && (
                      <button
                        onClick={() =>
                          cyclePhotoTab(selectedIdx, selectedVariant)
                        }
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#15803d",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 5,
                          padding: "4px 10px",
                          cursor: "pointer",
                        }}
                      >
                        🔄 Try another photo (
                        {(imgS.selectedProductImageIndex ?? 0) + 1}/
                        {imgS.availableProductImages.length})
                      </button>
                    )}
                    {imgS.url && (
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 10,
                          color: "#15803d",
                          lineHeight: 1.4,
                        }}
                      >
                        ✦ This is your real product photo, unmodified — no AI
                        generation, no text drawn on it. It will be submitted to
                        Meta as shown here.
                      </div>
                    )}
                  </div>
                );
              }

              // ── AI-generated themed scene (Path B) — no catalog match,
              //    or staff chose to generate instead ──
              return (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#52525b",
                      marginBottom: 4,
                    }}
                  >
                    Header: 🖼 AI-generated scene
                  </div>

                  {imgS?.url && (
                    <div
                      style={{
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #ddd6fe",
                        marginBottom: 6,
                      }}
                    >
                      <img
                        src={imgS.url}
                        alt="AI-generated campaign scene preview"
                        style={{
                          width: "100%",
                          display: "block",
                          aspectRatio: "1/1",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  )}
                  {imgS?.error && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#dc2626",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 5,
                        padding: "5px 8px",
                        marginBottom: 5,
                      }}
                    >
                      ⚠ {imgS.error}
                    </div>
                  )}
                  <button
                    onClick={() =>
                      generateImageForVariant(selectedIdx, selectedVariant)
                    }
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#7c3aed",
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: 5,
                      padding: "4px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    🔄 {imgS?.url ? "Generate new image" : "Generate image"}
                  </button>

                  {imgS?.url && (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: "#7c3aed",
                        lineHeight: 1.4,
                      }}
                    >
                      ✦ This exact image will be submitted to Meta. If you want
                      a different one, click "Generate new image" above.
                      {selectedVariant?.headerImageHeadline && (
                        <>
                          {" "}
                          Check that the wording "
                          {selectedVariant.headerImageHeadline}" came out
                          legible and correctly spelled — AI image generation
                          can occasionally garble on-image text. Regenerate if
                          it doesn't read cleanly.
                        </>
                      )}
                    </div>
                  )}

                  {/* PRODUCT_PHOTOS_UNRESOLVED — the confirmed product photo
                      couldn't be found at generation time. Give staff an
                      explicit choice instead of silently swapping to an
                      AI-imagined product with no signal at all. */}
                  {imgS?.unresolved && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10.5,
                        color: "#991b1b",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 5,
                        padding: "6px 8px",
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠{" "}
                      {imgS.message ||
                        "Couldn't find a usable photo for the confirmed product(s)."}
                      {imgS.unmatchedProductTitles?.length > 0 && (
                        <> ({imgS.unmatchedProductTitles.join(", ")})</>
                      )}
                      <div style={{ marginTop: 5, display: "flex", gap: 8 }}>
                        <button
                          onClick={() =>
                            retryUnresolved(selectedIdx, selectedVariant)
                          }
                          style={{
                            fontSize: 10,
                            color: "#991b1b",
                            background: "none",
                            border: "1px solid #fecaca",
                            borderRadius: 4,
                            padding: "3px 7px",
                            cursor: "pointer",
                          }}
                        >
                          Try again
                        </button>
                        <button
                          onClick={() =>
                            proceedAiOnly(selectedIdx, selectedVariant)
                          }
                          style={{
                            fontSize: 10,
                            color: "#991b1b",
                            background: "none",
                            border: "1px solid #fecaca",
                            borderRadius: 4,
                            padding: "3px 7px",
                            cursor: "pointer",
                          }}
                        >
                          Generate AI scene instead
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Real-product-compositing status — only present when this
                      variant named real catalog products (headerImageProductTitles).
                      Lets staff see at a glance whether their actual photos made
                      it into the image, not a generic AI stand-in. */}
                  {imgS?.matchedProductTitles &&
                    imgS.matchedProductTitles.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 10,
                          color: "#15803d",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 5,
                          padding: "5px 8px",
                          lineHeight: 1.4,
                        }}
                      >
                        ✓ Using your real catalog photos for:{" "}
                        {imgS.matchedProductTitles.join(", ")}
                      </div>
                    )}
                  {imgS?.unmatchedProductTitles &&
                    imgS.unmatchedProductTitles.length > 0 && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: "#b45309",
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 5,
                          padding: "5px 8px",
                          lineHeight: 1.4,
                        }}
                      >
                        ⚠ No photo found for:{" "}
                        {imgS.unmatchedProductTitles.join(", ")} — that part of
                        the image was left out rather than shown as a generic
                        stand-in.
                      </div>
                    )}

                  {/* Editable wording — only once a composite preview has
                      returned a backdropUrl, so an edit can be re-drawn
                      instantly over the existing AI scene instead of
                      triggering a brand-new (slower, rate-limited) Flux
                      generation. */}
                  {imgS?.backdropUrl &&
                    (() => {
                      const wording = wordingFor(selectedIdx);
                      const saving = !!wordingSaving[selectedIdx];
                      const fieldStyle = {
                        width: "100%",
                        boxSizing: "border-box",
                        fontSize: 11,
                        padding: "5px 7px",
                        border: "1px solid #e4e4e7",
                        borderRadius: 5,
                        marginBottom: 5,
                        fontFamily: "inherit",
                      };
                      return (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 8,
                            background: "#fafafa",
                            border: "1px solid #e4e4e7",
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: "#52525b",
                              marginBottom: 6,
                            }}
                          >
                            Edit the wording on the image
                          </div>
                          <input
                            type="text"
                            placeholder="Eyebrow (small line above headline) — optional"
                            value={wording.eyebrow}
                            maxLength={28}
                            onChange={(e) =>
                              setWordingField(
                                selectedIdx,
                                "eyebrow",
                                e.target.value,
                              )
                            }
                            style={fieldStyle}
                          />
                          <input
                            type="text"
                            placeholder="Headline — e.g. Christmas Golf Combo"
                            value={wording.headline}
                            maxLength={40}
                            onChange={(e) =>
                              setWordingField(
                                selectedIdx,
                                "headline",
                                e.target.value,
                              )
                            }
                            style={fieldStyle}
                          />
                          <input
                            type="text"
                            placeholder="Badge tag (short) — e.g. Festive Offer — optional"
                            value={wording.badgeText}
                            maxLength={16}
                            onChange={(e) =>
                              setWordingField(
                                selectedIdx,
                                "badgeText",
                                e.target.value,
                              )
                            }
                            style={{ ...fieldStyle, marginBottom: 7 }}
                          />
                          <button
                            onClick={() => handleUpdateWording(selectedIdx)}
                            disabled={saving}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#fff",
                              background: saving ? "#a1a1aa" : "#15803d",
                              border: "none",
                              borderRadius: 5,
                              padding: "5px 10px",
                              cursor: saving ? "default" : "pointer",
                            }}
                          >
                            {saving ? "Updating…" : "Update wording"}
                          </button>
                          <div
                            style={{
                              marginTop: 5,
                              fontSize: 9.5,
                              color: "#71717a",
                              lineHeight: 1.4,
                            }}
                          >
                            This only redraws the text — the photo itself stays
                            the same, so it's instant and doesn't use up another
                            image generation.
                          </div>
                        </div>
                      );
                    })()}
                </div>
              );
            })()}

          {/* TEXT header */}
          {selectedVariant.headerType === "TEXT" &&
            selectedVariant.headerText && (
              <div style={{ fontSize: 11, color: "#52525b", marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>Header:</span>{" "}
                {selectedVariant.headerText}
              </div>
            )}

          {selectedVariant.footerText && (
            <div style={{ fontSize: 11, color: "#52525b", marginBottom: 2 }}>
              <span style={{ fontWeight: 600 }}>Footer:</span>{" "}
              {selectedVariant.footerText}
            </div>
          )}
          {Array.isArray(selectedVariant.buttons) &&
            selectedVariant.buttons.length > 0 && (
              <div style={{ fontSize: 11, color: "#52525b" }}>
                <span style={{ fontWeight: 600 }}>Buttons:</span>{" "}
                {selectedVariant.buttons.map((b) => b.text).join(" · ")}
              </div>
            )}
        </div>
      ) : null}

      {/* Error */}
      {error && (
        <div style={{ padding: "6px 14px 0" }}>
          <div
            style={{
              fontSize: 11.5,
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "6px 10px",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* Save button */}
      <div style={{ padding: "10px 14px 12px" }}>
        <button
          onClick={handleSaveDraft}
          disabled={isSaving || charOver || !editedText.trim()}
          style={{
            width: "100%",
            background: isSaving || charOver ? "#d1d5db" : "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 0",
            fontSize: 13,
            fontWeight: 700,
            cursor: isSaving || charOver ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {isSaving ? "Saving…" : "Save Draft →"}
        </button>
        <div
          style={{
            fontSize: 10.5,
            color: "#a1a1aa",
            textAlign: "center",
            marginTop: 5,
          }}
        >
          You'll confirm and submit to Meta on the Campaigns page.
          {selectedVariant.headerType === "IMAGE" &&
            (imageState[selectedIdx]?.source === "catalog"
              ? " The real product photo will be submitted to Meta."
              : imageState[selectedIdx]?.url
                ? " The previewed image will be submitted to Meta."
                : " An AI scene will be generated at submit time.")}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CampaignSavedCard
//
// Shown after Save Draft completes successfully.
// ─────────────────────────────────────────────────────────────────────────────
function CampaignSavedCard({ campaign }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        border: "1px solid #27272a",
        borderLeft: "3px solid #16a34a",
        borderRadius: 8,
        padding: "10px 12px",
        background: "#18181b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#f4f4f5" }}>
          ✅ {campaign.name}
        </div>
        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
          {campaign.audienceSize} recipient
          {campaign.audienceSize !== 1 ? "s" : ""} · Draft saved
        </div>
      </div>
      <button
        onClick={() => navigate(`/broadcast-campaigns?id=${campaign.id}`)}
        style={{
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "5px 12px",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Open →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContentPickerWrapper
//
// Manages the local "saved" state so the picker flips to saved card in-place.
// ─────────────────────────────────────────────────────────────────────────────
function ContentPickerWrapper({ data }) {
  const [savedCampaign, setSavedCampaign] = useState(null);

  if (savedCampaign) {
    return <CampaignSavedCard campaign={savedCampaign} />;
  }

  return <CampaignContentPicker data={data} onSaved={setSavedCampaign} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion chips
// ─────────────────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: BarChartIcon, label: "This week's top sellers" },
  { icon: TruckIcon, label: "Suppliers falling behind" },
  { icon: UserCheckIcon, label: "Customers due a follow-up" },
];

const ERROR_REPLY =
  "Something went wrong reaching Insights. Try again in a moment.";

// ─────────────────────────────────────────────────────────────────────────────
// InsightsWidget — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function InsightsWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    origRight: 24,
    origBottom: 24,
    moved: false,
  });

  const DRAG_MARGIN = 12;
  const DRAG_THRESHOLD = 5;

  const [launcherPos, setLauncherPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("insights-launcher-pos"));
      if (
        saved &&
        typeof saved.right === "number" &&
        typeof saved.bottom === "number"
      )
        return saved;
    } catch {
      // ignore
    }
    return { right: 24, bottom: 24 };
  });

  function clamp(pos) {
    const el = launcherRef.current;
    const w = el?.offsetWidth || 60;
    const h = el?.offsetHeight || 60;
    return {
      right: Math.min(
        Math.max(pos.right, DRAG_MARGIN),
        window.innerWidth - w - DRAG_MARGIN,
      ),
      bottom: Math.min(
        Math.max(pos.bottom, DRAG_MARGIN),
        window.innerHeight - h - DRAG_MARGIN,
      ),
    };
  }

  useEffect(() => {
    function handleResize() {
      setLauncherPos((prev) => clamp(prev));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleLauncherPointerDown(e) {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: launcherPos.right,
      origBottom: launcherPos.bottom,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleLauncherPointerMove(e) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    const next = clamp({
      right: dragRef.current.origRight - dx,
      bottom: dragRef.current.origBottom - dy,
    });
    dragRef.current.lastPos = next;
    setLauncherPos(next);
  }

  function handleLauncherPointerUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (dragRef.current.moved) {
      try {
        localStorage.setItem(
          "insights-launcher-pos",
          JSON.stringify(dragRef.current.lastPos || launcherPos),
        );
      } catch {
        // storage unavailable
      }
    } else {
      setIsOpen(true);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isSending) inputRef.current?.focus();
  }, [isSending]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await askInsights(trimmed, history);
      const reply = res.data.reply;

      // v2: agent returns contentPickerData (from suggest_campaign_content)
      // instead of campaignData (from draft_campaign — now frontend-driven)
      const contentPicker = res.data.contentPicker || null;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: reply,
          contentPickerData: contentPicker,
        },
      ]);
    } catch (err) {
      console.error("askInsights failed:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: ERROR_REPLY },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {!isOpen && (
        <div
          ref={launcherRef}
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={handleLauncherPointerUp}
          style={{
            position: "fixed",
            right: launcherPos.right,
            bottom: launcherPos.bottom,
            touchAction: "none",
          }}
          className="z-40 flex cursor-grab items-center gap-2 select-none active:cursor-grabbing"
        >
          <span className="hidden rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-700 shadow-lg shadow-fairway-900/5 sm:inline-block">
            Ask Insights
          </span>
          <button
            type="button"
            onClick={() => {
              if (dragRef.current.moved) return;
              setIsOpen(true);
            }}
            aria-label="Open Insights assistant"
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-fairway-600 bg-fairway-700 text-fairway-100 shadow-[0_14px_28px_-10px_rgba(22,53,42,0.55)] hover:bg-fairway-800"
          >
            <ChatBubbleIcon className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-50 bg-gold-500 text-gold-600">
              <SparkIcon className="h-2.5 w-2.5" />
            </span>
          </button>
        </div>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          className="fixed inset-0 z-40 flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[80vh] sm:w-[400px] sm:rounded-[20px] sm:shadow-[0_24px_48px_-14px_rgba(22,53,42,0.28)]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2.5 bg-fairway-900 px-4 py-3.5 sm:rounded-t-[20px]">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fairway-600 bg-fairway-700">
              <GolfFlagMark className="h-4 w-4 text-gold-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-fairway-900 bg-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Insights</p>
              <p className="text-[11.5px] text-fairway-300">
                Online · answers from your live data
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close Insights assistant"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-fairway-200 hover:bg-white/15"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Message thread */}
          <div className="flex-1 space-y-2.5 overflow-y-auto bg-[#fbfcfb] px-4 py-4">
            <style>{`
              @keyframes insightsMessageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
              .insights-message-in { animation: insightsMessageIn 0.18s ease-out; }
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <AssistantBubble
              text="Hi, I'm Insights. Ask me anything about your customers, products, suppliers, or orders."
              time="Just now"
            />

            {messages.length === 0 && (
              <div>
                <p className="mb-2 pl-0.5 text-xs font-semibold text-gray-500">
                  Suggested
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => send(s.label)}
                      disabled={isSending}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-left hover:border-fairway-200 hover:bg-fairway-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fairway-50 text-fairway-700">
                        <s.icon />
                      </span>
                      <span className="flex-1 text-[13px] text-gray-800">
                        {s.label}
                      </span>
                      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="insights-message-in ml-auto w-fit max-w-[82%] rounded-2xl rounded-tr-sm bg-fairway-700 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white"
                >
                  {m.text}
                </div>
              ) : (
                <div key={i}>
                  <AssistantBubble
                    text={m.text}
                    showAvatar={
                      i === 0 || messages[i - 1]?.role !== "assistant"
                    }
                  />
                  {/* v2: content picker card (replaces old CampaignNotice) */}
                  {m.contentPickerData && (
                    <div style={{ paddingLeft: 34, marginTop: 8 }}>
                      <ContentPickerWrapper data={m.contentPickerData} />
                    </div>
                  )}
                </div>
              ),
            )}

            {isSending && <TypingIndicator />}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-gray-100 px-3.5 py-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your business…"
                disabled={isSending}
                className="flex-1 rounded-full border-[1.5px] border-fairway-200 px-3.5 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={isSending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fairway-700 text-white shadow-[0_4px_10px_rgba(35,84,61,0.35)] hover:bg-fairway-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
              >
                <SendIcon />
              </button>
            </div>
            <p className="mt-2 text-center text-[10.5px] text-gray-400">
              Insights can make mistakes. Check important info before acting on
              it.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function AssistantBubble({ text, time, muted, showAvatar = true }) {
  return (
    <div className="insights-message-in flex items-start gap-2">
      {showAvatar ? (
        <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-fairway-100">
          <GolfFlagMark className="h-3 w-3 text-fairway-700" />
        </span>
      ) : (
        <span className="w-[26px] shrink-0" aria-hidden="true" />
      )}
      <div>
        <div
          className={`rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm ${
            muted ? "italic text-gray-500" : "text-gray-800"
          }`}
        >
          <MarkdownLite text={text} />
        </div>
        {time && (
          <p className="ml-0.5 mt-1 text-[10.5px] text-gray-400">{time}</p>
        )}
      </div>
    </div>
  );
}

function renderInline(line, keyPrefix) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

function MarkdownLite({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let currentList = [];

  function flushList() {
    if (currentList.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-1 pl-4">
        {currentList.map((line, i) => (
          <li key={i}>{renderInline(line, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    currentList = [];
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (/^[-*]\s+/.test(line)) {
      currentList.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();
    if (line) {
      blocks.push(
        <p key={`p-${idx}`} className={blocks.length > 0 ? "mt-1.5" : ""}>
          {renderInline(line, `p-${idx}`)}
        </p>,
      );
    }
  });
  flushList();

  return <>{blocks}</>;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-fairway-100">
        <GolfFlagMark className="h-3 w-3 text-fairway-700" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-3.5 py-3 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
      </div>
    </div>
  );
}
