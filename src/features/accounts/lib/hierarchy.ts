import type { Account } from "../types";

export function childrenOf(accounts: Account[], id: string): Account[] {
  return accounts.filter((a) => a.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
}

export function ancestors(accounts: Account[], id: string): Account[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: Account[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parentId;
  while (cur && !seen.has(cur)) {
    const a = byId.get(cur);
    if (!a) break;
    out.push(a);
    seen.add(cur);
    cur = a.parentId;
  }
  return out;
}

export function descendantIds(accounts: Account[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const a of accounts) if (a.parentId === cur && !out.has(a.id)) {
      out.add(a.id);
      stack.push(a.id);
    }
  }
  return out;
}

/** Setting `parentId` as the parent of `id` would loop back on itself. */
export function wouldCreateCycle(accounts: Account[], id: string, parentId: string | null): boolean {
  if (!parentId) return false;
  if (parentId === id) return true;
  return descendantIds(accounts, id).has(parentId);
}

export type StructureRole = "head_office" | "branch" | "standalone";

export function structureRole(accounts: Account[], a: Account): StructureRole {
  if (a.parentId) return "branch";
  return accounts.some((x) => x.parentId === a.id) ? "head_office" : "standalone";
}

export const STRUCTURE_LABELS: Record<StructureRole, string> = {
  head_office: "Head office",
  branch: "Branch",
  standalone: "Independent",
};
