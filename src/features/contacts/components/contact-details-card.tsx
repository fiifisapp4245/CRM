"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";
import type { AccountRef } from "@/lib/types/related";
import { formatDate } from "@/lib/utils/format";
import { formatPhone } from "@/lib/utils/normalize";
import { METHOD_LABEL_LABELS, SOURCE_LABELS, type Contact, type ContactMethod } from "../types";

const ICON = { phone: Phone, email: Mail, whatsapp: MessageCircle } as const;
const GENDER: Record<NonNullable<Contact["gender"]>, string> = { female: "Female", male: "Male", other: "Other", undisclosed: "Prefer not to say" };

function MethodRow({ m }: { m: ContactMethod }) {
  const [copied, setCopied] = useState(false);
  const Icon = ICON[m.kind];
  const display = m.kind === "email" ? m.value : formatPhone(m.value);
  const href = m.kind === "email" ? `mailto:${m.value}` : m.kind === "phone" ? `tel:${m.value.replace(/\s/g, "")}` : undefined;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return (
    <li className="group flex items-center gap-3 py-1.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={m.kind} />
      <div className="min-w-0 flex-1">
        {href ? (
          <a href={href} className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline">
            {display}
          </a>
        ) : (
          <span className="block truncate text-sm font-medium">{display}</span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {m.kind === "whatsapp" ? "WhatsApp · " : ""}
          {METHOD_LABEL_LABELS[m.label]}
          {m.isPrimary && (
            <>
              {" · "}
              <Star className="size-3 fill-current text-brand-700" aria-hidden /> Primary
            </>
          )}
        </span>
      </div>
      <button type="button" onClick={copy} className="rounded p-1.5 text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Copy ${display}`}>
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </li>
  );
}

export function ContactMethodsCard({ contact }: { contact: Contact }) {
  const order = { phone: 0, whatsapp: 1, email: 2 };
  const methods = [...contact.methods].sort((a, b) => order[a.kind] - order[b.kind] || Number(b.isPrimary) - Number(a.isPrimary));
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="methods-heading">
      <h2 id="methods-heading" className="px-5 pt-4 pb-2 text-[0.9375rem] font-semibold">Contact details</h2>
      <div className="px-5 py-2">
        {methods.length ? <ul>{methods.map((m) => <MethodRow key={m.id} m={m} />)}</ul> : <p className="py-2 text-sm text-muted-foreground">No phone numbers or email addresses.</p>}
      </div>
    </section>
  );
}

export function AboutCard({ contact, users, accounts }: { contact: Contact; users: Map<string, User>; accounts: Map<string, AccountRef> }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Account", contact.accountId ? accounts.get(contact.accountId)?.name : null],
    ["Job title", contact.jobTitle],
    ["Address", [contact.address, contact.city, contact.region, contact.country].filter(Boolean).join(", ") || null],
    ["Gender", contact.gender ? GENDER[contact.gender] : null],
    ["Date of birth", contact.dateOfBirth ? formatDate(contact.dateOfBirth) : null],
    ["Source", SOURCE_LABELS[contact.source]],
    ["Created", `${formatDate(contact.createdAt)} by ${users.get(contact.createdBy)?.name ?? "Unknown"}`],
    ...Object.entries(contact.customFields ?? {}).map(([k, v]) => [k, v] as [string, string]),
  ];
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="about-heading">
      <h2 id="about-heading" className="px-5 pt-4 pb-2 text-[0.9375rem] font-semibold">About</h2>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 px-5 py-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={v ? "break-words" : "text-muted-foreground"}>{v || "—"}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Tags</dt>
        <dd className="flex flex-wrap gap-1">
          {contact.tags.length ? contact.tags.map((t) => <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{t}</span>) : <span className="text-muted-foreground">—</span>}
        </dd>
      </dl>
      {contact.notes && (
        <div className="border-t px-5 py-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Background notes</p>
          <p className="text-sm whitespace-pre-line">{contact.notes}</p>
        </div>
      )}
      {contact.source === "mystoreguard" || contact.source === "loandrift" ? (
        <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
          Originally from {SOURCE_LABELS[contact.source]}. Source shows where the record came from; it doesn&apos;t give access to {SOURCE_LABELS[contact.source]} data.
        </p>
      ) : null}
    </section>
  );
}
