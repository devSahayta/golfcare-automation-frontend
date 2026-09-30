// src/components/InsightsWidget.jsx
//
// Module 7. Wired to POST /api/insights/ask — read-only helper agent, no
// conversation persisted server-side, so the widget's own local message
// state is the only history and gets sent back with each request.

import { useEffect, useRef, useState } from "react";
import { askInsights } from "../api/insights";
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

const SUGGESTIONS = [
  { icon: BarChartIcon, label: "This week's top sellers" },
  { icon: TruckIcon, label: "Suppliers falling behind" },
  { icon: UserCheckIcon, label: "Customers due a follow-up" },
];

const ERROR_REPLY =
  "Something went wrong reaching Insights. Try again in a moment.";

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
  const DRAG_THRESHOLD = 5; // px of movement before a click counts as a drag

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
      // ignore — fall through to default
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

  // Re-clamp on resize so a drag position from a wider window doesn't push
  // the button off-screen after resizing down (or rotating on mobile).
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
        // storage unavailable (private mode, etc.) — position just won't persist
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

  // Refocus after a send completes (input is disabled mid-send, so this
  // has to happen post-render, not inline in send()'s finally block) and
  // when the panel first opens, so typing can continue without reclicking.
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.data.reply },
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
              // A real drag can still fire a native "click" on release —
              // this guard is what stops that from also opening the panel.
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
          className="fixed inset-0 z-40 flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[80vh] sm:w-[380px] sm:rounded-[20px] sm:shadow-[0_24px_48px_-14px_rgba(22,53,42,0.28)]"
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
                <AssistantBubble
                  key={i}
                  text={m.text}
                  showAvatar={i === 0 || messages[i - 1]?.role !== "assistant"}
                />
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

// Chat replies only ever need bold and short bullet lists — not a reason
// to pull in a full markdown library. Handles **bold** inline and lines
// starting with "-" or "*" as a bullet list; everything else is a plain
// paragraph.
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
