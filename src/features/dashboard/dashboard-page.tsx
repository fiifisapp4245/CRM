"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CopyCheck, FileWarning, ShieldCheck, Upload, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { hasPermission, ROLE_DEFINITIONS } from "@/lib/permissions";
import { formatDateTime, formatRelative } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/permissions";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDb, useUserLookup, useVisibleContacts } from "@/features/contacts/hooks/use-contacts";
import { findDuplicateGroups } from "@/features/contacts/lib/duplicates";
import { SOURCE_LABELS, type ContactSource } from "@/features/contacts/types";
import { setActivityStatus } from "@/features/activities/services/activities-service";
import type { Activity } from "@/features/activities/types";
import { useNow } from "@/lib/hooks/use-now";
import { visibleDeals } from "@/features/sales/lib/access";
import { dealAttention, dealValue } from "@/features/sales/lib/calc";
import { AttentionBadge, Money } from "@/features/sales/components/badges";

const DAY = 86_400_000;

function Panel({ title, action, children, className, badge }: { title: string; action?: ReactNode; children: ReactNode; className?: string; badge?: ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-2xl border border-border bg-card shadow-sm", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">{title} {badge}</h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint, href, tone }: { label: string; value: number | string; hint?: string; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[1.625rem] leading-tight font-semibold tracking-tight tabular-nums", tone === "danger" && "text-red-700", tone === "warning" && "text-amber-800")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-border-strong hover:bg-[#fafcfc] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">{body}</div>
  );
}

function TaskList({ tasks, contactName, canComplete, now }: { tasks: Activity[]; contactName: (id: string) => string; canComplete: boolean; now: number }) {
  if (!tasks.length) return <EmptyState compact title="No open follow-ups" description="You're up to date." />;
  return (
    <ul className="divide-y divide-border/70">
      {tasks.slice(0, 8).map((t) => {
        const overdue = new Date(t.dueAt!).getTime() < now;
        return (
          <li key={t.id} className="flex items-start gap-3 px-5 py-3 text-sm">
            {canComplete && (
              <Checkbox
                className="mt-0.5"
                aria-label={`Complete ${t.subject}`}
                onCheckedChange={async (v) => {
                  if (!v) return;
                  const r = await setActivityStatus(t.id, "done");
                  if (r.ok) toast.success("Done", { action: { label: "Undo", onClick: () => setActivityStatus(t.id, "open") } });
                  else toast.error(r.error);
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.subject}</p>
              <p className="text-muted-foreground">
                {t.contactId && <><Link href={`/contacts/${t.contactId}`} className="hover:underline">{contactName(t.contactId)}</Link> · </>}{t.type === "meeting" ? "Meeting " : "Due "}
                <span className={overdue ? "text-red-700" : undefined}>{formatRelative(t.dueAt)}</span>
              </p>
            </div>
            {overdue && <StatusPill tone="danger">Overdue</StatusPill>}
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const db = useDb();
  const users = useUserLookup();
  const contacts = useVisibleContacts();
  const role = ROLE_DEFINITIONS[user.role];
  const now = useNow();

  const data = useMemo(() => {
    const visibleIds = new Set(contacts.map((c) => c.id));
    const name = new Map(contacts.map((c) => [c.id, c.displayName]));
    const acts = db.activities.filter((a) => !!a.contactId && visibleIds.has(a.contactId));
    const open = acts.filter((a) => a.status === "open" && a.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
    const active = contacts.filter((c) => c.status === "active");
    const quiet = active.filter((c) => !c.lastActivityAt || now - new Date(c.lastActivityAt).getTime() > 60 * DAY);
    const team = [user, ...db.users.filter((u) => u.managerId === user.id)];
    return {
      name,
      open,
      mine: active.filter((c) => c.ownerId === user.id),
      myOpen: open.filter((a) => a.assigneeId === user.id),
      quiet,
      active,
      newThisWeek: contacts.filter((c) => now - new Date(c.createdAt).getTime() < 7 * DAY),
      unassigned: active.filter((c) => !c.ownerId),
      inactiveOwner: active.filter((c) => c.ownerId && users.get(c.ownerId)?.status === "inactive"),
      duplicates: hasPermission(user, "contacts.merge") ? findDuplicateGroups(contacts, db.dismissedDuplicatePairs) : [],
      team: team.map((m) => ({
        user: m,
        contacts: active.filter((c) => c.ownerId === m.id).length,
        open: open.filter((a) => a.assigneeId === m.id).length,
        overdue: open.filter((a) => a.assigneeId === m.id && new Date(a.dueAt!).getTime() < now).length,
        recent: acts.filter((a) => a.createdBy === m.id && a.occurredAt && now - new Date(a.occurredAt).getTime() < 7 * DAY).length,
      })),
      deals: visibleDeals(db, user),
      bySource: (Object.keys(SOURCE_LABELS) as ContactSource[]).map((s) => ({ s, n: active.filter((c) => c.source === s).length })),
    };
  }, [contacts, db, user, users, now]);

  const contactName = (id: string) => data.name.get(id) ?? "Contact";
  const canAct = hasPermission(user, "activities.create");
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isManager = user.role === "crm_sales_manager";
  const isAdmin = user.role === "crm_admin" || user.role === "suite_admin";
  const isViewer = user.role === "crm_viewer";

  // Same rules as the Deals list and Forecast (features/sales/lib/calc.ts).
  const attentionDeals = data.deals
    .filter((d) => (d.ownerId === user.id || isManager) && dealAttention(d, now).kind !== "healthy" && d.status === "open")
    .sort((a, b) => a.expectedClose.localeCompare(b.expectedClose));
  const openStages = db.pipelines[0]?.stages.filter((st) => st.kind === "open") ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={
          isViewer
            ? "A read-only summary of the customers you can see."
            : isAdmin
              ? "Data health and administration for your organisation's CRM."
              : isManager
                ? "How your team's customer work is going, and what needs attention."
                : "Your follow-ups and customers for today."
        }
        meta={<p className="text-xs text-muted-foreground">Viewing as {role.label}. Dashboard is a foundation — reporting will be designed after its audit.</p>}
      />

      {/* CRM User */}
      {user.role === "crm_user" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat label="My contacts" value={data.mine.length} href="/contacts?view=mine" />
            <Stat label="Open follow-ups" value={data.myOpen.length} />
            <Stat label="Overdue" value={data.myOpen.filter((a) => new Date(a.dueAt!).getTime() < now).length} tone="danger" />
            <Stat label="Going quiet" value={data.quiet.filter((c) => c.ownerId === user.id).length} hint="No activity in 60 days" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <Panel title="My tasks and meetings">
              <TaskList tasks={data.myOpen} contactName={contactName} canComplete={canAct} now={now} />
            </Panel>
            <Panel title="Deals needing attention">
              {attentionDeals.length ? (
                <ul className="divide-y divide-border/70">
                  {attentionDeals.slice(0, 6).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <Link href={`/deals/${d.id}`} className="block truncate font-medium hover:underline">{d.title}</Link>
                        <p className="truncate text-muted-foreground">{d.contactId ? contactName(d.contactId) : "No contact"} · <Money amount={dealValue(d, db.taxes)} currency={d.currency} /></p>
                      </div>
                      <AttentionBadge {...dealAttention(d, now)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="Nothing urgent" description="None of your open deals are going cold or past their close date." />
              )}
            </Panel>
            <Panel title="Going quiet" action={<Button asChild variant="link" size="sm"><Link href="/contacts?view=mine">All my contacts</Link></Button>} className="lg:col-span-2">
              <QuietList contacts={data.quiet.filter((c) => c.ownerId === user.id).slice(0, 6)} />
            </Panel>
          </div>
        </>
      )}

      {/* Sales manager */}
      {isManager && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat label="Team contacts" value={data.active.length} href="/contacts" />
            <Stat label="Overdue follow-ups" value={data.open.filter((a) => new Date(a.dueAt!).getTime() < now).length} tone="danger" />
            <Stat label="Unassigned" value={data.unassigned.length} href="/contacts?view=unassigned" tone={data.unassigned.length ? "warning" : undefined} />
            <Stat label="Possible duplicates" value={data.duplicates.length} href="/contacts/duplicates" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title="Team activity (last 7 days)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th scope="col" className="px-4 py-2 text-left font-medium">Person</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Contacts</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Interactions</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Open</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.team.map((t) => (
                      <tr key={t.user.id}>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <UserAvatar name={t.user.name} size="sm" muted={t.user.status !== "active"} />
                            {t.user.name}
                            {t.user.status === "inactive" && <StatusPill tone="warning">Inactive</StatusPill>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.contacts}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.recent}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.open}</td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums", t.overdue > 0 && "font-medium text-red-700")}>{t.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Needs your attention">
              <ul className="divide-y divide-border/70 text-sm">
                {data.inactiveOwner.length > 0 && (
                  <li className="flex items-start gap-3 px-5 py-3">
                    <UserX className="mt-0.5 size-4 text-amber-700" />
                    <div className="flex-1">
                      <p className="font-medium">{data.inactiveOwner.length} contacts owned by someone who has left</p>
                      <p className="text-muted-foreground">Reassign them so follow-ups aren&apos;t missed.</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href={`/contacts?owner=${data.inactiveOwner[0].ownerId}`}>Review</Link></Button>
                  </li>
                )}
                {data.unassigned.length > 0 && (
                  <li className="flex items-start gap-3 px-5 py-3">
                    <Users className="mt-0.5 size-4 text-amber-700" />
                    <div className="flex-1">
                      <p className="font-medium">{data.unassigned.length} unassigned contacts</p>
                      <p className="text-muted-foreground">Mostly from MyStoreGuard and LoanDrift syncs.</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href="/contacts?view=unassigned">Assign</Link></Button>
                  </li>
                )}
                {data.duplicates.length > 0 && (
                  <li className="flex items-start gap-3 px-5 py-3">
                    <CopyCheck className="mt-0.5 size-4 text-amber-700" />
                    <div className="flex-1">
                      <p className="font-medium">{data.duplicates.length} possible duplicate groups</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href="/contacts/duplicates">Review</Link></Button>
                  </li>
                )}
                <li className="flex items-start gap-3 px-5 py-3">
                  <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{data.quiet.length} contacts going quiet</p>
                    <p className="text-muted-foreground">No interaction in 60 days.</p>
                  </div>
                </li>
              </ul>
            </Panel>
            <Panel title="Overdue and upcoming follow-ups">
              <TaskList tasks={data.open} contactName={contactName} canComplete={canAct} now={now} />
            </Panel>
            <Panel title="Pipeline by stage">
              <ul className="space-y-2.5 px-5 pt-2 pb-5 text-sm">
                {openStages.map((st) => {
                  const n = data.deals.filter((d) => d.status === "open" && d.stageId === st.id).length;
                  const max = Math.max(1, ...openStages.map((x) => data.deals.filter((d) => d.status === "open" && d.stageId === x.id).length));
                  return (
                    <li key={st.id} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3">
                      <Link href={`/deals?stage=${st.id}`} className="text-muted-foreground hover:text-foreground hover:underline">{st.name}</Link>
                      <span className="h-2 rounded-full bg-muted" aria-hidden>
                        <span className="block h-2 rounded-full bg-brand-600" style={{ width: `${(n / max) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </>
      )}

      {/* Viewer */}
      {isViewer && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat label="Active contacts" value={data.active.length} href="/contacts" />
            <Stat label="Added this week" value={data.newThisWeek.length} href="/contacts?view=recent" />
            <Stat label="Unassigned" value={data.unassigned.length} />
            <Stat label="Archived" value={contacts.filter((c) => c.status === "archived").length} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <Panel title="Contacts by source">
              <SourceBars rows={data.bySource} total={data.active.length} />
            </Panel>
            <Panel title="Recently added">
              <RecentList contacts={[...data.newThisWeek].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)} />
            </Panel>
          </div>
        </>
      )}

      {/* Admins */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat label="Active contacts" value={data.active.length} href="/contacts" />
            <Stat label="Unassigned" value={data.unassigned.length} href="/contacts?view=unassigned" tone={data.unassigned.length ? "warning" : undefined} />
            <Stat label="Owned by inactive users" value={data.inactiveOwner.length} tone={data.inactiveOwner.length ? "warning" : undefined} />
            <Stat label="Possible duplicates" value={data.duplicates.length} href="/contacts/duplicates" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
            <Panel title="Administration">
              <ul className="divide-y divide-border/70 text-sm">
                {[
                  { href: "/contacts/import", icon: Upload, label: "Import contacts", show: hasPermission(user, "contacts.import") },
                  { href: "/contacts/duplicates", icon: CopyCheck, label: "Review duplicates", show: hasPermission(user, "contacts.merge") },
                  { href: "/settings", icon: ShieldCheck, label: "CRM settings (pending audit)", show: hasPermission(user, "settings.view") },
                ]
                  .filter((l) => l.show)
                  .map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="flex items-center gap-3 px-5 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                        <l.icon className="size-4 text-muted-foreground" />
                        <span className="flex-1">{l.label}</span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
              </ul>
              {user.role === "suite_admin" && (
                <p className="border-t px-5 py-3 text-xs text-muted-foreground">
                  Suite administration (users, billing, other apps) lives outside the CRM. In this prototype, Suite Administrators govern CRM data but don&apos;t record consent or customer activity.
                </p>
              )}
            </Panel>
            <Panel title="Recent imports">
              {db.importJobs.length === 0 ? (
                <EmptyState compact title="No imports yet" />
              ) : (
                <ul className="divide-y divide-border/70 text-sm">
                  {db.importJobs.slice(0, 5).map((j) => (
                    <li key={j.id} className="flex items-start gap-3 px-5 py-3">
                      {j.failed ? <FileWarning className="mt-0.5 size-4 text-amber-700" /> : <Upload className="mt-0.5 size-4 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{j.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {users.get(j.actorId)?.name} · {formatDateTime(j.startedAt)} · {j.created} created, {j.failed} failed
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Contacts by source">
              <SourceBars rows={data.bySource} total={data.active.length} />
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function SourceBars({ rows, total }: { rows: { s: ContactSource; n: number }[]; total: number }) {
  return (
    <ul className="space-y-2.5 px-5 pt-2 pb-5 text-sm">
      {rows.map(({ s, n }) => (
        <li key={s} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
          <span className="text-muted-foreground">{SOURCE_LABELS[s]}</span>
          <span className="h-2 rounded-full bg-muted" aria-hidden>
            <span className="block h-2 rounded-full bg-brand-600" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
          </span>
          <span className="text-right tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function QuietList({ contacts }: { contacts: { id: string; displayName: string; lastActivityAt?: string }[] }) {
  if (!contacts.length) return <EmptyState compact title="Every relationship is active" />;
  return (
    <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0">
      {contacts.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
          <UserAvatar name={c.displayName} size="sm" />
          <Link href={`/contacts/${c.id}`} className="flex-1 truncate font-medium hover:underline">{c.displayName}</Link>
          <span className="text-xs text-muted-foreground">{c.lastActivityAt ? `Last ${formatRelative(c.lastActivityAt)}` : "Never contacted"}</span>
        </li>
      ))}
    </ul>
  );
}

function RecentList({ contacts }: { contacts: { id: string; displayName: string; createdAt: string }[] }) {
  if (!contacts.length) return <EmptyState compact title="No new contacts this week" />;
  return (
    <ul className="divide-y divide-border/70">
      {contacts.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
          <UserAvatar name={c.displayName} size="sm" />
          <Link href={`/contacts/${c.id}`} className="flex-1 truncate font-medium hover:underline">{c.displayName}</Link>
          <span className="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
