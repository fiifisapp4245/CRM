"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, CornerDownRight, GitBranch, Globe, Mail, Pencil, Phone, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { canReadRecord } from "@/lib/permissions";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { Breadcrumbs, PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ProfileBanner } from "@/components/shared/profile-banner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { AuditHistory } from "@/features/contacts/components/audit-history";
import { RelatedDeals } from "@/features/sales/components/related-deals";
import { visibleDeals } from "@/features/sales/lib/access";
import { hasPermission } from "@/lib/permissions";
import { primaryMethod } from "@/features/contacts/lib/filters";
import { useAccountCaps, useVisibleAccounts } from "../hooks/use-accounts";
import { ancestors, childrenOf, structureRole, STRUCTURE_LABELS } from "../lib/hierarchy";
import { ACCOUNT_OWNERSHIP_LABELS, ACCOUNT_SIZE_LABELS, ACCOUNT_TYPE_LABELS, type Account, type Address } from "../types";
import { RatingPill } from "./account-badges";

function Tree({ node, all, currentId, depth = 0 }: { node: Account; all: Account[]; currentId: string; depth?: number }) {
  const kids = childrenOf(all, node.id);
  const current = node.id === currentId;
  return (
    <li>
      <div className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2", current && "bg-brand-50")} style={{ marginLeft: depth * 24 }}>
        {depth === 0 ? <Building2 className="size-4 shrink-0 text-subtle-foreground" /> : <CornerDownRight className="size-4 shrink-0 text-subtle-foreground" />}
        {current ? (
          <span className="font-medium text-brand-800" aria-current="page">
            {node.name}
          </span>
        ) : (
          <Link href={`/accounts/${node.id}`} className="font-medium hover:underline">
            {node.name}
          </Link>
        )}
        <span className="text-xs text-muted-foreground">{[node.accountNumber, node.billingAddress?.city].filter(Boolean).join(" · ")}</span>
        {depth === 0 && kids.length > 0 && <StatusPill tone="neutral">Head office</StatusPill>}
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <Tree key={k.id} node={k} all={all} currentId={currentId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <h2 className="px-5 pt-4 pb-2 text-[0.9375rem] font-semibold">{title}</h2>
      <div className="px-5 pb-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={v ? "break-words" : "text-subtle-foreground"}>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const fmtAddress = (a?: Address) => [a?.line1, a?.city, a?.region, a?.country, a?.postalCode].filter(Boolean).join(", ");

export function AccountDetailPage({ account }: { account: Account }) {
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const accounts = useVisibleAccounts();
  const caps = useAccountCaps(account);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const [tab, setTab] = useState("contacts");

  const chain = ancestors(accounts, account.id);
  const root = chain.at(-1) ?? account;
  const parent = chain[0];
  const branches = childrenOf(accounts, account.id);
  const role = structureRole(accounts, account);
  const contacts = useMemo(() => db.contacts.filter((c) => c.accountId === account.id && c.status === "active" && canReadRecord(user, c, db.users)), [db.contacts, db.users, account.id, user]);
  const hiddenContacts = db.contacts.filter((c) => c.accountId === account.id && c.status === "active").length - contacts.length;
  const contactIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);
  const activities = useMemo(() => db.activities.filter((a) => !!a.contactId && contactIds.has(a.contactId)), [db.activities, contactIds]);
  const deals = useMemo(() => visibleDeals(db, user).filter((d) => d.accountId === account.id || (d.contactId && contactIds.has(d.contactId))), [db, user, account.id, contactIds]);
  const owner = account.ownerId ? users.get(account.ownerId) : undefined;

  return (
    <PageContainer>
      <div className="-mb-2">
        <Breadcrumbs items={[{ label: "Accounts", href: "/accounts" }, ...chain.slice().reverse().map((a) => ({ label: a.name, href: `/accounts/${a.id}` })), { label: account.name }]} />
      </div>

      <ProfileBanner
        media={
          <span className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-card text-brand-700 ring-4 ring-card">
            <span className="flex size-full items-center justify-center rounded-2xl border border-border bg-brand-50">
              <Building2 className="size-10" />
            </span>
          </span>
        }
        actions={
          <>
          {caps.addContact && (
            <Button variant="outline" asChild>
              <Link href={`/contacts/new?accountId=${account.id}`}>
                <UserPlus /> Add contact
              </Link>
            </Button>
          )}
          {caps.create && (
            <Button variant="outline" asChild>
              <Link href={`/accounts/new?parentId=${account.id}`}>
                <GitBranch /> Add branch
              </Link>
            </Button>
          )}
          {caps.edit && (
            <Button asChild>
              <Link href={`/accounts/${account.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          </>
        }
        title={
          <>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">{account.name}</h1>
            <StatusPill tone="brand">{ACCOUNT_TYPE_LABELS[account.type]}</StatusPill>
            {account.rating && <RatingPill rating={account.rating} />}
          </>
        }
        subtitle={
          <>
            {role === "branch" && parent ? (
              <>
                Branch of{" "}
                <Link href={`/accounts/${parent.id}`} className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
                  {parent.name}
                </Link>
              </>
            ) : role === "head_office" ? (
              `Head office · ${branches.length} ${branches.length === 1 ? "branch" : "branches"}`
            ) : (
              STRUCTURE_LABELS[role]
            )}
            {account.industry && ` · ${account.industry}`}
          </>
        }
        facts={[
          { label: "Account number", value: account.accountNumber ? <span className="font-medium">{account.accountNumber}</span> : <span className="text-subtle-foreground">None</span> },
          {
            label: "Phone",
            value: account.phone ? (
              <a href={`tel:${account.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                <Phone className="size-3.5 text-subtle-foreground" /> {account.phone}
              </a>
            ) : (
              <span className="text-subtle-foreground">None</span>
            ),
          },
          {
            label: "Owner",
            value: owner ? (
              <>
                <UserAvatar name={owner.name} size="xs" />
                <span className="truncate font-medium">{owner.name}</span>
              </>
            ) : (
              <span className="font-medium">Unassigned</span>
            ),
          },
          { label: "Last updated", value: <span className="font-medium">{formatDate(account.updatedAt)}</span> },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList aria-label="Account sections">
            {[
              { v: "contacts", l: "Contacts", n: contacts.length },
              { v: "structure", l: "Structure", n: branches.length || undefined },
              { v: "activity", l: "Interactions", n: activities.filter((a) => a.occurredAt).length },
              { v: "deals", l: "Deals", n: deals.length },
              ...(caps.viewHistory ? [{ v: "history", l: "History", n: undefined }] : []),
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v}>
                {t.l}
                {!!t.n && <span className="text-xs font-normal text-subtle-foreground tabular-nums">{t.n}</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="contacts">
            {contacts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card">
                <EmptyState
                  icon={Users}
                  title={hiddenContacts > 0 ? "No contacts you can see" : "No contacts at this account"}
                  description={hiddenContacts > 0 ? `${hiddenContacts} contact${hiddenContacts === 1 ? " is" : "s are"} owned by people outside your access.` : "Contacts belong to one account. Branch contacts are listed on the branch."}
                  action={caps.addContact ? <Button asChild variant="outline"><Link href={`/contacts/new?accountId=${account.id}`}>Add contact</Link></Button> : undefined}
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
                {contacts.map((c) => {
                  const email = primaryMethod(c, "email")?.value;
                  const phone = primaryMethod(c, "phone")?.value;
                  return (
                    <li key={c.id}>
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f8fbfc] focus-visible:bg-brand-50/60 focus-visible:outline-none">
                        <UserAvatar name={c.displayName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">{[c.jobTitle, email ?? phone].filter(Boolean).join(" · ") || "No details"}</p>
                        </div>
                        <span className="hidden text-xs text-muted-foreground sm:block">{c.ownerId ? users.get(c.ownerId)?.name : "Unassigned"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {hiddenContacts > 0 && contacts.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{hiddenContacts} more contact{hiddenContacts === 1 ? " is" : "s are"} outside your access.</p>}
          </TabsContent>

          <TabsContent value="structure" className="space-y-3">
            <p className="text-sm text-muted-foreground">How this organisation is structured. Each branch keeps its own contacts, owner and billing details; nothing is inherited.</p>
            <ul className="rounded-2xl border border-border bg-card p-2">
              <Tree node={root} all={accounts} currentId={account.id} />
            </ul>
          </TabsContent>

          <TabsContent value="activity" className="space-y-3">
            <p className="text-sm text-muted-foreground">Calls, notes, meetings and messages with this account&apos;s contacts.</p>
            <ActivityTimeline activities={activities} users={users} title="Interactions" />
          </TabsContent>

          <TabsContent value="deals">
            <RelatedDeals deals={deals} newHref={hasPermission(user, "deals.manage") ? `/deals/new?accountId=${account.id}` : undefined} />
          </TabsContent>

          {caps.viewHistory && (
            <TabsContent value="history">
              <AuditHistory contactId={account.id} users={users} noun="account" />
            </TabsContent>
          )}
        </Tabs>

        <aside className="flex flex-col gap-4" aria-label="Account information">
          <Card title="Contact details">
            <ul className="space-y-2 text-sm">
              {account.phone ? (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 text-subtle-foreground" />
                  <a href={`tel:${account.phone.replace(/\s/g, "")}`} className="hover:underline">
                    {account.phone}
                  </a>
                </li>
              ) : null}
              {account.email ? (
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 text-subtle-foreground" />
                  <a href={`mailto:${account.email}`} className="truncate hover:underline">
                    {account.email}
                  </a>
                </li>
              ) : null}
              {account.website ? (
                <li className="flex items-center gap-2.5">
                  <Globe className="size-4 text-subtle-foreground" />
                  <span className="truncate">{account.website}</span>
                </li>
              ) : null}
              {!account.phone && !account.email && !account.website && <li className="text-muted-foreground">No phone, email or website.</li>}
            </ul>
          </Card>
          <Card title="Business">
            <Rows
              rows={[
                ["Account number", account.accountNumber],
                ["Industry", account.industry],
                ["Ownership", account.ownership ? ACCOUNT_OWNERSHIP_LABELS[account.ownership] : ""],
                ["Employees", account.employees?.toLocaleString()],
                ["Size", account.size ? ACCOUNT_SIZE_LABELS[account.size] : ""],
                ["Annual revenue", account.annualRevenue ? formatMoney(account.annualRevenue) : ""],
              ]}
            />
          </Card>
          <Card title="Addresses">
            <Rows rows={[["Billing", fmtAddress(account.billingAddress)], ["Shipping", account.shippingAddress ? fmtAddress(account.shippingAddress) : account.billingAddress ? "Same as billing" : ""]]} />
          </Card>
          <Card title="Tags and notes">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1">
                {account.tags.length ? account.tags.map((t) => <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{t}</span>) : <span className="text-subtle-foreground">No tags</span>}
              </div>
              {account.notes && <p className="whitespace-pre-line">{account.notes}</p>}
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
