// src/components/ui/StatCard.jsx
export default function StatCard({ label, value, icon, hint, loading }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        {icon && <span className="text-fairway-600">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
        {loading ? (
          <span className="inline-block h-7 w-14 animate-pulse rounded bg-gray-100" />
        ) : (
          value
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
