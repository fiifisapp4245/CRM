/** Deals mock service. FUTURE INTEGRATION POINT. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser } from "@/features/permissions";
import type { DuplicateMode, FieldChange, ImportJob } from "@/features/contacts/types";
import { errorReportCsvRows } from "@/lib/import";
import { toCsv } from "@/lib/utils/csv";
import { applyDealImportPlan, type DealImportPlan } from "../lib/deal-import";
import { dealValue, formatAmount, stageOf } from "../lib/calc";
import type { DealFormValues } from "../schemas/deal-form";
import type { Deal } from "../types";
import { auditEvent } from "./helpers";

function fromForm(v: DealFormValues) {
  return {
    title: v.title.trim(),
    pipelineId: v.pipelineId,
    stageId: v.stageId,
    contactId: v.contactId || null,
    accountId: v.accountId || null,
    expectedClose: v.expectedClose,
    probability: v.probability === "" ? undefined : Number(v.probability),
    ownerId: v.ownerId || null,
    valuation: v.valuation,
    currency: v.currency,
    amount: v.valuation === "manual" ? Number(v.amount.replace(/,/g, "")) : 0,
    lineItems: v.valuation === "products" ? v.lineItems.map((l) => ({ ...l, productId: l.productId || null })) : [],
    notes: v.notes || undefined,
  } satisfies Partial<Deal>;
}

function validateRefs(data: ReturnType<typeof fromForm>, orgId: string): string | null {
  const db = getDb();
  const pipe = db.pipelines.find((p) => p.id === data.pipelineId && p.orgId === orgId);
  const stage = pipe?.stages.find((s) => s.id === data.stageId);
  if (!stage) return "Choose a stage.";
  if (stage.kind !== "open") return "Use Mark won or Mark lost to close a deal, so the outcome is recorded.";
  if (data.contactId && !db.contacts.some((c) => c.id === data.contactId && c.orgId === orgId && c.status !== "merged")) return "That contact isn't available.";
  if (data.accountId && !db.accounts.some((a) => a.id === data.accountId && a.orgId === orgId)) return "That account isn't available.";
  if (data.ownerId && !eligibleOwners(db.users, orgId).some((u) => u.id === data.ownerId)) return "Choose an active owner.";
  if (data.lineItems.some((l) => l.productId && db.products.find((p) => p.id === l.productId)?.currency !== data.currency)) return "Every product must be in the deal's currency.";
  return null;
}

export async function createDeal(values: DealFormValues): Promise<Result<Deal>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "deals.manage")) return forbidden("Your role can't create deals.");
  const data = fromForm(values);
  const err = validateRefs(data, actor.orgId);
  if (err) return invalid(err);
  const db = getDb();
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign deals to that person.");
  const now = nowIso();
  const deal: Deal = { ...data, id: newId("dl"), orgId: actor.orgId, status: "open", stageChangedAt: now, createdAt: now, createdBy: actor.id, updatedAt: now };
  commitDb({ ...db, deals: [deal, ...db.deals], audit: [...db.audit, auditEvent(actor.orgId, "deal", deal.id, "created", actor.id, deal.title)] });
  return ok(deal);
}

function loadWritable(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  const deal = db.deals.find((d) => d.id === id && d.orgId === actor.orgId);
  if (!deal) return { error: notFound() };
  if (!hasPermission(actor, "deals.manage") || !canWriteRecord(actor, deal, db.users)) return { error: forbidden("You can't change this deal.") };
  return { actor, db, deal };
}

export async function updateDeal(id: string, values: DealFormValues): Promise<Result<Deal>> {
  await latency();
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, deal } = r;
  const data = fromForm(values);
  // Closed deals keep their won/lost stage; edits change details only.
  if (deal.status !== "open") data.stageId = deal.stageId;
  const err = deal.status === "open" ? validateRefs(data, actor.orgId) : null;
  if (err) return invalid(err);
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign deals to that person.");
  const now = nowIso();
  const changes: FieldChange[] = [];
  const name = (uid: string | null) => db.users.find((u) => u.id === uid)?.name ?? "Unassigned";
  if (deal.title !== data.title) changes.push({ field: "Title", from: deal.title, to: data.title });
  if (deal.stageId !== data.stageId) changes.push({ field: "Stage", from: stageOf(db.pipelines, deal)?.name ?? "", to: stageOf(db.pipelines, data)?.name ?? "" });
  if (deal.ownerId !== data.ownerId) changes.push({ field: "Owner", from: name(deal.ownerId), to: name(data.ownerId) });
  if (deal.expectedClose !== data.expectedClose) changes.push({ field: "Expected close", from: deal.expectedClose, to: data.expectedClose });
  const before = formatAmount(dealValue(deal, db.taxes), deal.currency);
  const after = formatAmount(dealValue(data, db.taxes), data.currency);
  if (before !== after) changes.push({ field: "Value", from: before, to: after });
  if ((deal.probability ?? "") !== (data.probability ?? "")) changes.push({ field: "Chance of winning", from: deal.probability !== undefined ? `${deal.probability}%` : "Stage default", to: data.probability !== undefined ? `${data.probability}%` : "Stage default" });
  const next: Deal = { ...deal, ...data, stageChangedAt: deal.stageId !== data.stageId ? now : deal.stageChangedAt, updatedAt: now };
  commitDb({ ...db, deals: db.deals.map((d) => (d.id === id ? next : d)), audit: changes.length ? [...db.audit, auditEvent(actor.orgId, "deal", id, "updated", actor.id, deal.title, changes)] : db.audit });
  return ok(next);
}

export async function moveDealStage(id: string, stageId: string): Promise<Result<Deal>> {
  await latency(100);
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, deal } = r;
  if (deal.status !== "open") return invalid("Reopen the deal before moving it.");
  const pipe = db.pipelines.find((p) => p.id === deal.pipelineId);
  const to = pipe?.stages.find((s) => s.id === stageId);
  if (!to) return invalid("That stage doesn't exist in this pipeline.");
  if (to.kind !== "open") return invalid("Use Mark won or Mark lost so the outcome is recorded.");
  if (deal.stageId === stageId) return ok(deal);
  const now = nowIso();
  const from = stageOf(db.pipelines, deal)?.name ?? "";
  const next: Deal = { ...deal, stageId, probability: undefined, stageChangedAt: now, updatedAt: now };
  commitDb({ ...db, deals: db.deals.map((d) => (d.id === id ? next : d)), audit: [...db.audit, auditEvent(actor.orgId, "deal", id, "stage_changed", actor.id, deal.title, [{ field: "Stage", from, to: to.name }])] });
  return ok(next);
}

export interface CloseInput {
  outcome: "won" | "lost";
  closedOn: string; // YYYY-MM-DD
  finalValue?: number; // won, manual deals only
  reason: string;
  note?: string;
}

export async function closeDeal(id: string, input: CloseInput): Promise<Result<Deal>> {
  await latency();
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, deal } = r;
  if (deal.status !== "open") return invalid("This deal is already closed.");
  if (!input.closedOn) return invalid("Choose the closing date.");
  if (input.closedOn > new Date().toISOString().slice(0, 10)) return invalid("The closing date can't be in the future.");
  if (input.outcome === "lost" && !input.reason) return invalid("Choose why the deal was lost.");
  const pipe = db.pipelines.find((p) => p.id === deal.pipelineId);
  const stage = pipe?.stages.find((s) => s.kind === input.outcome);
  if (!stage) return invalid("This pipeline has no closing stage.");
  const now = nowIso();
  const closedAt = new Date(`${input.closedOn}T12:00:00`).toISOString();
  const changes: FieldChange[] = [{ field: "Stage", from: stageOf(db.pipelines, deal)?.name ?? "", to: stage.name }];
  const next: Deal = { ...deal, status: input.outcome, stageId: stage.id, closedAt, stageChangedAt: now, updatedAt: now, closeNote: input.note?.trim() || undefined };
  if (input.outcome === "won") {
    next.wonReason = input.reason || undefined;
    if (deal.valuation === "manual" && input.finalValue !== undefined && input.finalValue !== deal.amount) {
      changes.push({ field: "Value", from: formatAmount(deal.amount, deal.currency), to: formatAmount(input.finalValue, deal.currency) });
      next.amount = input.finalValue;
    }
  } else next.lostReason = input.reason;
  changes.push({ field: input.outcome === "won" ? "Won reason" : "Lost reason", from: "", to: input.reason || "Not given" });
  commitDb({ ...db, deals: db.deals.map((d) => (d.id === id ? next : d)), audit: [...db.audit, auditEvent(actor.orgId, "deal", id, input.outcome, actor.id, deal.title, changes)] });
  return ok(next);
}

export async function reopenDeal(id: string): Promise<Result<Deal>> {
  await latency();
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, deal } = r;
  if (deal.status === "open") return ok(deal);
  const stage = db.pipelines.find((p) => p.id === deal.pipelineId)?.stages.filter((s) => s.kind === "open").at(-1);
  if (!stage) return invalid("No open stage to return to.");
  const now = nowIso();
  const next: Deal = { ...deal, status: "open", stageId: stage.id, closedAt: undefined, wonReason: undefined, lostReason: undefined, closeNote: undefined, stageChangedAt: now, updatedAt: now };
  commitDb({ ...db, deals: db.deals.map((d) => (d.id === id ? next : d)), audit: [...db.audit, auditEvent(actor.orgId, "deal", id, "reopened", actor.id, deal.title, [{ field: "Stage", from: deal.status === "won" ? "Won" : "Lost", to: stage.name }])] });
  return ok(next);
}

export { newId };

/** Applies a reviewed deal-import plan. Related contacts/companies are created only if the plan allowed it. */
export async function runDealImport(plan: DealImportPlan, file: { name: string; size: number }, mode: DuplicateMode): Promise<Result<ImportJob>> {
  await latency(600);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "deals.import")) return forbidden("Your role can't import deals.");
  const now = nowIso();
  const applied = applyDealImportPlan(getDb(), actor, plan, now, newId, (entityType, id, action, summary) => auditEvent(actor.orgId, entityType, id, action, actor.id, summary));
  const report = errorReportCsvRows(plan);
  const job: ImportJob = {
    id: newId("imp"), entityType: "deal", orgId: actor.orgId, fileName: file.name, fileSize: file.size, startedAt: now, actorId: actor.id, duplicateMode: mode, totalRows: plan.rows.length,
    created: applied.created, updated: applied.updated, skipped: plan.counts.skip, failed: plan.counts.error,
    relatedCreated: { contacts: applied.contactsCreated, accounts: applied.accountsCreated },
    errorReportCsv: report.rows.length ? toCsv(report.headers, report.rows) : undefined,
  };
  commitDb({ ...applied.db, importJobs: [job, ...applied.db.importJobs] });
  return ok(job);
}
