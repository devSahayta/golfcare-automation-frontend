// src/hooks/useDocumentTitle.js
import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Golf Care OS` : "Golf Care OS";
    return () => {
      document.title = previous;
    };
  }, [title]);
}
