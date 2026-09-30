// src/lib/audit.js
// beforeState/afterState may arrive as objects or as JSON strings.
export function parseState(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function actionVariant(action = "") {
  if (/failed|error|deleted|removed/.test(action)) return "danger";
  if (/escalat/.test(action)) return "warning";
  if (/created|approved|confirmed/.test(action)) return "positive";
  return "neutral";
}
