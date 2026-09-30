// src/components/ui/EmptyState.jsx
export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-14 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
