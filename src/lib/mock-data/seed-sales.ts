import { createRandom } from "@/lib/utils/random";
import type { Account } from "@/features/accounts/types";
import type { Activity } from "@/features/activities/types";
import type { AuditEvent, Contact } from "@/features/contacts/types";
import { LOST_REASONS, WON_REASONS, type Deal, type Lead, type LeadEvent, type LeadSource, type LeadStatus, type LineItem, type Pipeline, type Product, type Quote, type QuoteEvent, type SalesTarget, type Tax } from "@/features/sales/types";
import { PRIMARY_ORG_ID } from "./users";

/**
 * Fictional, relationally consistent sales data: every deal points at a real
 * seeded contact/account, every quote at a real deal, and the forecast is
 * computed from these records (no chart fixtures).
 */
const ORG = PRIMARY_ORG_ID;
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const DEFAULT_PIPELINE_ID = "pl_main";

export function buildPipelines(): Pipeline[] {
  return [
    {
      id: DEFAULT_PIPELINE_ID,
      orgId: ORG,
      name: "Sales pipeline",
      stages: [
        { id: "st_new", name: "New", probability: 10, kind: "open" },
        { id: "st_qualified", name: "Qualified", probability: 25, kind: "open" },
        { id: "st_proposal", name: "Proposal sent", probability: 50, kind: "open" },
        { id: "st_negotiation", name: "Negotiation", probability: 75, kind: "open" },
        { id: "st_won", name: "Won", probability: 100, kind: "won" },
        { id: "st_lost", name: "Lost", probability: 0, kind: "lost" },
      ],
    },
  ];
}

/** Mirrors the reference environment's configured taxes. NOT a statement of current Ghana tax law. */
export function buildTaxes(): Tax[] {
  return [
    { id: "tax_vat", name: "VAT", rate: 2 },
    { id: "tax_covid", name: "COVID levy", rate: 4 },
  ];
}

interface Ctx {
  now: number;
  iso: (offsetMs: number) => string;
  contacts: Contact[];
  accounts: Account[];
  nextId: (p: string) => string;
}

export interface SalesSeed {
  pipelines: Pipeline[];
  taxes: Tax[];
  products: Product[];
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  targets: SalesTarget[];
  activities: Activity[];
  audit: AuditEvent[];
}

export function buildSalesSeed({ now, iso, contacts, accounts, nextId }: Ctx): SalesSeed {
  const rand = createRandom(4242);
  const day = (offsetDays: number) => iso(offsetDays * DAY).slice(0, 10);
  const audit: AuditEvent[] = [];
  const activities: Activity[] = [];
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const activeOwner = (id: string | null | undefined) => (id && id !== "u_naa" ? id : "u_ama");

  /* ---------------- Products ---------------- */
  const P = (id: string, name: string, price: number, opts: Partial<Product> = {}): Product => ({
    id,
    orgId: ORG,
    name,
    price,
    currency: "GHS",
    taxId: "tax_vat",
    taxInclusive: false,
    soldPer: "each",
    active: true,
    origin: "crm",
    createdAt: iso(-300 * DAY),
    updatedAt: iso(-30 * DAY),
    ...opts,
  });
  const synced = { origin: "mystoreguard" as const, lastSyncedAt: iso(-1 * DAY - 3 * HOUR) };
  const products: Product[] = [
    P("prd_chair", "Ergonomic office chair", 1850, { sku: "CHR-ERG-01", category: "Seating", description: "Mesh back, adjustable lumbar support and armrests.", externalRef: "MSG-10231", ...synced }),
    P("prd_visitor", "Visitor chair", 650, { sku: "CHR-VIS-02", category: "Seating", description: "Stackable, chrome frame.", externalRef: "MSG-10232", ...synced }),
    P("prd_cabinet", "Filing cabinet, 4-drawer", 2300, { sku: "STO-FIL-04", category: "Storage", externalRef: "MSG-10410", ...synced }),
    P("prd_cable", "Cable management kit", 180, { sku: "ACC-CAB-01", category: "Accessories", soldPer: "set", externalRef: "MSG-10877", ...synced }),
    P("prd_desk", "Executive desk 160 cm", 4200, { sku: "DSK-EXE-160", category: "Desks", description: "Walnut finish, cable tray included." }),
    P("prd_standing", "Height-adjustable standing desk", 5600, { sku: "DSK-STD-01", category: "Desks", taxInclusive: true, description: "Dual motor. Price includes VAT." }),
    P("prd_table", "Meeting table, 8-seater", 9500, { sku: "TBL-MTG-08", category: "Tables" }),
    P("prd_sofa", "Reception sofa, 3-seater", 6800, { sku: "REC-SOF-03", category: "Reception" }),
    P("prd_partition", "Office partition panel", 1200, { sku: "FIT-PAR-01", category: "Fit-out", description: "1.2 m acoustic panel." }),
    P("prd_install", "Installation and assembly", 250, { sku: "SRV-INS-HR", category: "Services", soldPer: "hour", taxId: null }),
    P("prd_delivery", "Delivery within Greater Accra", 350, { sku: "SRV-DEL-ACC", category: "Services", soldPer: "trip", taxId: null }),
    P("prd_maint", "Annual maintenance plan", 3000, { sku: "SRV-MNT-YR", category: "Services", soldPer: "year", taxId: "tax_covid" }),
    P("prd_whiteboard", "Magnetic whiteboard 180 cm", 900, { sku: "ACC-WBD-180", category: "Accessories", active: false, description: "Discontinued by supplier." }),
    P("prd_conf_usd", "Boardroom conference system", 3200, { currency: "USD", sku: "AV-CONF-01", category: "Audio-visual", taxId: null, description: "Imported camera, speaker bar and controller." }),
    P("prd_support_usd", "Remote AV support plan", 600, { currency: "USD", sku: "AV-SUP-YR", category: "Audio-visual", soldPer: "year", taxId: null }),
  ];
  const prod = new Map(products.map((p) => [p.id, p]));
  const line = (productId: string, quantity: number, discountPct = 0): LineItem => {
    const p = prod.get(productId)!;
    return { id: nextId("li"), productId, name: p.name, description: p.description, quantity, unitPrice: p.price, discountPct, taxId: p.taxId, taxInclusive: p.taxInclusive };
  };

  /* ---------------- Deals ---------------- */
  const deals: Deal[] = [];
  const firstContactAt = (accountId: string) => contacts.find((c) => c.accountId === accountId && c.status === "active");
  const mk = (d: Partial<Deal> & Pick<Deal, "id" | "title" | "stageId" | "expectedClose">, createdDaysAgo: number): Deal => {
    const contact = d.contactId ? contactById.get(d.contactId) : undefined;
    const createdAt = iso(-createdDaysAgo * DAY);
    const deal: Deal = {
      orgId: ORG,
      pipelineId: DEFAULT_PIPELINE_ID,
      contactId: null,
      accountId: contact?.accountId ?? null,
      ownerId: activeOwner(contact?.ownerId),
      currency: "GHS",
      valuation: "manual",
      amount: 0,
      lineItems: [],
      status: "open",
      stageChangedAt: createdAt,
      createdAt,
      createdBy: activeOwner(contact?.ownerId),
      updatedAt: createdAt,
      ...d,
    };
    deals.push(deal);
    return deal;
  };

  const akwaabaContact = firstContactAt("acc_akwaaba_travel");
  const brightContact = firstContactAt("acc_brightpath");
  const kintampoContact = firstContactAt("acc_kintampo_solar");

  mk({ id: "dl_coastal_branch", title: "Branch seating roll-out", contactId: "ct_abigail", accountId: "acc_coastal_pharm", ownerId: "u_kwame", stageId: "st_proposal", expectedClose: day(25), valuation: "products", lineItems: [line("prd_chair", 120, 5), line("prd_desk", 40, 5), line("prd_install", 80)], stageChangedAt: iso(-9 * DAY), lastActivityAt: iso(-4 * DAY), notes: "Needs final proposal by 15 Nov to make this year's budget.", leadId: "ld_abigail" }, 62);
  mk({ id: "dl_coastal_hq", title: "Head-office desks", contactId: "ct_abigail", accountId: "acc_coastal_pharm", ownerId: "u_kwame", stageId: "st_won", status: "won", amount: 64000, expectedClose: day(-72), closedAt: iso(-70 * DAY), wonReason: "Existing relationship", stageChangedAt: iso(-70 * DAY), lastActivityAt: iso(-70 * DAY) }, 130);
  mk({ id: "dl_harmattan_av", title: "Boardroom AV system", contactId: "ct_oliver", accountId: "acc_harmattan", ownerId: "u_efua", currency: "USD", stageId: "st_negotiation", valuation: "products", lineItems: [line("prd_conf_usd", 2), line("prd_support_usd", 2)], expectedClose: day(12), stageChangedAt: iso(-3 * DAY), lastActivityAt: iso(-3 * DAY) }, 40);
  if (akwaabaContact) mk({ id: "dl_akwaaba_showroom", title: "Showroom furniture", contactId: akwaabaContact.id, ownerId: "u_kojo", stageId: "st_qualified", amount: 48000, expectedClose: day(20), stageChangedAt: iso(-32 * DAY), lastActivityAt: iso(-30 * DAY) }, 45);
  mk({ id: "dl_tema_fitout", title: "Warehouse office fit-out", contactId: "ct_dup_emma_a", accountId: "acc_tema_hw", ownerId: "u_kwame", stageId: "st_negotiation", amount: 92000, expectedClose: day(-5), stageChangedAt: iso(-12 * DAY), lastActivityAt: iso(-6 * DAY) }, 75);
  mk({ id: "dl_osu_lost", title: "Bakery staff seating", contactId: "ct_dup_akosua_a", accountId: "acc_osu_bakery", ownerId: "u_kwame", stageId: "st_lost", status: "lost", amount: 22500, expectedClose: day(-18), closedAt: iso(-20 * DAY), lostReason: "Price too high", closeNote: "Went with a cheaper local carpenter.", stageChangedAt: iso(-20 * DAY) }, 50);
  if (brightContact) mk({ id: "dl_brightpath", title: "Classroom furniture – East Legon campus", contactId: brightContact.id, ownerId: "u_kojo", stageId: "st_new", valuation: "products", lineItems: [line("prd_visitor", 200, 10), line("prd_delivery", 6)], expectedClose: day(60), lastActivityAt: iso(-2 * DAY) }, 6);
  if (kintampoContact) mk({ id: "dl_kintampo", title: "Solar office set-up", contactId: kintampoContact.id, ownerId: "u_ama", stageId: "st_proposal", amount: 35000, expectedClose: day(40), stageChangedAt: iso(-2 * DAY), lastActivityAt: iso(-1 * DAY) }, 18);

  // Recent wins so the current period has outcomes to show.
  mk({ id: "dl_harmattan_support", title: "Remote AV support renewal", contactId: "ct_oliver", accountId: "acc_harmattan", ownerId: "u_efua", currency: "USD", stageId: "st_won", status: "won", amount: 1200, expectedClose: day(-8), closedAt: iso(-9 * DAY), wonReason: "Existing relationship", stageChangedAt: iso(-9 * DAY), lastActivityAt: iso(-9 * DAY) }, 30);
  if (kintampoContact) mk({ id: "dl_kintampo_chairs", title: "Site office chairs", contactId: kintampoContact.id, ownerId: "u_ama", stageId: "st_won", status: "won", amount: 18500, expectedClose: day(-4), closedAt: iso(-5 * DAY), wonReason: "Fast delivery", stageChangedAt: iso(-5 * DAY), lastActivityAt: iso(-5 * DAY) }, 21);
  if (akwaabaContact) mk({ id: "dl_akwaaba_counter", title: "Front-desk counter", contactId: akwaabaContact.id, ownerId: "u_kojo", stageId: "st_won", status: "won", amount: 27000, expectedClose: day(-10), closedAt: iso(-12 * DAY), wonReason: "Best price", stageChangedAt: iso(-12 * DAY), lastActivityAt: iso(-12 * DAY) }, 40);

  const used = new Set(deals.map((d) => d.contactId));
  const titles = ["Office refurbishment", "Annual supply contract", "Staff seating upgrade", "Conference room fit-out", "Reception area makeover", "New branch furnishing", "Storage and filing upgrade"];
  const openStages = ["st_new", "st_qualified", "st_proposal", "st_negotiation"];
  for (const c of contacts) {
    if (!c.accountId || c.status !== "active" || used.has(c.id) || !rand.chance(0.33)) continue;
    const roll = rand.next();
    const amount = rand.int(16, 480) * 500;
    const title = rand.pick(titles);
    if (roll < 0.55) {
      const created = rand.int(4, 120);
      const touched = rand.int(0, Math.min(created, 40));
      mk({ id: nextId("dl"), title, contactId: c.id, stageId: rand.pick(openStages), amount, expectedClose: day(rand.int(-10, 160)), stageChangedAt: iso(-touched * DAY), lastActivityAt: iso(-rand.int(0, touched) * DAY) }, created);
    } else {
      const won = roll < 0.83;
      const closedDaysAgo = rand.int(3, 175);
      mk(
        {
          id: nextId("dl"),
          title,
          contactId: c.id,
          stageId: won ? "st_won" : "st_lost",
          status: won ? "won" : "lost",
          amount,
          expectedClose: day(-closedDaysAgo + rand.int(-5, 5)),
          closedAt: iso(-closedDaysAgo * DAY),
          wonReason: won ? rand.pick(WON_REASONS.slice(0, 4)) : undefined,
          lostReason: won ? undefined : rand.pick(LOST_REASONS.slice(0, 5)),
          stageChangedAt: iso(-closedDaysAgo * DAY),
        },
        closedDaysAgo + rand.int(15, 80),
      );
    }
  }
  for (const d of deals) d.updatedAt = [d.stageChangedAt, d.lastActivityAt, d.closedAt].filter(Boolean).sort().at(-1) ?? d.createdAt;

  // Deal-linked activities and history.
  const dealAct = (dealId: string, type: Activity["type"], subject: string, daysAgo: number, body?: string) => {
    const d = deals.find((x) => x.id === dealId);
    if (!d?.contactId) return;
    activities.push({ id: nextId("ac"), orgId: ORG, contactId: d.contactId, dealId, type, subject, body, occurredAt: iso(-daysAgo * DAY), callOutcome: type === "call" ? "connected" : undefined, direction: type === "call" ? "outbound" : undefined, assigneeId: d.ownerId, createdBy: d.ownerId ?? "u_ama", createdAt: iso(-daysAgo * DAY) });
  };
  dealAct("dl_coastal_branch", "meeting", "Walked procurement through the proposal", 9, "Asked for 5% volume discount on chairs and desks — applied.");
  dealAct("dl_coastal_branch", "call", "Confirmed delivery windows per branch", 4);
  dealAct("dl_harmattan_av", "email", "Sent revised AV specification", 3);
  dealAct("dl_akwaaba_showroom", "call", "Discovery call about showroom layout", 30);
  dealAct("dl_tema_fitout", "note", "Waiting for their board to approve the budget", 6);
  dealAct("dl_kintampo", "call", "Agreed scope for the solar office", 1);

  const stageName: Record<string, string> = { st_new: "New", st_qualified: "Qualified", st_proposal: "Proposal sent", st_negotiation: "Negotiation", st_won: "Won", st_lost: "Lost" };
  for (const d of deals) {
    audit.push({ id: nextId("au"), orgId: ORG, entityType: "deal", entityId: d.id, action: "created", actorId: d.createdBy, at: d.createdAt, summary: d.title });
    if (d.stageId !== "st_new" && d.status === "open")
      audit.push({ id: nextId("au"), orgId: ORG, entityType: "deal", entityId: d.id, action: "stage_changed", actorId: d.ownerId ?? "u_ama", at: d.stageChangedAt, summary: d.title, changes: [{ field: "Stage", from: stageName[openStages[Math.max(0, openStages.indexOf(d.stageId) - 1)]], to: stageName[d.stageId] }] });
    if (d.status === "won") audit.push({ id: nextId("au"), orgId: ORG, entityType: "deal", entityId: d.id, action: "won", actorId: d.ownerId ?? "u_ama", at: d.closedAt!, summary: d.title, changes: d.wonReason ? [{ field: "Won reason", from: "", to: d.wonReason }] : undefined });
    if (d.status === "lost") audit.push({ id: nextId("au"), orgId: ORG, entityType: "deal", entityId: d.id, action: "lost", actorId: d.ownerId ?? "u_ama", at: d.closedAt!, summary: d.title, changes: [{ field: "Lost reason", from: "", to: d.lostReason ?? "" }] });
  }

  /* ---------------- Leads ---------------- */
  type LeadSeed = Partial<Lead> & { name: string; source: LeadSource; status: LeadStatus; ageDays: number };
  const L: LeadSeed[] = [
    { name: "Akua Sarpong", company: "Labadi Events", jobTitle: "Events Manager", email: "akua.sarpong@labadievents.example", phone: "024 555 3101", city: "Accra", need: "120 banquet chairs and 15 round tables for the new events hall", estimatedValue: 45000, source: "referral", sourceDetail: "Referred by Abigail Owusu-Ansah", rating: "hot", ownerId: "u_kwame", status: "qualified", ageDays: 9 },
    { name: "Kwesi Arthur", phone: "0554 555 010", city: "Cape Coast", need: "Two desks for a home office", estimatedValue: 9000, source: "whatsapp", rating: "warm", ownerId: "u_kwame", status: "contacted", ageDays: 5 },
    { name: "Abigail Owusu-Ansah", company: "Coastal Pharmacy Group", jobTitle: "Head of Procurement", email: "abigail.owusuansah@coastalpharmacy.example", phone: "+233 24 555 0101", city: "Accra", need: "Seating for three branches", estimatedValue: 180000, source: "event", sourceDetail: "Accra Office Expo 2026", rating: "hot", ownerId: "u_kwame", status: "converted", ageDays: 64 },
    { name: "Yaw Mensah-Bonsu", company: "Sahel Logistics", jobTitle: "Country Manager", email: "yaw.mb@sahellogistics.example", city: "Tema", need: "Imported conference room equipment, billed in USD", estimatedValue: 6000, currency: "USD", source: "website", rating: "warm", ownerId: "u_efua", status: "new", ageDays: 2 },
    { name: "Esi Nyarko", company: "Ridge Dental Clinic", jobTitle: "Practice Manager", phone: "030 255 3104", need: "Waiting-room sofas", estimatedValue: 14000, source: "walk_in", rating: "warm", ownerId: "u_selasi", status: "new", ageDays: 1 },
    { name: "Kojo Antwi", company: "Antwi & Sons Hardware", phone: "027 555 3105", city: "Kumasi", need: "Shelving for a new branch", estimatedValue: 22000, source: "phone_call", rating: "cold", ownerId: null, status: "new", ageDays: 3 },
    { name: "Selina Boateng", company: "Bright Path Schools", jobTitle: "Bursar", email: "selina.b@brightpath.example", need: "Staff room furniture", estimatedValue: 18000, source: "social_media", sourceDetail: "Facebook ad comment", rating: "warm", ownerId: "u_kojo", status: "contacted", ageDays: 12 },
    { name: "Daniel Ofori", phone: "020 555 3107", need: "Price list request", source: "advert", sourceDetail: "Radio advert, Joy FM", ownerId: "u_kojo", status: "new", ageDays: 7 },
    { name: "Gifty Appiah", company: "Nkwanta Agro Ltd", jobTitle: "Admin Officer", email: "gifty.appiah@nkwanta-agro.example", need: "Filing cabinets for records office", estimatedValue: 11500, source: "referral", rating: "warm", ownerId: "u_selasi", status: "qualified", ageDays: 16 },
    { name: "Michael Larbi", company: "Larbi Consult", email: "m.larbi@mail.example", need: "Single standing desk", estimatedValue: 5600, source: "website", rating: "cold", ownerId: "u_efua", status: "contacted", ageDays: 26 },
    { name: "Comfort Adjei", company: "Takoradi Marine Services", jobTitle: "Operations Lead", phone: "031 555 3111", need: "Office partitions for new floor", estimatedValue: 38000, source: "event", sourceDetail: "Western Region trade fair", rating: "hot", ownerId: "u_selasi", status: "qualified", ageDays: 11 },
    { name: "Student enquiry", email: "student.project@mail.example", need: "Information for a school assignment", source: "website", ownerId: "u_efua", status: "disqualified", disqualifyReason: "Not a buyer — school assignment", ageDays: 20 },
    { name: "Prince Owusu", company: "Owusu Pharmacy", phone: "024 555 3113", need: "Reception desk", estimatedValue: 7500, source: "walk_in", ownerId: null, status: "new", ageDays: 0 },
    { name: "Naana Hammond", company: "Hammond Interiors", email: "naana@hammondinteriors.example", need: "Trade pricing for interior projects", estimatedValue: 60000, source: "referral", rating: "hot", ownerId: "u_ama", status: "contacted", ageDays: 4 },
    { name: "Benjamin Quaye", phone: "059 555 3115", need: "Visitor chairs", estimatedValue: 3900, source: "whatsapp", ownerId: "u_kwame", status: "new", ageDays: 8 },
    { name: "Imported list contact", company: "Volta Agro Supplies", email: "info@voltaagro.example", source: "import", ownerId: null, status: "new", ageDays: 30 },
    { name: "Francis Badu", company: "Badu Printing", phone: "026 555 3117", need: "Wanted second-hand furniture only", source: "phone_call", ownerId: "u_kojo", status: "disqualified", disqualifyReason: "Only interested in second-hand items", ageDays: 34 },
    { name: "Afia Owusu", company: "Akwaaba Travel", email: "afia.owusu@akwaabatravel.example", need: "Branch counter chairs", estimatedValue: 8400, source: "other", sourceDetail: "Met at church fundraiser", rating: "warm", ownerId: "u_kojo", status: "new", ageDays: 13 },
  ];
  const leads: Lead[] = L.map((s, i) => {
    const id = s.name === "Abigail Owusu-Ansah" ? "ld_abigail" : `ld_${(i + 1).toString().padStart(3, "0")}`;
    const createdAt = iso(-s.ageDays * DAY - (i % 5) * HOUR);
    const owner = s.ownerId ?? "u_selasi";
    const events: LeadEvent[] = [{ id: nextId("le"), kind: "status", status: "new", at: createdAt, by: owner }];
    const steps: LeadStatus[] = s.status === "contacted" ? ["contacted"] : s.status === "qualified" ? ["contacted", "qualified"] : s.status === "converted" ? ["contacted", "qualified", "converted"] : s.status === "disqualified" ? ["contacted", "disqualified"] : [];
    steps.forEach((st, k) => events.push({ id: nextId("le"), kind: "status", status: st, at: iso(-s.ageDays * DAY + (k + 1) * Math.max(1, s.ageDays / (steps.length + 1)) * DAY * 0.8), by: owner, text: st === "disqualified" ? s.disqualifyReason : undefined }));
    if (s.status !== "new") events.splice(1, 0, { id: nextId("le"), kind: "call", at: iso(-s.ageDays * DAY + 3 * HOUR), by: owner, text: "Introductory call" });
    const lastInteractionAt = events.filter((e) => e.kind !== "status").map((e) => e.at).sort().at(-1);
    const { ageDays, ...rest } = s;
    void ageDays;
    return {
      id,
      orgId: ORG,
      currency: "GHS",
      ownerId: null,
      ...rest,
      events,
      lastInteractionAt,
      nextAction: s.status === "new" || s.status === "contacted" || s.status === "qualified" ? { label: s.status === "qualified" ? "Send proposal" : s.status === "contacted" ? "Follow-up call" : "First call", dueAt: iso((rand.int(-2, 6)) * DAY + 10 * HOUR) } : undefined,
      converted: s.status === "converted" ? { at: iso(-62 * DAY), by: "u_kwame", contactId: "ct_abigail", accountId: "acc_coastal_pharm", dealId: "dl_coastal_branch" } : undefined,
      createdAt,
      createdBy: owner,
      updatedAt: events.at(-1)!.at,
    } as Lead;
  });
  for (const l of leads) {
    audit.push({ id: nextId("au"), orgId: ORG, entityType: "lead", entityId: l.id, action: "created", actorId: l.createdBy, at: l.createdAt, summary: l.name });
    if (l.status === "converted") audit.push({ id: nextId("au"), orgId: ORG, entityType: "lead", entityId: l.id, action: "converted", actorId: "u_kwame", at: l.converted!.at, summary: l.name });
  }

  /* ---------------- Quotes ---------------- */
  const quotes: Quote[] = [];
  let qn = 100;
  const quote = (dealId: string, status: Quote["status"], o: { createdDaysAgo: number; validDays: number; sentDaysAgo?: number; openedDaysAgo?: number; decidedDaysAgo?: number; paidDaysAgo?: number; declineReason?: string }) => {
    const d = deals.find((x) => x.id === dealId);
    if (!d) return;
    const c = d.contactId ? contactById.get(d.contactId) : undefined;
    const acc = d.accountId ? accounts.find((a) => a.id === d.accountId) : undefined;
    const email = c?.methods.find((m) => m.kind === "email" && m.isPrimary)?.value ?? c?.methods.find((m) => m.kind === "email")?.value;
    const phone = c?.methods.find((m) => m.kind === "phone")?.value;
    const by = d.ownerId ?? "u_ama";
    const lines: LineItem[] = d.valuation === "products" ? d.lineItems.map((li) => ({ ...li, id: nextId("li") })) : [{ id: nextId("li"), productId: null, name: d.title, description: "As discussed.", quantity: 1, unitPrice: d.amount, discountPct: 0, taxId: null, taxInclusive: false }];
    const history: QuoteEvent[] = [{ kind: "created", at: iso(-o.createdDaysAgo * DAY), by }];
    if (o.sentDaysAgo !== undefined) history.push({ kind: "sent", at: iso(-o.sentDaysAgo * DAY), by, note: email ? `Shared with ${email}` : "Link shared" });
    if (o.openedDaysAgo !== undefined) history.push({ kind: "opened", at: iso(-o.openedDaysAgo * DAY), by: "customer" });
    if (status === "accepted" || status === "paid") history.push({ kind: "accepted", at: iso(-(o.decidedDaysAgo ?? 0) * DAY), by: "customer" });
    if (status === "declined") history.push({ kind: "declined", at: iso(-(o.decidedDaysAgo ?? 0) * DAY), by: "customer", note: o.declineReason });
    if (status === "expired") history.push({ kind: "expired", at: iso((-o.createdDaysAgo + o.validDays) * DAY), by: "system" });
    if (status === "paid") history.push({ kind: "paid", at: iso(-(o.paidDaysAgo ?? 0) * DAY), by: "customer", note: "Simulated payment PAY-PROTO-0042" });
    quotes.push({
      id: `qt_${++qn}`,
      orgId: ORG,
      number: `Q-2026-${String(qn).padStart(4, "0")}`,
      dealId,
      contactId: d.contactId,
      accountId: d.accountId,
      customer: { name: c?.displayName ?? acc?.name ?? "Customer", company: acc?.name, email, phone, address: [acc?.billingAddress?.line1, acc?.billingAddress?.city].filter(Boolean).join(", ") || undefined },
      currency: d.currency,
      issueDate: day(-o.createdDaysAgo),
      validUntil: day(-o.createdDaysAgo + o.validDays),
      lineItems: lines,
      notes: "Prices include delivery scheduling within Greater Accra. Installation billed per hour where listed.",
      terms: "50% deposit on acceptance, balance on delivery. Quote valid until the date shown.",
      status,
      sentTo: o.sentDaysAgo !== undefined ? email : undefined,
      sentAt: o.sentDaysAgo !== undefined ? iso(-o.sentDaysAgo * DAY) : undefined,
      openedAt: o.openedDaysAgo !== undefined ? iso(-o.openedDaysAgo * DAY) : undefined,
      decidedAt: o.decidedDaysAgo !== undefined ? iso(-o.decidedDaysAgo * DAY) : undefined,
      declineReason: o.declineReason,
      paidAt: o.paidDaysAgo !== undefined ? iso(-o.paidDaysAgo * DAY) : undefined,
      paymentRef: status === "paid" ? "PAY-PROTO-0042" : undefined,
      history,
      createdAt: iso(-o.createdDaysAgo * DAY),
      createdBy: by,
      updatedAt: history.at(-1)!.at,
    });
  };
  quote("dl_coastal_branch", "draft", { createdDaysAgo: 2, validDays: 30 });
  quote("dl_harmattan_av", "sent", { createdDaysAgo: 5, validDays: 30, sentDaysAgo: 4, openedDaysAgo: 3 });
  quote("dl_kintampo", "sent", { createdDaysAgo: 2, validDays: 21, sentDaysAgo: 1 });
  const negotiating = deals.find((d) => d.status === "open" && d.stageId === "st_negotiation" && d.id.startsWith("dl_") && !["dl_harmattan_av", "dl_tema_fitout"].includes(d.id));
  if (negotiating) quote(negotiating.id, "accepted", { createdDaysAgo: 14, validDays: 30, sentDaysAgo: 13, openedDaysAgo: 12, decidedDaysAgo: 6 });
  quote("dl_osu_lost", "declined", { createdDaysAgo: 30, validDays: 30, sentDaysAgo: 29, openedDaysAgo: 27, decidedDaysAgo: 22, declineReason: "Budget cut this quarter" });
  quote("dl_tema_fitout", "expired", { createdDaysAgo: 50, validDays: 30, sentDaysAgo: 49, openedDaysAgo: 45 });
  quote("dl_coastal_hq", "paid", { createdDaysAgo: 80, validDays: 30, sentDaysAgo: 79, openedDaysAgo: 78, decidedDaysAgo: 72, paidDaysAgo: 68 });
  for (const q of quotes) for (const h of q.history.filter((x) => x.kind !== "opened")) audit.push({ id: nextId("au"), orgId: ORG, entityType: "quote", entityId: q.id, action: h.kind === "created" ? "created" : (h.kind as AuditEvent["action"]), actorId: h.by === "customer" || h.by === "system" ? `system:${h.by}` : h.by, at: h.at, summary: q.number });

  /* ---------------- Targets (prototype) ---------------- */
  const targets: SalesTarget[] = [];
  const base = new Date(now);
  for (let m = -6; m <= 6; m++) {
    const d = new Date(base.getFullYear(), base.getMonth() + m, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    targets.push({ id: `tg_ghs_${month}`, orgId: ORG, month, currency: "GHS", amount: 300_000, ownerId: null });
    targets.push({ id: `tg_usd_${month}`, orgId: ORG, month, currency: "USD", amount: 8_000, ownerId: null });
  }

  return { pipelines: buildPipelines(), taxes: buildTaxes(), products, leads, deals, quotes, targets, activities, audit };
}
