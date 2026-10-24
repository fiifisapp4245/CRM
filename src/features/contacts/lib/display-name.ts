export function buildDisplayName(parts: { title?: string; firstName?: string; middleName?: string; lastName?: string }): string {
  return [parts.firstName, parts.lastName].map((p) => p?.trim()).filter(Boolean).join(" ");
}
