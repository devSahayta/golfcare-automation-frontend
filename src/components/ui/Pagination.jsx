// src/components/ui/Pagination.jsx
export default function Pagination({ total, limit, offset, onPageChange }) {
  if (!total || total <= limit) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const rangeStart = offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  // Scrolling happens here, once, rather than in every page that uses
  // this component — without it, clicking Next while scrolled down a
  // long list leaves you scrolled to the same spot on the new page,
  // which looks like nothing happened.
  function goToPage(newOffset) {
    onPageChange(newOffset);
    document
      .getElementById("dashboard-main")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
      <span>
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => goToPage(Math.max(0, offset - limit))}
          disabled={currentPage === 1}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => goToPage(offset + limit)}
          disabled={currentPage === totalPages}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
