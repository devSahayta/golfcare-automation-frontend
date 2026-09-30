// src/components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-700">
            Something went wrong loading this page
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-400">
            Try reloading. If it keeps happening, let us know what you were
            doing.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-fairway-700 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
