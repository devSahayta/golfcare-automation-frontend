// src/components/AuditLogParts.jsx
//
// Shared by the Audit Log page (row detail drawer) and the Orders drawer
// (per-order activity timeline).
import Badge from "./ui/Badge";
import { humanizeAction, timeAgo, formatDateTime } from "../lib/format";
import { parseState, actionVariant } from "../lib/audit";

const ACTOR_VARIANT = { AGENT: "info", SYSTEM: "neutral" };

export function ActorBadge({ actorType, actorId }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={ACTOR_VARIANT[actorType] || "positive"}>
        {actorType}
      </Badge>
      {actorId && (
        <span className="max-w-[8rem] truncate text-xs text-gray-400">
          {actorId}
        </span>
      )}
    </span>
  );
}

function renderValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function StateDiff({ before, after }) {
  const b = parseState(before);
  const a = parseState(after);

  if (b === null && a === null) {
    return <p className="text-sm text-gray-400">No state recorded.</p>;
  }

  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(b ?? {}) || !isObj(a ?? {})) {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
        {JSON.stringify({ before: b, after: a }, null, 2)}
      </pre>
    );
  }

  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])];
  const hasBefore = b !== null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 text-sm">
      <div
        className={`grid gap-px bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 ${
          hasBefore ? "grid-cols-[6rem_1fr_1fr]" : "grid-cols-[6rem_1fr]"
        }`}
      >
        <span>Field</span>
        {hasBefore && <span>Before</span>}
        <span>{hasBefore ? "After" : "Value"}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {keys.map((k) => {
          const changed =
            hasBefore &&
            JSON.stringify((b || {})[k]) !== JSON.stringify((a || {})[k]);
          return (
            <div
              key={k}
              className={`grid gap-3 px-3 py-2 ${
                hasBefore ? "grid-cols-[6rem_1fr_1fr]" : "grid-cols-[6rem_1fr]"
              }`}
            >
              <span className="break-words text-gray-500">{k}</span>
              {hasBefore && (
                <span
                  className={`break-words ${changed ? "text-red-600 line-through decoration-red-300" : "text-gray-700"}`}
                >
                  {renderValue((b || {})[k])}
                </span>
              )}
              <span
                className={`break-words ${changed ? "font-medium text-fairway-700" : "text-gray-700"}`}
              >
                {renderValue((a || {})[k])}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One-line "field: old → new" summary for the timeline.
function changeSummary(log) {
  const b = parseState(log.beforeState);
  const a = parseState(log.afterState);
  if (!b || !a || typeof b !== "object" || typeof a !== "object") return null;
  const changes = Object.keys(a)
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .slice(0, 3)
    .map((k) => `${k}: ${renderValue(b[k])} → ${renderValue(a[k])}`);
  return changes.length ? changes.join(" · ") : null;
}

export function AuditTimeline({ logs }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-400">No activity recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-5">
      {logs.map((log) => {
        const summary = changeSummary(log);
        return (
          <li key={log.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-fairway-500 ring-1 ring-gray-200" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={actionVariant(log.action)}>
                {humanizeAction(log.action)}
              </Badge>
              <ActorBadge actorType={log.actorType} />
              <span
                className="text-xs text-gray-400"
                title={formatDateTime(log.createdAt)}
              >
                {timeAgo(log.createdAt)}
              </span>
            </div>
            {summary && <p className="mt-1 text-sm text-gray-600">{summary}</p>}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                Details
              </summary>
              <div className="mt-2">
                <StateDiff before={log.beforeState} after={log.afterState} />
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
