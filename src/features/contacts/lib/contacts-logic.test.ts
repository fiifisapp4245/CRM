import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { USERS } from "@/lib/mock-data/users";
import { contactFormSchema, contactToForm, emptyContactForm, normalizePrimaries } from "../schemas/contact-form";
import { findDuplicateGroups } from "./duplicates";
import { applyMerge, consentConflicts, defaultChoices } from "./merge";
import { autoMapColumns, planImport, applyImportPlan } from "./import";
import { consentStatus, messageAllowed } from "./consent";
import { DEFAULT_FILTERS, filterContacts } from "./filters";
import { visibleContacts } from "./access";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const user = (id: string) => USERS.find((u) => u.id === id)!;
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;

describe("contact form", () => {
  it("pre-populates every contact method when editing (phone-only regression)", () => {
    const db = buildSeed(NOW);
    const kwesi = db.contacts.find((c) => c.id === "ct_kwesi")!;
    const form = contactToForm(kwesi);
    expect(form.methods).toHaveLength(1);
    expect(form.methods[0].value).toBe("0554 555 010");
    expect(contactFormSchema.safeParse(form).success).toBe(true);
  });
  it("does not require email or phone", () => {
    const v = { ...emptyContactForm("u_kwame"), firstName: "Esi", displayName: "Esi" };
    expect(contactFormSchema.safeParse(v).success).toBe(true);
  });
  it("requires a name and validates methods", () => {
    const v = { ...emptyContactForm("u_kwame"), displayName: "x", methods: [{ id: "1", kind: "email" as const, value: "not-an-email", label: "work" as const, isPrimary: true }] };
    const r = contactFormSchema.safeParse(v);
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("firstName");
    expect(paths).toContain("methods.0.value");
  });
  it("flags the same number entered twice in different formats", () => {
    const v = {
      ...emptyContactForm("u_kwame"),
      firstName: "Esi",
      displayName: "Esi",
      methods: [
        { id: "1", kind: "phone" as const, value: "024 412 3456", label: "mobile" as const, isPrimary: true },
        { id: "2", kind: "phone" as const, value: "+233244123456", label: "work" as const, isPrimary: false },
      ],
    };
    expect(contactFormSchema.safeParse(v).success).toBe(false);
  });
  it("keeps exactly one primary per kind", () => {
    const out = normalizePrimaries([
      { kind: "phone", isPrimary: false },
      { kind: "phone", isPrimary: false },
      { kind: "email", isPrimary: true },
      { kind: "email", isPrimary: true },
    ]);
    expect(out.filter((m) => m.kind === "phone" && m.isPrimary)).toHaveLength(1);
    expect(out.filter((m) => m.kind === "email" && m.isPrimary)).toHaveLength(1);
  });
});

describe("duplicates", () => {
  const db = buildSeed(NOW);
  const groups = findDuplicateGroups(db.contacts);
  it("finds the seeded groups using normalised email and phone", () => {
    const keys = groups.map((g) => [...g.contactIds].sort().join(","));
    expect(keys).toContain(["ct_dup_akosua_a", "ct_dup_akosua_b"].join(","));
    expect(keys).toContain(["ct_dup_yaw_a", "ct_dup_yaw_b"].join(","));
    expect(keys).toContain(["ct_dup_emma_a", "ct_dup_emma_b", "ct_dup_emma_c"].join(","));
  });
  it("never groups across organisations", () => {
    expect(groups.some((g) => g.contactIds.includes("ct_abigail"))).toBe(false);
  });
  it("respects dismissed pairs", () => {
    const g2 = findDuplicateGroups(db.contacts, ["ct_dup_yaw_a|ct_dup_yaw_b"]);
    expect(g2.some((g) => g.contactIds.includes("ct_dup_yaw_a"))).toBe(false);
  });
});

describe("merge", () => {
  it("re-points relationships, keeps all consent history and soft-deletes secondaries", () => {
    const db = buildSeed(NOW);
    const ids = ["ct_dup_grace_a", "ct_dup_grace_b"];
    const consentsBefore = db.consents.filter((c) => ids.includes(c.contactId)).length;
    expect(consentConflicts(db, ids)).toHaveLength(1);
    const contacts = db.contacts.filter((c) => ids.includes(c.id));
    const next = applyMerge(db, "u_ama", { primaryId: ids[0], contactIds: ids, choices: defaultChoices(contacts, ids[0]) }, new Date(NOW).toISOString(), newId);
    const primary = next.contacts.find((c) => c.id === ids[0])!;
    const secondary = next.contacts.find((c) => c.id === ids[1])!;
    expect(secondary.status).toBe("merged");
    expect(secondary.mergedIntoId).toBe(ids[0]);
    expect(next.consents.filter((c) => c.contactId === ids[0])).toHaveLength(consentsBefore);
    expect(primary.methods.filter((m) => m.kind === "phone")).toHaveLength(1); // same number deduplicated
    expect(primary.methods.some((m) => m.kind === "email")).toBe(true); // email carried over
    expect(primary.dateOfBirth).toBe("1991-07-04"); // empty primary field filled
    // Most recent consent (withdrawn) wins as current status.
    expect(consentStatus(next.consents, ids[0], "sms", "marketing")).toBe("withdrawn");
    expect(next.audit.filter((a) => a.action === "merged" || a.action === "merged_into")).toHaveLength(2);
  });
});

describe("import", () => {
  const db = buildSeed(NOW);
  const actor = user("u_ama");
  const table = [
    ["First name", "Last name", "Email", "Phone", "Company", "Favourite colour"],
    ["Esi", "Badu", "esi.badu@mail.example", "024 555 9001", "Osu Bakery Co.", "Blue"],
    ["Abigail", "Owusu-Ansah", "ABIGAIL.OwusuAnsah@coastalpharmacy.example", "", "", ""],
    ["Akosua", "Frimpong", "akosua.frimpong@osubakery.example", "", "", ""],
    ["", "", "nobody@mail.example", "", "", ""],
    ["Bad", "Email", "not-an-email", "", "", ""],
    ["Esi", "Again", "esi.badu@mail.example", "", "", ""],
    ["Delali", "Kpodo", "", "+233 26 555 0909", "", ""],
  ];
  it("auto-maps known headers and keeps unknown ones as custom fields", () => {
    expect(autoMapColumns(table[0])).toEqual(["firstName", "lastName", "email", "phone", "company", "custom"]);
  });
  it("classifies rows into create / update / skip / error", () => {
    const plan = planImport(table, autoMapColumns(table[0]), db, actor, "update");
    expect(plan.rows.map((r) => r.outcome)).toEqual(["create", "update", "error", "error", "error", "skip", "create"]);
    // Row matching a contact in ANOTHER organisation is created, not merged across the boundary.
    expect(plan.rows[6].matchedContactId).toBeUndefined();
  });
  it("skips matches in skip mode and applies the plan", () => {
    const plan = planImport(table, autoMapColumns(table[0]), db, actor, "skip");
    expect(plan.counts).toMatchObject({ create: 2, update: 0, skip: 2, error: 3 });
    const res = applyImportPlan(db, actor, plan, new Date(NOW).toISOString(), newId);
    expect(res.created).toBe(2);
    const esi = res.db.contacts.find((c) => c.displayName === "Esi Badu")!;
    expect(esi.source).toBe("import");
    expect(esi.accountId).toBe("acc_osu_bakery");
    expect(esi.customFields).toEqual({ "Favourite colour": "Blue" });
  });
  it("rejects files over the row limit and without name columns", () => {
    expect(planImport([["Email"], ["a@b.example"]], ["email"], db, actor, "skip").fatal).toMatch(/name/);
    const big = [["First name"], ...Array.from({ length: 10_001 }, () => ["x"])];
    expect(planImport(big, ["firstName"], db, actor, "skip").fatal).toMatch(/10,000/);
  });
});

describe("consent rules", () => {
  const db = buildSeed(NOW);
  it("blocks marketing without agreement and allows it with agreement", () => {
    expect(messageAllowed(db.consents, "ct_abigail", "sms", "marketing").allowed).toBe(false); // withdrawn
    expect(messageAllowed(db.consents, "ct_abigail", "whatsapp", "marketing").allowed).toBe(true);
    expect(messageAllowed(db.consents, "ct_kwesi", "sms", "marketing").allowed).toBe(false); // unknown
    expect(messageAllowed(db.consents, "ct_kwesi", "sms", "operational").allowed).toBe(true);
  });
});

describe("filters and visibility", () => {
  const db = buildSeed(NOW);
  it("CRM users only see own + unassigned contacts in their org", () => {
    const vis = visibleContacts(db, user("u_kwame"));
    expect(vis.every((c) => c.orgId === "org_adinkra" && (c.ownerId === null || c.ownerId === "u_kwame"))).toBe(true);
  });
  it("searches by normalised phone number", () => {
    const res = filterContacts(db.contacts, { ...DEFAULT_FILTERS, search: "0244555012" }, { accounts: db.accounts });
    expect(res.map((c) => c.id).sort()).toEqual(["ct_dup_yaw_a", "ct_dup_yaw_b"]);
  });
  it("filters by source and status", () => {
    const res = filterContacts(db.contacts, { ...DEFAULT_FILTERS, sources: ["loandrift"], statuses: ["active"] }, { accounts: db.accounts });
    expect(res.every((c) => c.source === "loandrift" && c.status === "active")).toBe(true);
  });
});

describe("export", async () => {
  const { contactsToCsv, EXPORT_HEADERS } = await import("./export");
  const { parseCsv } = await import("@/lib/utils/csv");
  const db = buildSeed(NOW);
  it("exports only the given (permission-filtered) contacts with readable headings", () => {
    const rows = visibleContacts(db, user("u_kwame")).slice(0, 5);
    const parsed = parseCsv(contactsToCsv(rows, db));
    expect(parsed[0]).toEqual(EXPORT_HEADERS);
    expect(parsed).toHaveLength(6);
  });
  it("escapes values with commas and keeps every contact method", () => {
    const abigail = db.contacts.find((c) => c.id === "ct_abigail")!;
    const [, row] = parseCsv(contactsToCsv([{ ...abigail, jobTitle: "Head, Procurement" }], db));
    expect(row[EXPORT_HEADERS.indexOf("Job title")]).toBe("Head, Procurement");
    expect(row[EXPORT_HEADERS.indexOf("Other phones")]).toBe("030 255 0102");
    expect(row[EXPORT_HEADERS.indexOf("Owner")]).toBe("Kwame Boateng");
  });
});
