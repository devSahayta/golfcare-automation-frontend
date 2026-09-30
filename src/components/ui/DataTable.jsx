// src/components/ui/DataTable.jsx
//
// columns: [{ key, header, render?(row) }]
// A plain <table> on md+ screens; below that, each row becomes a small
// label/value card — a real table just doesn't work on a phone width.

import EmptyState from "./EmptyState";

export default function DataTable({
  columns,
  rows,
  keyField = "id",
  onRowClick,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription = "",
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={row[keyField]}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-xl border border-gray-200 bg-white p-4 ${onRowClick ? "cursor-pointer active:bg-gray-50" : ""}`}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center justify-between py-1 text-sm first:pt-0 last:pb-0"
              >
                <span className="text-xs text-gray-400">{col.header}</span>
                <span className="text-gray-800">
                  {col.render ? col.render(row) : row[col.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
