// src/pages/AgentUsage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchAgentUsageSummary, fetchAgentUsage } from "../api/agentUsage";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import { formatDateTime, humanizeAction } from "../lib/format";
import useDocumentTitle from "../hooks/useDocumentTitle";
import {
  SparkIcon,
  TruckIcon,
  ChatBubbleIcon,
  MegaphoneIcon,
} from "../components/icons";

const AGENT_TABS = [
  { id: "sales", label: "Sales Agent", icon: ChatBubbleIcon, color: "#2c6b4c" },
  {
    id: "supplier",
    label: "Supplier Agent",
    icon: TruckIcon,
    color: "#c9a227",
  },
  { id: "insights", label: "Insights", icon: SparkIcon, color: "#3b6ea5" },
  {
    id: "campaign",
    label: "Campaign Agent",
    icon: MegaphoneIcon,
    color: "#8b5fa8",
  },
];

const AGENT_COLOR = Object.fromEntries(AGENT_TABS.map((t) => [t.id, t.color]));

function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  return `$${Number(value).toFixed(4)}`;
}

function formatInr(value) {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toFixed(2)}`;
}

function formatTokens(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function outcomeVariant(outcome) {
  if (outcome === "completed" || outcome === "sent") return "positive";
  if (
    outcome === "error" ||
    outcome === "failed" ||
    outcome === "rejected" ||
    outcome === "meta_rejected"
  )
    return "danger";
  if (
    outcome === "iteration_cap" ||
    outcome === "pending" ||
    outcome === "awaiting_approval"
  )
    return "warning";
  return "neutral";
}

// Groups rows by calendar day (in the viewer's local time) for the trend
// chart. The backend returns raw rows, not pre-bucketed — this keeps the
// aggregation simple and avoids a second query shape on the backend
// purely for charting.
function buildDailyTrend(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const day = new Date(row.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD, sorts naturally
    const existing = byDay.get(day) || { day, costInr: 0, interactions: 0 };
    existing.costInr += Number(row.costInr || 0);
    existing.interactions += 1;
    byDay.set(day, existing);
  }
  return Array.from(byDay.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      ...d,
      label: new Date(d.day).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      costInr: Number(d.costInr.toFixed(2)),
    }));
}

function CostSplitChart({ summary }) {
  const data = AGENT_TABS.map((t) => ({
    name: t.label,
    value: summary[t.id]?.totalCostInr || 0,
    agent: t.id,
  })).filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-gray-400">
        No usage recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.agent} fill={AGENT_COLOR[entry.agent]} />
          ))}
        </Pie>
        <RechartsTooltip
          formatter={(value) => formatInr(value)}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#4b5563" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ rows, color }) {
  const data = useMemo(() => buildDailyTrend(rows), [rows]);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-gray-400">
        No usage in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `₹${v}`}
        />
        <RechartsTooltip
          formatter={(value) => [formatInr(value), "Cost"]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="costInr"
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function UsageTable({ rows, loading, agent }) {
  if (loading) {
    return (
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3.5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        No {agent} activity in this range.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-2.5 font-medium">
              {agent === "insights"
                ? "Question"
                : agent === "campaign"
                  ? "Campaign"
                  : "Conversation"}
            </th>
            <th className="px-4 py-2.5 font-medium">Outcome</th>
            <th className="px-4 py-2.5 font-medium">Tokens</th>
            {agent !== "campaign" && (
              <th className="px-4 py-2.5 font-medium">Tools</th>
            )}
            <th className="px-4 py-2.5 text-right font-medium">Cost</th>
            <th className="px-4 py-2.5 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-fairway-50/30">
              <td className="max-w-xs truncate px-4 py-3 text-gray-900">
                {row.label}
              </td>
              <td className="px-4 py-3">
                <Badge variant={outcomeVariant(row.outcome)}>
                  {humanizeAction(row.outcome)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {formatTokens(row.inputTokens)} in /{" "}
                {formatTokens(row.outputTokens)} out
              </td>
              {agent !== "campaign" && (
                <td className="px-4 py-3 text-gray-500">{row.toolCallCount}</td>
              )}
              <td className="px-4 py-3 text-right text-gray-900">
                <span className="font-medium">{formatInr(row.costInr)}</span>
                <span className="ml-1 text-xs text-gray-400">
                  ({formatUsd(row.costUsd)})
                </span>
              </td>
              <td className="px-4 py-3 text-right text-xs text-gray-400">
                {formatDateTime(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffBreakdown({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        No Insights usage in this range.
      </div>
    );
  }

  const maxCost = Math.max(...rows.map((r) => r.totalCostInr), 0.0001);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-medium text-gray-700">By staff member</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Who's using Insights, and what it's costing per person
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.staffUserId || r.name} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {r.name}
                </p>
                {r.email && (
                  <p className="truncate text-xs text-gray-400">{r.email}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {formatInr(r.totalCostInr)}
                </p>
                <p className="text-xs text-gray-400">
                  {r.interactions} {r.interactions === 1 ? "query" : "queries"}
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#3b6ea5]"
                style={{
                  width: `${Math.max(4, (r.totalCostInr / maxCost) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RANGE_OPTIONS = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

function rangeToFrom(rangeId) {
  const opt = RANGE_OPTIONS.find((r) => r.id === rangeId);
  if (!opt || !opt.days) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - opt.days);
  return d.toISOString();
}

export default function AgentUsage() {
  useDocumentTitle("Agent Usage");

  const [activeAgent, setActiveAgent] = useState("sales");
  const [range, setRange] = useState("30d");

  const [page, setPage] = useState(1);

  const selectAgent = (id) => {
    setActiveAgent(id);
    setPage(1);
  };
  const selectRange = (id) => {
    setRange(id);
    setPage(1);
  };

  const from = useMemo(() => rangeToFrom(range), [range]);

  // Results are stored with the key of the request that produced them, so
  // "loading" is derived (result key !== current key) instead of being set
  // synchronously inside the effect.
  const [summaryResult, setSummaryResult] = useState(null);
  const [agentResult, setAgentResult] = useState(null);

  const summaryKey = from || "all";
  const agentKey = `${activeAgent}|${from || "all"}|${page}`;

  // Summary cards + pie chart cover every agent, independent of which tab
  // is active.
  useEffect(() => {
    let cancelled = false;
    fetchAgentUsageSummary(from ? { from } : {})
      .then((res) => {
        if (!cancelled)
          setSummaryResult({ key: summaryKey, data: res.data, error: false });
      })
      .catch(() => {
        if (!cancelled)
          setSummaryResult({ key: summaryKey, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [from, summaryKey]);

  // Active tab's rows + its own summary (for the stat cards + trend chart
  // + table).
  useEffect(() => {
    let cancelled = false;
    fetchAgentUsage(activeAgent, { ...(from ? { from } : {}), page, limit: 25 })
      .then((res) => {
        if (!cancelled)
          setAgentResult({ key: agentKey, data: res.data, error: false });
      })
      .catch(() => {
        if (!cancelled)
          setAgentResult({ key: agentKey, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [activeAgent, from, page, agentKey]);

  const summaryCurrent =
    summaryResult?.key === summaryKey ? summaryResult : null;
  const summary = summaryCurrent?.data ?? null;
  const summaryError = summaryCurrent?.error ?? false;

  const agentCurrent = agentResult?.key === agentKey ? agentResult : null;
  const agentData = agentCurrent?.data ?? null;
  const agentError = agentCurrent?.error ?? false;
  const agentLoading = !agentCurrent;

  const activeTab = AGENT_TABS.find((t) => t.id === activeAgent);
  const activeColor = activeTab?.color || "#3d8562";

  const totalCostInr = summary
    ? AGENT_TABS.reduce((sum, t) => sum + (summary[t.id]?.totalCostInr || 0), 0)
    : null;
  const totalInteractions = summary
    ? AGENT_TABS.reduce(
        (sum, t) => sum + (summary[t.id]?.totalInteractions || 0),
        0,
      )
    : null;

  return (
    <div>
      <PageHeader
        title="Agent Usage"
        subtitle="Cost and activity for the Sales, Supplier, Insights and Campaign agents."
        actions={
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => selectRange(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === opt.id
                    ? "bg-fairway-900 text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Overview: totals across all three agents */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total cost"
          value={totalCostInr !== null ? formatInr(totalCostInr) : undefined}
          loading={totalCostInr === null && !summaryError}
          hint={summaryError ? "Couldn't load" : "All agents combined"}
        />
        <StatCard
          label="Total interactions"
          value={
            totalInteractions !== null
              ? totalInteractions.toLocaleString()
              : undefined
          }
          loading={totalInteractions === null && !summaryError}
        />
        {AGENT_TABS.map((t) => (
          <StatCard
            key={t.id}
            label={t.label}
            value={
              summary ? formatInr(summary[t.id]?.totalCostInr || 0) : undefined
            }
            loading={!summary && !summaryError}
            icon={<t.icon />}
            hint={
              summary
                ? `${summary[t.id]?.totalInteractions || 0} interactions`
                : undefined
            }
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
          <h2 className="text-sm font-medium text-gray-700">Cost split</h2>
          <p className="mt-0.5 text-xs text-gray-400">By agent, this range</p>
          <div className="mt-2">
            {summary ? (
              <CostSplitChart summary={summary} />
            ) : (
              <div className="flex h-56 items-center justify-center">
                <div className="h-32 w-32 animate-pulse rounded-full bg-gray-100" />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-700">
            {activeTab?.label} — daily cost
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Based on usage loaded on this page (up to 25 most recent rows)
          </p>
          <div className="mt-2">
            {agentLoading ? (
              <div className="flex h-56 items-center justify-center">
                <div className="h-40 w-full animate-pulse rounded bg-gray-100" />
              </div>
            ) : (
              <TrendChart rows={agentData?.data || []} color={activeColor} />
            )}
          </div>
        </div>
      </div>

      {/* Agent tabs */}
      <div className="mt-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {AGENT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectAgent(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
                activeAgent === t.id
                  ? "border-fairway-700 text-fairway-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        className={`mt-4 grid grid-cols-2 gap-4 ${
          activeAgent === "campaign" ? "sm:grid-cols-3" : "sm:grid-cols-4"
        }`}
      >
        <StatCard
          label="Interactions"
          value={agentData?.summary?.totalInteractions?.toLocaleString()}
          loading={agentLoading}
        />
        <StatCard
          label="Avg cost"
          value={
            agentData ? formatInr(agentData.summary.avgCostInr) : undefined
          }
          loading={agentLoading}
        />
        <StatCard
          label="Tokens in / out"
          value={
            agentData
              ? `${formatTokens(agentData.summary.totalInputTokens)} / ${formatTokens(agentData.summary.totalOutputTokens)}`
              : undefined
          }
          loading={agentLoading}
        />
        {activeAgent !== "campaign" && (
          <StatCard
            label="Tool calls"
            value={agentData?.summary?.totalToolCalls?.toLocaleString()}
            loading={agentLoading}
          />
        )}
      </div>

      {activeAgent === "campaign" && (
        <p className="mt-3 text-xs text-gray-400">
          Campaign cost covers the AI drafting of each template only. WhatsApp /
          Meta per-message send fees aren't tracked here.
        </p>
      )}

      {activeAgent === "insights" && (
        <div className="mt-4">
          {agentLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
              <div className="mt-3 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded bg-gray-50"
                  />
                ))}
              </div>
            </div>
          ) : (
            <StaffBreakdown rows={agentData?.staffBreakdown} />
          )}
        </div>
      )}

      <div className="mt-4">
        {agentError ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            Couldn't load {activeTab?.label} usage.
          </div>
        ) : (
          <UsageTable
            rows={agentData?.data || []}
            loading={agentLoading}
            agent={activeAgent}
          />
        )}
      </div>

      {agentData && agentData.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {agentData.page} of {agentData.totalPages}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(agentData.totalPages, p + 1))
            }
            disabled={page >= agentData.totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
