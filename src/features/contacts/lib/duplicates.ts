import { formatPhone, normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import type { Contact } from "../types";

export interface DuplicateGroup {
  key: string;
  contactIds: string[];
  /** Human-readable reasons, e.g. "Same email: a@b.example". */
  reasons: string[];
}

export function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

/**
 * Groups active contacts within the SAME organisation that share a
 * normalised e-mail address or phone/WhatsApp number. Uses union–find so
 * A~B and B~C produce one group. Pairs the user dismissed are ignored.
 */
export function findDuplicateGroups(contacts: Contact[], dismissedPairs: string[] = []): DuplicateGroup[] {
  const dismissed = new Set(dismissedPairs);
  const candidates = contacts.filter((c) => c.status === "active");
  const parent = new Map<string, string>(candidates.map((c) => [c.id, c.id]));
  const find = (x: string): string => {
    const p = parent.get(x)!;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const reasonsByPair = new Map<string, Set<string>>();

  const index = new Map<string, string[]>(); // orgId::kind::value -> contactIds
  for (const c of candidates) {
    const seen = new Set<string>();
    for (const m of c.methods) {
      const v = m.kind === "email" ? normalizeEmail(m.value) : normalizePhone(m.value);
      if (!v) continue;
      const k = `${c.orgId}::${m.kind === "email" ? "email" : "phone"}::${v}`;
      if (seen.has(k)) continue;
      seen.add(k);
      index.set(k, [...(index.get(k) ?? []), c.id]);
    }
  }

  for (const [k, ids] of index) {
    if (ids.length < 2) continue;
    const [, kind, value] = k.split("::");
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pk = pairKey(ids[i], ids[j]);
        if (dismissed.has(pk)) continue;
        parent.set(find(ids[i]), find(ids[j]));
        const set = reasonsByPair.get(pk) ?? new Set<string>();
        set.add(kind === "email" ? `Same email: ${value}` : `Same phone number: ${formatPhone(value)}`);
        reasonsByPair.set(pk, set);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const c of candidates) {
    const root = find(c.id);
    groups.set(root, [...(groups.get(root) ?? []), c.id]);
  }

  const result: DuplicateGroup[] = [];
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const reasons = new Set<string>();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) reasonsByPair.get(pairKey(ids[i], ids[j]))?.forEach((r) => reasons.add(r));
    if (reasons.size === 0) continue;
    result.push({ key: [...ids].sort().join("+"), contactIds: ids, reasons: [...reasons] });
  }
  return result;
}
