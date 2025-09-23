/**
 * Serializes an object into a readable, token-efficient format for LLM consumption.
 * Removes unnecessary JSON syntax while preserving structure and readability.
 */
export function serializeForLLM(value: unknown, indent = 0): string {
  const spaces = "  ".repeat(indent);

  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.length === 1) return serializeForLLM(value[0], indent);

    return value
      .map((item) => `${spaces}- ${serializeForLLM(item, indent + 1)}`)
      .join("\n");
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(
      ([, val]) => val !== undefined
    );
    if (entries.length === 0) return "";

    return entries
      .map(([key, val]) => {
        const serializedValue = serializeForLLM(val, indent + 1);
        if (serializedValue.includes("\n")) {
          return `${spaces}${key}:\n${serializedValue}`;
        }
        return `${spaces}${key}: ${serializedValue}`;
      })
      .join("\n");
  }

  return String(value);
}
