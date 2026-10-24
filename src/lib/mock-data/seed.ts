import { createRandom } from "@/lib/utils/random";
import { buildEngagementSeed } from "./seed-engagement";
import { buildSalesSeed } from "./seed-sales";
import type { Segment } from "@/features/segments/types";
import { ACCOUNT_DOMAIN, buildAccounts, CONTACT_ACCOUNT_IDS } from "./seed-accounts";
import type { Activity, ActivityType, CallOutcome } from "@/features/activities/types";
import type {
  AuditEvent,
  ConsentChannel,
  ConsentDecision,
  ConsentMethod,
  ConsentPurpose,
  ConsentRecord,
  Contact,
  ContactMethod,
  ContactSource,
  MethodLabel,
} from "@/features/contacts/types";
import { DB_VERSION, type AppNotification, type Db } from "./db-types";
import { ORGANIZATIONS, PRIMARY_ORG_ID, USERS } from "./users";

/**
 * Builds the fictional demo dataset. Deterministic (seeded PRNG) except that
 * timestamps are relative to `now`, so "due tomorrow" stays true after a reset.
 * Phone numbers use a 555 block and e-mail addresses use the reserved
 * ".example" domain so none of them can belong to a real person.
 */

const ORG = PRIMARY_ORG_ID;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const FIRST_F = ["Akosua", "Adwoa", "Abenaa", "Esi", "Afia", "Yaa", "Ama", "Efua", "Akua", "Mansa", "Dzifa", "Elikem", "Nana", "Gifty", "Comfort", "Patience", "Mercy", "Priscilla", "Joyce", "Linda", "Sena", "Selorm", "Naana", "Adjoa"];
const FIRST_M = ["Kwabena", "Kwaku", "Kofi", "Kwasi", "Yaw", "Kojo", "Kwadwo", "Fiifi", "Ekow", "Nii", "Edem", "Senyo", "Emmanuel", "Samuel", "Daniel", "Isaac", "Prince", "Richard", "Michael", "Benjamin", "Francis", "Eric", "Joseph", "Ebo"];
const LAST = ["Appiah", "Ansah", "Asare", "Badu", "Boakye", "Danquah", "Dapaah", "Donkor", "Fosu", "Gyamfi", "Kuffour", "Kyei", "Larbi", "Nkansah", "Nyarko", "Obeng", "Oduro", "Opoku", "Osei", "Quaye", "Sarpong", "Tagoe", "Wiredu", "Yeboah", "Ackah", "Amoah", "Baidoo", "Essel", "Hammond", "Quarshie", "Agyeman", "Lartey", "Adomako", "Bonsu"];
const INTERNATIONAL: Array<[string, string, "female" | "male", string, string]> = [
  ["Chiamaka", "Okafor", "female", "+234", "Nigeria"],
  ["Tunde", "Adeyemi", "male", "+234", "Nigeria"],
  ["Fatou", "Diallo", "female", "+221", "Senegal"],
  ["Oliver", "Bennett", "male", "+44", "United Kingdom"],
  ["Hannah", "Weber", "female", "+49", "Germany"],
  ["Wanjiru", "Kamau", "female", "+254", "Kenya"],
  ["Marcus", "Holloway", "male", "+1", "United States"],
  ["Ines", "Moreau", "female", "+33", "France"],
];
const CITIES: Array<[string, string]> = [
  ["Accra", "Greater Accra"],
  ["Tema", "Greater Accra"],
  ["Kumasi", "Ashanti"],
  ["Takoradi", "Western"],
  ["Cape Coast", "Central"],
  ["Tamale", "Northern"],
  ["Ho", "Volta"],
  ["Koforidua", "Eastern"],
  ["Sunyani", "Bono"],
];
const STREETS = ["Oxford Street", "Liberation Road", "Ring Road Central", "Spintex Road", "Harper Road", "Market Circle", "Independence Avenue", "Kanda Highway"];
const JOBS = ["Procurement Officer", "Operations Manager", "Managing Director", "Finance Manager", "Store Manager", "Office Administrator", "Head of Facilities", "Purchasing Lead", "Owner", "Accountant", "HR Manager", "Project Coordinator"];
const TAGS = ["VIP", "Wholesale", "Retail", "Referral", "Event 2026", "Newsletter", "Key decision maker", "Price sensitive", "Follow-up"];
const GH_PREFIXES = ["24", "54", "55", "20", "27", "50", "59", "26"];

let phoneCounter = 1000;
function ghPhone(rand: ReturnType<typeof createRandom>, national = rand.chance(0.5)): string {
  const prefix = rand.pick(GH_PREFIXES);
  const last = String(phoneCounter++).padStart(4, "0");
  return national ? `0${prefix} 555 ${last}` : `+233 ${prefix} 555 ${last}`;
}

let methodCounter = 0;
const m = (kind: ContactMethod["kind"], value: string, label: MethodLabel, isPrimary: boolean): ContactMethod => ({
  id: `cm_${++methodCounter}`,
  kind,
  value,
  label,
  isPrimary,
});

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
}

export function buildSeed(now: number = Date.now()): Db {
  const rand = createRandom(20261021);
  phoneCounter = 1000;
  methodCounter = 0;
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const accounts = buildAccounts(iso);

  const contacts: Contact[] = [];
  const activities: Activity[] = [];
  const consents: ConsentRecord[] = [];
  const audit: AuditEvent[] = [];
  let seq = 0;
  const nextId = (p: string) => `${p}_${(++seq).toString(36).padStart(4, "0")}`;

  const ownersWeighted: Array<string | null> = [
    "u_ama", "u_ama",
    "u_kwame", "u_kwame", "u_kwame", "u_kwame", "u_kwame",
    "u_efua", "u_efua", "u_efua", "u_efua",
    "u_kojo", "u_kojo", "u_kojo",
    "u_selasi", "u_selasi", "u_selasi",
    "u_naa",
    null, null, null,
  ];
  const sourcesWeighted: ContactSource[] = ["manual", "manual", "manual", "manual", "import", "import", "mystoreguard", "mystoreguard", "loandrift"];

  function addContact(c: Partial<Contact> & Pick<Contact, "firstName" | "methods">, ageDays: number): Contact {
    const createdAt = iso(-ageDays * DAY - rand.int(0, 20) * HOUR);
    const updatedOffset = Math.max(0, ageDays - rand.int(0, Math.max(1, ageDays)));
    const contact: Contact = {
      id: c.id ?? nextId("ct"),
      orgId: c.orgId ?? ORG,
      title: c.title,
      firstName: c.firstName,
      middleName: c.middleName,
      lastName: c.lastName,
      displayName: c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(" "),
      methods: c.methods,
      accountId: c.accountId ?? null,
      jobTitle: c.jobTitle,
      ownerId: c.ownerId === undefined ? rand.pick(ownersWeighted) : c.ownerId,
      gender: c.gender,
      dateOfBirth: c.dateOfBirth,
      address: c.address,
      city: c.city,
      region: c.region,
      country: c.country ?? "Ghana",
      tags: c.tags ?? [],
      notes: c.notes,
      source: c.source ?? rand.pick(sourcesWeighted),
      status: c.status ?? "active",
      archivedAt: c.archivedAt,
      archivedBy: c.archivedBy,
      createdAt,
      createdBy: c.createdBy ?? "u_abena",
      updatedAt: iso(-updatedOffset * DAY - rand.int(1, 20) * HOUR),
    };
    if (contact.status === "archived") {
      contact.archivedAt = contact.updatedAt;
      contact.archivedBy = contact.ownerId ?? "u_abena";
    }
    contacts.push(contact);
    audit.push({
      id: nextId("au"),
      orgId: contact.orgId,
      entityType: "contact",
      entityId: contact.id,
      action: contact.source === "import" ? "imported" : "created",
      actorId: contact.createdBy,
      at: contact.createdAt,
      summary:
        contact.source === "mystoreguard"
          ? "Created from a MyStoreGuard customer sync"
          : contact.source === "loandrift"
            ? "Created from a LoanDrift customer sync"
            : undefined,
    });
    return contact;
  }

  /* ---------------- Featured, hand-written contacts ---------------- */

  addContact(
    {
      id: "ct_abigail",
      title: "Mrs",
      firstName: "Abigail",
      middleName: "Serwaa",
      lastName: "Owusu-Ansah",
      methods: [
        m("phone", "+233 24 555 0101", "mobile", true),
        m("phone", "030 255 0102", "work", false),
        m("email", "abigail.owusuansah@coastalpharmacy.example", "work", true),
        m("email", "serwaa.oa@mail.example", "personal", false),
        m("whatsapp", "+233 24 555 0101", "mobile", true),
      ],
      accountId: "acc_coastal_pharm",
      jobTitle: "Head of Procurement",
      ownerId: "u_kwame",
      gender: "female",
      dateOfBirth: "1984-03-12",
      address: "14 Ring Road Central",
      city: "Accra",
      region: "Greater Accra",
      tags: ["VIP", "Key decision maker", "Wholesale"],
      notes: "Prefers WhatsApp for quick questions; formal quotes by email. Budget cycle closes in November.",
      source: "manual",
      createdBy: "u_kwame",
    },
    240,
  );

  // Phone-only contact — regression case for the "phone shown on profile but empty in edit form" defect.
  addContact(
    {
      id: "ct_kwesi",
      firstName: "Kwesi",
      lastName: "Arthur",
      methods: [m("phone", "0554 555 010", "mobile", true)],
      ownerId: "u_kwame",
      gender: "male",
      city: "Cape Coast",
      region: "Central",
      source: "mystoreguard",
      tags: ["Retail"],
      createdBy: "u_kwame",
    },
    35,
  );

  addContact(
    {
      id: "ct_oliver",
      title: "Mr",
      firstName: "Oliver",
      lastName: "Bennett",
      methods: [m("phone", "+44 20 7946 0555", "work", true), m("email", "o.bennett@harmattantextiles.example", "work", true)],
      accountId: "acc_harmattan",
      jobTitle: "Export Partner",
      ownerId: "u_efua",
      gender: "male",
      city: "London",
      country: "United Kingdom",
      tags: ["Wholesale"],
      source: "manual",
    },
    120,
  );

  // Duplicate group 1: same email, different case.
  addContact(
    {
      id: "ct_dup_akosua_a",
      firstName: "Akosua",
      lastName: "Frimpong",
      methods: [m("email", "akosua.frimpong@osubakery.example", "work", true), m("phone", "024 555 0201", "mobile", true)],
      accountId: "acc_osu_bakery",
      jobTitle: "Operations Manager",
      ownerId: "u_kwame",
      source: "manual",
      city: "Accra",
      region: "Greater Accra",
      tags: ["Retail"],
    },
    200,
  );
  addContact(
    {
      id: "ct_dup_akosua_b",
      firstName: "Akosua",
      lastName: "Frimpong-Mensah",
      methods: [m("email", "Akosua.Frimpong@OsuBakery.example", "work", true)],
      accountId: "acc_osu_bakery",
      jobTitle: "Ops Manager",
      ownerId: "u_efua",
      source: "import",
      city: "Accra",
      tags: ["Newsletter"],
    },
    20,
  );

  // Duplicate group 2: same phone, different formatting.
  addContact(
    {
      id: "ct_dup_yaw_a",
      firstName: "Yaw",
      lastName: "Ofori",
      methods: [m("phone", "0244 555 012", "mobile", true)],
      ownerId: "u_kojo",
      source: "manual",
      city: "Kumasi",
      region: "Ashanti",
      jobTitle: "Owner",
    },
    150,
  );
  addContact(
    {
      id: "ct_dup_yaw_b",
      firstName: "Y.",
      lastName: "Ofori",
      displayName: "Y. Ofori",
      methods: [m("phone", "+233 24 455 5012", "mobile", true), m("email", "yaw.ofori@mail.example", "personal", true)],
      ownerId: null,
      source: "mystoreguard",
      city: "Kumasi",
    },
    8,
  );

  // Duplicate group 3: same phone, conflicting consent across two source systems.
  addContact(
    {
      id: "ct_dup_grace_a",
      firstName: "Grace",
      lastName: "Addo",
      methods: [m("phone", "+233 20 555 0303", "mobile", true), m("whatsapp", "+233 20 555 0303", "mobile", true)],
      ownerId: "u_efua",
      source: "mystoreguard",
      city: "Tema",
      region: "Greater Accra",
      tags: ["Retail"],
    },
    300,
  );
  addContact(
    {
      id: "ct_dup_grace_b",
      firstName: "Grace",
      lastName: "Addo",
      methods: [m("phone", "020 555 0303", "mobile", true), m("email", "grace.addo@mail.example", "personal", true)],
      ownerId: "u_kwame",
      source: "loandrift",
      city: "Tema",
      gender: "female",
      dateOfBirth: "1991-07-04",
    },
    60,
  );

  // Duplicate group 4: three records.
  addContact(
    {
      id: "ct_dup_emma_a",
      firstName: "Emmanuel",
      lastName: "Tetteh",
      methods: [m("email", "e.tetteh@temahardware.example", "work", true), m("phone", "027 555 0404", "work", true)],
      accountId: "acc_tema_hw",
      jobTitle: "Purchasing Lead",
      ownerId: "u_kwame",
      source: "manual",
      city: "Tema",
    },
    260,
  );
  addContact(
    {
      id: "ct_dup_emma_b",
      firstName: "Emmanuel",
      lastName: "Tetteh",
      methods: [m("email", "E.Tetteh@temahardware.example", "work", true)],
      accountId: "acc_tema_hw",
      ownerId: "u_kwame",
      source: "import",
    },
    40,
  );
  addContact(
    {
      id: "ct_dup_emma_c",
      firstName: "Emma",
      lastName: "Tetteh",
      methods: [m("phone", "+233275550404", "mobile", true)],
      ownerId: null,
      source: "loandrift",
    },
    5,
  );

  /* ---------------- Generated contacts ---------------- */

  for (let i = 0; i < 118; i++) {
    const international = i % 15 === 7;
    let first: string, last: string, gender: "female" | "male", country = "Ghana", phone: string;
    let city: string | undefined, region: string | undefined;
    if (international) {
      const intl = INTERNATIONAL[Math.floor(i / 15) % INTERNATIONAL.length];
      [first, last, gender] = intl;
      country = intl[4];
      phone = `${intl[3]} ${rand.int(200, 899)} 555 ${String(phoneCounter++).padStart(4, "0")}`;
    } else {
      gender = rand.chance(0.5) ? "female" : "male";
      first = rand.pick(gender === "female" ? FIRST_F : FIRST_M);
      last = rand.pick(LAST);
      phone = ghPhone(rand);
      [city, region] = rand.pick(CITIES);
    }
    const account = rand.chance(0.62) ? { id: rand.pick(CONTACT_ACCOUNT_IDS) } : null;
    const methods: ContactMethod[] = [];
    const hasPhone = rand.chance(0.9);
    if (hasPhone) methods.push(m("phone", phone, "mobile", true));
    if (hasPhone && rand.chance(0.18)) methods.push(m("phone", ghPhone(rand), rand.chance(0.5) ? "work" : "home", false));
    const domain = account ? ACCOUNT_DOMAIN[account.id] : "mail.example";
    const hasEmail = !hasPhone || rand.chance(0.7);
    if (hasEmail) methods.push(m("email", `${slug(first)}.${slug(last)}${i}@${domain}`, account ? "work" : "personal", true));
    if (hasEmail && rand.chance(0.12)) methods.push(m("email", `${slug(first)}${i}@mail.example`, "personal", false));
    if (hasPhone && rand.chance(0.45)) methods.push(m("whatsapp", phone, "mobile", true));

    const ageDays = i < 9 ? rand.int(0, 6) : rand.int(8, 420);
    addContact(
      {
        title: rand.chance(0.25) ? rand.pick(gender === "female" ? ["Mrs", "Ms", "Dr"] : ["Mr", "Dr"]) : undefined,
        firstName: first,
        lastName: last,
        methods,
        accountId: account?.id ?? null,
        jobTitle: account ? rand.pick(JOBS) : undefined,
        gender: rand.chance(0.85) ? gender : undefined,
        dateOfBirth: rand.chance(0.3) ? `${rand.int(1960, 2002)}-${String(rand.int(1, 12)).padStart(2, "0")}-${String(rand.int(1, 28)).padStart(2, "0")}` : undefined,
        address: rand.chance(0.4) && !international ? `${rand.int(1, 120)} ${rand.pick(STREETS)}` : undefined,
        city,
        region,
        country,
        tags: TAGS.filter(() => rand.chance(0.14)).slice(0, 3),
        status: rand.chance(0.08) ? "archived" : "active",
        createdBy: rand.pick(["u_kwame", "u_efua", "u_kojo", "u_selasi", "u_ama", "u_abena"]),
      },
      ageDays,
    );
  }

  // Contacts in the OTHER organisation (never visible in Adinkra).
  for (const [first, last, phone] of [
    ["Delali", "Kpodo", "+233 24 555 0101"], // deliberately shares Abigail's phone — must NOT be flagged as a duplicate
    ["Mawuli", "Ahiable", "+233 26 555 0909"],
  ] as const) {
    addContact({ orgId: "org_volta", firstName: first, lastName: last, methods: [m("phone", phone, "mobile", true)], ownerId: "u_volta_mgr", source: "manual", createdBy: "u_volta_mgr" }, 30);
  }

  /* ---------------- Activities ---------------- */

  const subjects: Record<Exclude<ActivityType, "task" | "visit">, string[]> = {
    note: ["Prefers delivery before 10am", "Asked about bulk pricing tiers", "Budget approved for Q1", "Mentioned expansion to a second branch", "Concerned about lead times"],
    call: ["Discovery call", "Follow-up on quotation", "Check-in after delivery", "Payment reminder call", "Introductory call"],
    meeting: ["Product demo at their office", "Quarterly review", "Site visit", "Contract walkthrough"],
    email: ["Sent price list", "Shared delivery schedule", "Quotation sent", "Thank-you note after visit"],
    message: ["Order ready for pickup", "Delivery confirmation", "New arrivals this week"],
  };
  const taskSubjects = ["Send revised quotation", "Call back about invoice", "Confirm delivery address", "Prepare renewal proposal", "Book follow-up meeting", "Share product catalogue"];
  const outcomes: CallOutcome[] = ["connected", "connected", "connected", "no_answer", "left_voicemail", "busy"];

  const orgContacts = contacts.filter((c) => c.orgId === ORG);
  for (const c of orgContacts) {
    const count = c.id === "ct_abigail" ? 0 : rand.int(0, 5);
    const actor = c.ownerId && c.ownerId !== "u_naa" ? c.ownerId : "u_selasi";
    for (let k = 0; k < count; k++) {
      const type = rand.pick<Exclude<ActivityType, "task" | "visit">>(["note", "call", "call", "meeting", "email", "message"]);
      const ageMs = rand.int(1, 90) * DAY + rand.int(0, 10) * HOUR;
      activities.push({
        id: nextId("ac"),
        orgId: ORG,
        contactId: c.id,
        type,
        subject: rand.pick(subjects[type]),
        occurredAt: iso(-ageMs),
        callOutcome: type === "call" ? rand.pick(outcomes) : undefined,
        direction: type === "call" ? (rand.chance(0.7) ? "outbound" : "inbound") : undefined,
        durationMinutes: type === "call" ? rand.int(2, 25) : type === "meeting" ? rand.pick([30, 45, 60]) : undefined,
        channel: type === "message" ? rand.pick(["sms", "whatsapp"] as const) : undefined,
        messagePurpose: type === "message" ? "operational" : undefined,
        status: type === "meeting" ? "done" : undefined,
        assigneeId: actor,
        createdBy: actor,
        createdAt: iso(-ageMs),
      });
    }
    if (c.status === "active" && rand.chance(0.28)) {
      const dueOffset = rand.int(-6, 10) * DAY + rand.int(1, 8) * HOUR;
      activities.push({
        id: nextId("ac"),
        orgId: ORG,
        contactId: c.id,
        type: "task",
        subject: rand.pick(taskSubjects),
        dueAt: iso(dueOffset),
        status: "open",
        assigneeId: actor,
        createdBy: actor,
        createdAt: iso(-rand.int(2, 20) * DAY),
      });
    }
  }

  // Rich history for the featured contact.
  const abigailActs: Array<Partial<Activity> & { type: ActivityType; subject: string; at: number }> = [
    { type: "call", subject: "Introductory call", at: -120 * DAY, callOutcome: "connected", direction: "outbound", durationMinutes: 18, body: "Introduced our office furniture range. Interested in ergonomic chairs for 3 branches." },
    { type: "meeting", subject: "Showroom visit", at: -95 * DAY, durationMinutes: 60, status: "done", body: "Toured showroom with facilities lead. Shortlisted 2 chair models." },
    { type: "email", subject: "Quotation Q-2041 sent", at: -60 * DAY, body: "Sent quotation for 120 chairs and 40 desks." },
    { type: "message", subject: "Delivery confirmation for order #5521", at: -21 * DAY, channel: "whatsapp", messagePurpose: "operational" },
    { type: "call", subject: "Follow-up on revised pricing", at: -9 * DAY, callOutcome: "left_voicemail", direction: "outbound", durationMinutes: 1 },
    { type: "note", subject: "Budget cycle closes in November", at: -4 * DAY, body: "Needs final proposal by 15 Nov to be included in this year's budget." },
    { type: "task", subject: "Send final proposal for branch roll-out", at: 2 * DAY, status: "open" },
    { type: "meeting", subject: "Proposal review with procurement committee", at: 6 * DAY, status: "open", durationMinutes: 45 },
    { type: "task", subject: "Confirm delivery window for Kumasi branch", at: -1 * DAY, status: "open" },
  ];
  for (const a of abigailActs) {
    const scheduled = a.type === "task" || (a.type === "meeting" && a.status === "open");
    activities.push({
      id: nextId("ac"),
      orgId: ORG,
      contactId: "ct_abigail",
      type: a.type,
      subject: a.subject,
      body: a.body,
      occurredAt: scheduled ? undefined : iso(a.at),
      dueAt: scheduled ? iso(a.at) : undefined,
      status: a.status,
      callOutcome: a.callOutcome,
      direction: a.direction,
      durationMinutes: a.durationMinutes,
      channel: a.channel,
      messagePurpose: a.messagePurpose,
      assigneeId: "u_kwame",
      createdBy: "u_kwame",
      createdAt: iso(Math.min(a.at, -2 * DAY)),
    });
  }

  for (const c of orgContacts) {
    const own = activities.filter((a) => a.contactId === c.id && a.occurredAt);
    const latest = own.reduce<string | undefined>((acc, a) => (!acc || a.occurredAt! > acc ? a.occurredAt : acc), undefined);
    c.lastActivityAt = latest;
  }

  /* ---------------- Consent ---------------- */

  const addConsent = (contactId: string, channel: ConsentChannel, decision: ConsentDecision, method: ConsentMethod, at: number, by: string, extra: Partial<ConsentRecord> = {}, purpose: ConsentPurpose = "marketing") =>
    consents.push({ id: nextId("cs"), orgId: ORG, contactId, channel, purpose, decision, method, recordedAt: iso(at), recordedBy: by, ...extra });

  addConsent("ct_abigail", "email", "agreed", "signed_form", -200 * DAY, "u_kwame", { evidenceRef: "FORM-2025-0412", note: "Signed at trade fair stand." });
  addConsent("ct_abigail", "sms", "agreed", "verbal_call", -120 * DAY, "u_kwame");
  addConsent("ct_abigail", "sms", "withdrawn", "replied_stop", -30 * DAY, "u_kwame", { note: "Replied STOP to promo SMS #88." });
  addConsent("ct_abigail", "whatsapp", "agreed", "replied_yes", -90 * DAY, "u_kwame", { evidenceRef: "WA-MSG-77120" });
  addConsent("ct_abigail", "whatsapp", "agreed", "replied_yes", -90 * DAY, "u_kwame", { evidenceRef: "WA-MSG-77120" }, "service_updates");
  addConsent("ct_dup_grace_a", "sms", "agreed", "web_form", -250 * DAY, "u_efua", { evidenceRef: "MSG-OPTIN-3381" });
  addConsent("ct_dup_grace_b", "sms", "withdrawn", "replied_stop", -12 * DAY, "u_kwame", { note: "Replied STOP via LoanDrift reminder." });

  const channels: ConsentChannel[] = ["sms", "whatsapp", "email", "phone"];
  for (const c of orgContacts) {
    if (c.id.startsWith("ct_dup") || c.id === "ct_abigail" || !rand.chance(0.45)) continue;
    for (const ch of channels) {
      if (!rand.chance(0.4)) continue;
      const decision = rand.pick<ConsentDecision>(["agreed", "agreed", "agreed", "declined"]);
      const recorder = c.ownerId && c.ownerId !== "u_naa" ? c.ownerId : "u_selasi";
      addConsent(c.id, ch, decision, rand.pick(decision === "agreed" ? ["verbal_call", "web_form", "signed_form"] : ["verbal_call", "in_person"]), -rand.int(30, 300) * DAY, recorder);
      if (decision === "agreed" && rand.chance(0.15)) {
        addConsent(c.id, ch, "withdrawn", ch === "email" ? "unsubscribe_link" : "replied_stop", -rand.int(1, 29) * DAY, recorder);
      }
    }
  }

  /* ---------------- Related prototype records ---------------- */

  // A couple of historical edits for audit trails.
  audit.push(
    { id: nextId("au"), orgId: ORG, entityType: "contact", entityId: "ct_abigail", action: "updated", actorId: "u_kwame", at: iso(-95 * DAY), changes: [{ field: "Job title", from: "Procurement Officer", to: "Head of Procurement" }] },
    { id: nextId("au"), orgId: ORG, entityType: "contact", entityId: "ct_abigail", action: "reassigned", actorId: "u_ama", at: iso(-150 * DAY), changes: [{ field: "Owner", from: "Naa Lamptey", to: "Kwame Boateng" }] },
  );
  for (const r of consents) {
    audit.push({ id: nextId("au"), orgId: ORG, entityType: "contact", entityId: r.contactId, action: "consent_recorded", actorId: r.recordedBy, at: r.recordedAt, summary: `${r.channel.toUpperCase()} (${r.purpose === "marketing" ? "marketing" : "service updates"}): ${r.decision}` });
  }

  /* ---------------- Account, sync, deal, ticket and settings events (activity feed) ---------------- */

  for (const a of accounts) {
    audit.push({ id: nextId("au"), orgId: a.orgId, entityType: "account", entityId: a.id, action: "created", actorId: a.createdBy, at: a.createdAt, summary: a.parentId ? "Created as a branch" : undefined });
  }
  audit.push(
    { id: nextId("au"), orgId: ORG, entityType: "account", entityId: "acc_coastal_pharm", action: "updated", actorId: "u_kwame", at: iso(-3 * DAY - 2 * HOUR), changes: [{ field: "Rating", from: "Warm", to: "Hot" }, { field: "Annual revenue", from: "GHS 31,000,000", to: "GHS 38,000,000" }] },
    { id: nextId("au"), orgId: ORG, entityType: "account", entityId: "acc_brightpath_east", action: "updated", actorId: "u_kojo", at: iso(-9 * DAY), changes: [{ field: "Parent account", from: "", to: "Bright Path Schools" }] },
  );

  // MyStoreGuard / LoanDrift syncs record raw field keys; the feed translates them for people.
  audit.push(
    { id: nextId("au"), orgId: ORG, entityType: "contact", entityId: "ct_abigail", action: "synced", actorId: "system:mystoreguard", at: iso(-1 * DAY - 5 * HOUR), summary: "Updated by MyStoreGuard customer sync", changes: [{ field: "middle_names", from: "", to: "Serwaa" }, { field: "tag_ids", from: "tag_wholesale", to: "tag_wholesale, tag_vip" }] },
    { id: nextId("au"), orgId: ORG, entityType: "contact", entityId: "ct_kwesi", action: "synced", actorId: "system:mystoreguard", at: iso(-2 * DAY - 7 * HOUR), summary: "Updated by MyStoreGuard customer sync", changes: [{ field: "full_name", from: "K. Arthur", to: "Kwesi Arthur" }, { field: "owner_user_id", from: "", to: "u_kwame" }] },
    { id: nextId("au"), orgId: ORG, entityType: "contact", entityId: "ct_dup_grace_b", action: "synced", actorId: "system:loandrift", at: iso(-12 * DAY), summary: "Updated by LoanDrift customer sync", changes: [{ field: "date_of_birth", from: "", to: "1991-07-04" }, { field: "primary_email", from: "", to: "grace.addo@mail.example" }] },
  );

  audit.push(
    { id: nextId("au"), orgId: ORG, entityType: "setting", entityId: "set_custom_fields", action: "updated", actorId: "u_abena", at: iso(-4 * DAY - 3 * HOUR), summary: "Contact custom fields", changes: [{ field: "Custom fields", from: "", to: "Preferred language" }] },
    { id: nextId("au"), orgId: ORG, entityType: "setting", entityId: "set_roles", action: "updated", actorId: "u_kofi", at: iso(-15 * DAY), summary: "User roles", changes: [{ field: "Naa Lamptey", from: "Active", to: "Inactive" }] },
  );

  /* ---------------- Segments ---------------- */

  const segments: Segment[] = [
    { id: "seg_accra_wholesale", orgId: ORG, name: "Greater Accra wholesale buyers", description: "Wholesale and VIP contacts in Greater Accra for quarterly price updates.", isPrivate: false, ownerUserId: "u_ama", createdAt: iso(-40 * DAY), updatedAt: iso(-6 * DAY), conditions: [
      { id: "c1", kind: "location", field: "region", values: ["Greater Accra"] },
      { id: "c2", kind: "tags", mode: "include", values: ["Wholesale", "VIP"] },
    ] },
    { id: "seg_sms_marketing", orgId: ORG, name: "SMS marketing audience", description: "Everyone who has agreed to marketing by SMS and has a phone number.", isPrivate: false, ownerUserId: "u_ama", createdAt: iso(-25 * DAY), updatedAt: iso(-25 * DAY), conditions: [
      { id: "c1", kind: "consent", channel: "sms", purpose: "marketing" },
      { id: "c2", kind: "has_method", method: "phone", present: true },
    ] },
    { id: "seg_store_new", orgId: ORG, name: "New from MyStoreGuard", description: "Customers synced from MyStoreGuard in the last 90 days.", isPrivate: false, ownerUserId: "u_kwame", createdAt: iso(-12 * DAY), updatedAt: iso(-12 * DAY), conditions: [
      { id: "c1", kind: "source", values: ["mystoreguard"] },
      { id: "c2", kind: "created", from: iso(-90 * DAY).slice(0, 10) },
    ] },
    { id: "seg_kwame_birthdays", orgId: ORG, name: "My November birthdays", isPrivate: true, ownerUserId: "u_kwame", createdAt: iso(-5 * DAY), updatedAt: iso(-5 * DAY), conditions: [
      { id: "c1", kind: "owner", values: ["u_kwame"] },
      { id: "c2", kind: "birthday_month", months: [11] },
    ] },
  ];
  for (const sg of segments) audit.push({ id: nextId("au"), orgId: ORG, entityType: "segment", entityId: sg.id, action: "created", actorId: sg.ownerUserId, at: sg.createdAt, summary: sg.name });

  const sales = buildSalesSeed({ now, iso, contacts: orgContacts, accounts, nextId });
  activities.push(...sales.activities);
  audit.push(...sales.audit);
  const engagement = buildEngagementSeed({ now, contacts: orgContacts, accounts, deals: sales.deals, activities, consents, segments, nextId });
  audit.push(...engagement.audit);

  const notifications: AppNotification[] = [
    { id: nextId("nt"), userId: "u_kwame", title: "Task overdue", body: "Confirm delivery window for Kumasi branch — Abigail Owusu-Ansah", href: "/contacts/ct_abigail", at: iso(-3 * HOUR), read: false },
    { id: nextId("nt"), userId: "u_kwame", title: "Contact assigned to you", body: "Ama Mensah assigned Grace Addo to you.", href: "/contacts/ct_dup_grace_b", at: iso(-26 * HOUR), read: false },
    { id: nextId("nt"), userId: "u_ama", title: "Possible duplicates found", body: "4 groups of contacts may refer to the same people.", href: "/contacts/duplicates", at: iso(-5 * HOUR), read: false },
    { id: nextId("nt"), userId: "u_ama", title: "Contacts without an active owner", body: "Naa Lamptey is inactive and still owns contacts.", href: "/contacts?view=all", at: iso(-30 * HOUR), read: false },
    { id: nextId("nt"), userId: "u_abena", title: "Import completed", body: "Selasi Agbeko imported 42 contacts (3 failed).", at: iso(-50 * HOUR), read: true },
  ];

  return {
    version: DB_VERSION,
    seededAt: new Date(now).toISOString(),
    orgs: ORGANIZATIONS,
    users: USERS,
    accounts,
    segments,
    contacts,
    activities: engagement.activities,
    consents,
    audit,
    deals: sales.deals,
    leads: sales.leads,
    pipelines: sales.pipelines,
    taxes: sales.taxes,
    products: sales.products,
    quotes: sales.quotes,
    targets: sales.targets,
    communications: engagement.communications,
    templates: engagement.templates,
    campaigns: engagement.campaigns,
    tickets: engagement.tickets,
    savedAnswers: engagement.savedAnswers,
    folders: engagement.folders,
    documents: engagement.documents,
    settings: engagement.settings,
    importJobs: [
      { id: "imp_hist_1", orgId: ORG, fileName: "trade-fair-leads-sept.xlsx", fileSize: 48_200, startedAt: iso(-50 * HOUR), actorId: "u_selasi", duplicateMode: "skip", totalRows: 45, created: 42, updated: 0, skipped: 0, failed: 3 },
    ],
    savedViews: [],
    dismissedDuplicatePairs: [],
    notifications,
  };
}
