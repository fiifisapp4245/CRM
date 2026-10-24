"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, CheckSquare, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, PhoneCall, StickyNote, UserCog } from "lucide-react";
import { formatPhone } from "@/lib/utils/normalize";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils/format";
import { Breadcrumbs, PageContainer } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ProfileBanner } from "@/components/shared/profile-banner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityComposer, type ComposerKind } from "@/features/activities/components/activity-composer";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { UpNext } from "@/features/activities/components/up-next";
import { useAccountLookup, useDb, useUserLookup } from "../hooks/use-contacts";
import type { ContactCapabilities } from "../lib/access";
import { archiveContacts, restoreContacts } from "../services/contacts-service";
import type { Contact } from "../types";
import { AuditHistory } from "./audit-history";
import { ContactStatusBadge } from "./contact-badges";
import { AboutCard, ContactMethodsCard } from "./contact-details-card";
import { ConsentPanel } from "./consent-panel";
import { ReassignDialog } from "./reassign-dialog";
import { TicketsList } from "./related-panels";
import { LinkedDocuments } from "@/features/documents/components/linked-documents";
import { RelatedDeals } from "@/features/sales/components/related-deals";
import { visibleDeals } from "@/features/sales/lib/access";
import { hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { SendMessageDialog } from "@/features/messaging/components/send-message-dialog";
import { useFeatureGate } from "@/components/entitlements/upgrade";

export function ContactDetailPage({ contact, caps }: { contact: Contact; caps: ContactCapabilities }) {
  const router = useRouter();
  const db = useDb();
  const users = useUserLookup();
  const accounts = useAccountLookup();
  const activities = useMemo(() => db.activities.filter((a) => a.contactId === contact.id), [db.activities, contact.id]);
  const messages = useMemo(() => activities.filter((a) => a.type === "message" || a.type === "email"), [activities]);
  const viewer = useCurrentUser();
  const deals = useMemo(() => visibleDeals(db, viewer).filter((d) => d.contactId === contact.id), [db, viewer, contact.id]);
  const tickets = useMemo(() => db.tickets.filter((t) => t.contactId === contact.id), [db.tickets, contact.id]);
  const [composer, setComposer] = useState<ComposerKind>("note");
  const [focusKey, setFocusKey] = useState(0);
  const [tab, setTab] = useState("activity");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const messaging = useFeatureGate("messaging");
  const openMessage = messaging.guard(() => setMessageOpen(true));

  const owner = contact.ownerId ? users.get(contact.ownerId) : undefined;
  const account = contact.accountId ? accounts.get(contact.accountId) : undefined;
  const openCount = activities.filter((a) => a.status === "open").length;
  const tabs = [
    { value: "activity", label: "Activity", count: activities.filter((a) => a.occurredAt).length },
    { value: "deals", label: "Deals", count: deals.length },
    { value: "messages", label: "Messages", count: messages.length },
    { value: "tickets", label: "Tickets", count: tickets.length },
    { value: "files", label: "Files", count: db.documents.filter((d) => !d.deletedAt && d.links.some((l) => l.kind === "contact" && l.id === contact.id)).length },
    ...(caps.viewAudit ? [{ value: "history", label: "History", count: undefined }] : []),
  ];
  const primaryPhone = contact.methods.find((m) => m.kind === "phone" && m.isPrimary) ?? contact.methods.find((m) => m.kind === "phone");
  const primaryEmail = contact.methods.find((m) => m.kind === "email" && m.isPrimary) ?? contact.methods.find((m) => m.kind === "email");

  const startComposer = (k: ComposerKind) => {
    setTab("activity");
    setComposer(k);
    setFocusKey((n) => n + 1);
    requestAnimationFrame(() => document.getElementById("composer")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const restore = async () => {
    const res = await restoreContacts([contact.id]);
    if (res.ok) toast.success(`${contact.displayName} restored`);
    else toast.error(res.error);
  };

  return (
    <PageContainer>
      <div className="-mb-2">
        <Breadcrumbs items={[{ label: "Contacts", href: "/contacts" }, { label: contact.displayName }]} />
      </div>

      <ProfileBanner
        muted={contact.status !== "active"}
        media={<UserAvatar name={contact.displayName} size="2xl" muted={contact.status !== "active"} className="ring-4 ring-card" />}
        actions={
          <>
          {caps.logActivity && (
            <>
              <Button variant="outline" onClick={() => startComposer("call")}>
                <PhoneCall /> Log call
              </Button>
              <Button variant="outline" onClick={() => startComposer("note")}>
                <StickyNote /> Note
              </Button>
              <Button variant="outline" onClick={() => startComposer("task")}>
                <CheckSquare /> Task
              </Button>
            </>
          )}
          {caps.edit && (
            <Button asChild>
              <Link href={`/contacts/${contact.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          {(caps.logActivity || caps.sendMessage || caps.reassign || caps.archive || caps.restore) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {caps.logActivity && (
                  <DropdownMenuItem onSelect={() => startComposer("meeting")}>
                    <CalendarPlus /> Schedule meeting
                  </DropdownMenuItem>
                )}
                {caps.sendMessage && (
                  <DropdownMenuItem onSelect={openMessage}>
                    <MessageSquare /> Send message
                  </DropdownMenuItem>
                )}
                {caps.reassign && (
                  <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
                    <UserCog /> Change owner
                  </DropdownMenuItem>
                )}
                {caps.restore && (
                  <DropdownMenuItem onSelect={restore}>
                    <ArchiveRestore /> Restore
                  </DropdownMenuItem>
                )}
                {caps.archive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setArchiveOpen(true)}>
                      <Archive /> Archive
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </>
        }
        title={
          <>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
              {contact.title && <span className="font-normal text-muted-foreground">{contact.title} </span>}
              {contact.displayName}
            </h1>
            <ContactStatusBadge status={contact.status} />
          </>
        }
        subtitle={
          <>
            {contact.jobTitle}
            {contact.jobTitle && account && " · "}
            {account && (
              <Link href={`/accounts/${account.id}`} className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
                {account.name}
              </Link>
            )}
            {!contact.jobTitle && !account && "No company or job title yet"}
          </>
        }
        facts={[
          {
            label: "Phone",
            value: primaryPhone ? (
              <a href={`tel:${primaryPhone.value.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                <Phone className="size-3.5 text-subtle-foreground" /> {formatPhone(primaryPhone.value)}
              </a>
            ) : (
              <span className="text-subtle-foreground">None</span>
            ),
          },
          {
            label: "Email",
            value: primaryEmail ? (
              <a href={`mailto:${primaryEmail.value}`} className="inline-flex max-w-full min-w-0 items-center gap-1.5 font-medium hover:underline">
                <Mail className="size-3.5 shrink-0 text-subtle-foreground" /> <span className="truncate">{primaryEmail.value}</span>
              </a>
            ) : (
              <span className="text-subtle-foreground">None</span>
            ),
          },
          {
            label: "Owner",
            value: (
              <>
                {owner ? (
                  <>
                    <UserAvatar name={owner.name} size="xs" muted={owner.status !== "active"} />
                    <span className="truncate font-medium">{owner.name}</span>
                    {owner.status === "inactive" && <span className="text-warning">(inactive)</span>}
                  </>
                ) : (
                  <span className="font-medium">Unassigned</span>
                )}
                {caps.reassign && (
                  <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setReassignOpen(true)}>
                    Change
                  </Button>
                )}
              </>
            ),
          },
          { label: "Last activity", value: <span className="font-medium">{contact.lastActivityAt ? formatRelative(contact.lastActivityAt) : "Never"}</span> },
        ]}
      />

      {contact.status === "archived" && (
        <InlineNotice tone="neutral" icon={Archive}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Archived {formatRelative(contact.archivedAt)}
              {contact.archivedBy && ` by ${users.get(contact.archivedBy)?.name ?? "someone"}`}. It&apos;s read-only until restored.
            </span>
            {caps.restore && (
              <Button size="sm" variant="outline" onClick={restore}>
                <ArchiveRestore /> Restore
              </Button>
            )}
          </span>
        </InlineNotice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main workspace */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="upnext-heading">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 id="upnext-heading" className="text-[0.9375rem] font-semibold">
                Up next {openCount > 0 && <span className="font-normal text-muted-foreground">{openCount}</span>}
              </h2>
            </div>
            <div className="p-4">
              <UpNext
                activities={activities}
                users={users}
                canComplete={caps.logActivity}
                emptyAction={caps.logActivity ? <Button size="sm" variant="outline" onClick={() => startComposer("task")}>Create a task</Button> : undefined}
              />
            </div>
          </section>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Contact sections">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {!!t.count && <span className="text-xs font-normal text-subtle-foreground tabular-nums">{t.count}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="activity" className="flex flex-col gap-5">
              {caps.logActivity && (
                <div id="composer">
                  <ActivityComposer contactId={contact.id} contactName={contact.displayName} ownerId={contact.ownerId} kind={composer} onKindChange={setComposer} focusKey={focusKey} />
                </div>
              )}
              <ActivityTimeline
                activities={activities}
                users={users}
                emptyAction={caps.logActivity ? <Button size="sm" variant="outline" onClick={() => startComposer("call")}>Log a call</Button> : undefined}
              />
            </TabsContent>
            <TabsContent value="deals">
              <RelatedDeals deals={deals} newHref={contact.status === "active" && hasPermission(viewer, "deals.manage") ? `/deals/new?contactId=${contact.id}` : undefined} />
            </TabsContent>
            <TabsContent value="messages" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">SMS, WhatsApp and email sent to this contact. Marketing needs recorded permission for the channel.</p>
                {caps.sendMessage && (
                  <Button size="sm" variant="outline" onClick={openMessage}>
                    <MessageSquare /> Send message
                  </Button>
                )}
              </div>
              <ActivityTimeline activities={messages} users={users} title="Messages" />
            </TabsContent>
            <TabsContent value="tickets">
              <TicketsList tickets={tickets} newHref={`/tickets/new?contactId=${contact.id}`} />
            </TabsContent>
            <TabsContent value="files">
              <LinkedDocuments link={{ kind: "contact", id: contact.id }} />
            </TabsContent>
            {caps.viewAudit && (
              <TabsContent value="history">
                <p className="mb-3 text-sm text-muted-foreground">Changes made to this record in the CRM, including syncs and imports. Conversations are under Activity.</p>
                <AuditHistory contactId={contact.id} users={users} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Related information */}
        <aside className="flex flex-col gap-4" aria-label="Contact information">
          <ContactMethodsCard contact={contact} />
          <ConsentPanel contactId={contact.id} contactName={contact.displayName} users={users} canRecord={caps.recordConsent} canViewEvidence={caps.viewEvidence} />
          <AboutCard contact={contact} users={users} accounts={accounts} />
        </aside>
      </div>

      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} contactIds={[contact.id]} currentOwnerId={contact.ownerId} subject={contact.displayName} />
      <SendMessageDialog open={messageOpen} onOpenChange={setMessageOpen} contact={contact} />
      {messaging.dialog}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${contact.displayName}?`}
        description="They'll be hidden from everyday lists and can't be edited. Their history, preferences and related records are kept, and you can restore them later."
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          const res = await archiveContacts([contact.id]);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${contact.displayName} archived`, { action: { label: "Undo", onClick: () => void restoreContacts([contact.id]) } });
          router.refresh();
        }}
      />
    </PageContainer>
  );
}
