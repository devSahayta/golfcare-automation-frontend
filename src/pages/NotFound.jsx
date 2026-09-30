// src/pages/NotFound.jsx
import { Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page not found");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-20 text-center">
      <p className="text-2xl font-semibold text-gray-300">404</p>
      <p className="mt-2 text-sm font-medium text-gray-700">Page not found</p>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        That page doesn't exist, or you followed a broken link.
      </p>
      <Link
        to="/"
        className="mt-4 rounded-lg bg-fairway-700 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
