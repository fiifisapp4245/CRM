"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RowSelectionState } from "@tanstack/react-table";
import { Archive, ArchiveRestore, Bookmark, CopyCheck, MoreHorizontal, Plus, Search, Trash2, Upload, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/features/permissions";
import { hasPermission, canWriteRecord } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { FilterChips } from "@/components/data-table/filter-chips";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, InlineNotice, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { tabListClass, tabTriggerActiveClass, tabTriggerClass } from "@/components/ui/tabs";
import { useAccountLookup, useDb, useFilterOwners, useUserLookup, useVisibleContacts } from "../hooks/use-contacts";
import { useContactsUi } from "../hooks/use-contacts-ui";
import { allTags, builtInViews, DEFAULT_FILTERS, filterContacts, UNASSIGNED } from "../lib/filters";
import { findDuplicateGroups } from "../lib/duplicates";
import { archiveContacts, deleteView, restoreContacts, saveView } from "../services/contacts-service";
import { SOURCE_LABELS, type Contact, type ContactFilters, type ContactSource, type SavedView } from "../types";
import { contactColumns } from "./contacts-table-columns";
import { ExportMenu } from "./export-menu";
import { ReassignDialog } from "./reassign-dialog";

const SORT_LABELS: Record<ContactFilters["sort"], string> = { recent: "Recently changed", name: "Name (A–Z)", newest: "Newest first" };

/** Keyed by user so selection and transient UI state never leak across a role switch. */
export function ContactsListPage() {
  const user = useCurrentUser();
  return <ContactsList key={user.id} />;
}

function ContactsList() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useCurrentUser();
  const db = useDb();
  const contacts = useVisibleContacts();
  const users = useUserLookup();
  const accounts = useAccountLookup();
  const filterOwners = useFilterOwners();
  const { activeViewId, filters, setView, setFilters, pageIndex, pageSize, setPage } = useContactsUi();

  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [reassignIds, setReassignIds] = useState<string[] | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Contact[] | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 250); // simulated first fetch
    return () => clearTimeout(t);
  }, []);

  const views: SavedView[] = useMemo(() => {
    const builtIn = builtInViews(user).filter((v) => v.builtIn !== "mine" || hasPermission(user, "contacts.create") || contacts.some((c) => c.ownerId === user.id));
    return [...builtIn, ...db.savedViews.filter((v) => v.ownerUserId === user.id)];
  }, [user, db.savedViews, contacts]);

  // Deep links: /contacts?view=mine, /contacts?owner=u_naa
  useEffect(() => {
    const v = params.get("view");
    const owner = params.get("owner");
    if (!v && !owner) return;
    const view = views.find((x) => x.builtIn === (v ?? "all") || x.id === v);
    if (view) setView(view.id, view.filters);
    if (owner) setFilters({ ownerIds: [owner] });
    router.replace("/contacts");
  }, [params, views, setView, setFilters, router]);

  // If the active view no longer exists for this role (e.g. after switching roles) fall back to All.
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];
  useEffect(() => {
    if (activeView.id !== activeViewId) setView(activeView.id, activeView.filters);
  }, [activeView, activeViewId, setView]);

  const filtered = useMemo(
    () => filterContacts(contacts, filters, { accounts: db.accounts, recentOnly: activeView.builtIn === "recent" }),
    [contacts, filters, db.accounts, activeView.builtIn],
  );
  const selected = useMemo(() => filtered.filter((c) => selection[c.id]), [filtered, selection]);
  const tags = useMemo(() => allTags(contacts), [contacts]);
  const duplicateGroups = useMemo(() => (hasPermission(user, "contacts.merge") ? findDuplicateGroups(contacts, db.dismissedDuplicatePairs) : []), [user, contacts, db.dismissedDuplicatePairs]);

  const viewDirty = JSON.stringify(filters) !== JSON.stringify(activeView.filters);

  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
  const writable = (c: Contact) => canWriteRecord(user, c, db.users);
  const rowActions = {
    canEdit: (c: Contact) => c.status === "active" && can("contacts.edit") && writable(c),
    canArchive: (c: Contact) => c.status === "active" && can("contacts.archive") && writable(c),
    canRestore: (c: Contact) => c.status === "archived" && can("contacts.restore") && writable(c),
    canReassign: (c: Contact) => c.status === "active" && can("contacts.reassign") && writable(c),
    onEdit: (c: Contact) => router.push(`/contacts/${c.id}/edit`),
    onArchive: (c: Contact) => setArchiveTarget([c]),
    onRestore: async (c: Contact) => {
      const res = await restoreContacts([c.id]);
      if (res.ok) toast.success(`${c.displayName} restored`);
      else toast.error(res.error);
    },
    onReassign: (c: Contact) => setReassignIds([c.id]),
  };
  const columns = useMemo(() => contactColumns(users, accounts, rowActions), [users, accounts, user, db]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can("contacts.view")) return <PageContainer><PermissionNotice /></PageContainer>;

  const ownerOptions = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...filterOwners.map((u) => ({ value: u.id, label: u.id === user.id ? `${u.name} (you)` : u.name, hint: u.status === "inactive" ? "Inactive" : undefined })),
  ];
  const chips: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.ownerIds.map((id) => ({ key: `o-${id}`, label: `Owner: ${id === UNASSIGNED ? "Unassigned" : (users.get(id)?.name ?? id)}`, onRemove: () => setFilters({ ownerIds: filters.ownerIds.filter((x) => x !== id) }) })),
    ...filters.sources.map((s) => ({ key: `s-${s}`, label: `Source: ${SOURCE_LABELS[s]}`, onRemove: () => setFilters({ sources: filters.sources.filter((x) => x !== s) }) })),
    ...filters.tags.map((t) => ({ key: `t-${t}`, label: `Tag: ${t}`, onRemove: () => setFilters({ tags: filters.tags.filter((x) => x !== t) }) })),
    ...(filters.statuses.join() !== "active" ? [{ key: "st", label: `Status: ${filters.statuses.length ? filters.statuses.map((s) => (s === "active" ? "Active" : "Archived")).join(", ") : "Any"}`, onRemove: () => setFilters({ statuses: ["active"] }) }] : []),
  ];

  const selectedArchivable = selected.filter(rowActions.canArchive);
  const selectedRestorable = selected.filter(rowActions.canRestore);
  const selectedReassignable = selected.filter(rowActions.canReassign);

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description="The people your organisation has a relationship with. Find someone, see what's happening with them, and follow up."
        actions={
          <>
            {can("contacts.import") && (
              <Button variant="outline" asChild>
                <Link href="/contacts/import">
                  <Upload /> Import
                </Link>
              </Button>
            )}
            {can("contacts.export") && <ExportMenu filtered={filtered} selected={selected} allPermitted={contacts} />}
            {can("contacts.merge") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More contact tools">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/contacts/duplicates">
                      <CopyCheck /> Review duplicates
                      {duplicateGroups.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{duplicateGroups.length}</span>}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {can("contacts.create") && (
              <Button asChild>
                <Link href="/contacts/new">
                  <Plus /> New contact
                </Link>
              </Button>
            )}
          </>
        }
      />

      {!can("contacts.create") && !can("contacts.edit") && (
        <InlineNotice tone="neutral">You have read-only access. You can search and open contacts but not change them.</InlineNotice>
      )}

      {duplicateGroups.length > 0 && (
        <InlineNotice tone="warning" icon={CopyCheck}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="font-medium">{duplicateGroups.length} possible duplicate {duplicateGroups.length === 1 ? "group" : "groups"}</strong> share an email or phone number.
            </span>
            <Link href="/contacts/duplicates" className="font-medium underline underline-offset-4">
              Review duplicates
            </Link>
          </span>
        </InlineNotice>
      )}

      <div className="flex flex-col gap-4">
        {/* Views */}
        <div className={tabListClass} role="tablist" aria-label="Contact views">
          {views.map((v) => (
            <div key={v.id} className="flex shrink-0 items-center">
              <button
                role="tab"
                aria-selected={v.id === activeView.id}
                onClick={() => setView(v.id, v.filters)}
                className={cn(tabTriggerClass, v.id === activeView.id && tabTriggerActiveClass)}
              >
                {!v.builtIn && <Bookmark className="size-3.5" />}
                {v.name}
              </button>
              {!v.builtIn && v.id === activeView.id && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete view ${v.name}`}
                  onClick={async () => {
                    await deleteView(v.id);
                    setView("view_all", DEFAULT_FILTERS);
                    toast.success(`View “${v.name}” deleted`);
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Search name, email, phone, company" label="Search contacts" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPopover label="Owner" options={ownerOptions} selected={filters.ownerIds} onChange={(ownerIds) => setFilters({ ownerIds })} searchable />
            <FilterPopover label="Source" options={(Object.keys(SOURCE_LABELS) as ContactSource[]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} selected={filters.sources} onChange={(v) => setFilters({ sources: v as ContactSource[] })} />
            <FilterPopover label="Status" options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} selected={filters.statuses} baseline={activeView.filters.statuses} onChange={(v) => setFilters({ statuses: v as ContactFilters["statuses"] })} />
            <FilterPopover label="Tags" options={tags.map((t) => ({ value: t, label: t }))} selected={filters.tags} onChange={(v) => setFilters({ tags: v })} searchable />
            <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as ContactFilters["sort"] })}>
              <SelectTrigger className="w-auto min-w-44 px-3.5" aria-label="Sort contacts">
                <span className="text-muted-foreground">Sort:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <FilterChips chips={chips}>
          {viewDirty && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setView(activeView.id, activeView.filters)}>
                Reset filters
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}>
                <Bookmark /> Save as view
              </Button>
            </>
          )}
        </FilterChips>

        {selected.length > 0 && (
          <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-2 self-start rounded-xl bg-foreground py-1.5 pr-1.5 pl-5 text-sm text-white shadow-md" role="region" aria-label="Bulk actions">
            <span className="font-medium tabular-nums">{selected.length} selected</span>
            <span className="mx-1.5 h-4 w-px bg-white/20" aria-hidden />
            {can("contacts.reassign") && selectedReassignable.length > 0 && (
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setReassignIds(selectedReassignable.map((c) => c.id))}>
                <UserCog /> Change owner
              </Button>
            )}
            {selectedArchivable.length > 0 && (
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setArchiveTarget(selectedArchivable)}>
                <Archive /> Archive
              </Button>
            )}
            {selectedRestorable.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={async () => {
                  const res = await restoreContacts(selectedRestorable.map((c) => c.id));
                  if (!res.ok) return toast.error(res.error);
                  toast.success(`${res.data.changed} restored`);
                  setSelection({});
                }}
              >
                <ArchiveRestore /> Restore
              </Button>
            )}
            {selectedArchivable.length + selectedRestorable.length + selectedReassignable.length === 0 && (
              <span className="text-white/70">You can export these, but not change them.</span>
            )}
            <Button size="sm" variant="secondary" className="ml-2 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelection({})}>
              Clear
            </Button>
          </div>
        )}

        <DataTable
          label="Contacts"
          columns={columns}
          data={filtered}
          getRowId={(c) => c.id}
          rowLabel={(c) => c.displayName}
          loading={loading}
          selectable={can("contacts.export") || can("contacts.archive") || can("contacts.reassign")}
          rowSelection={selection}
          onRowSelectionChange={setSelection}
          pagination={{ pageIndex, pageSize }}
          onPaginationChange={(updater) => {
            const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
            setPage(next.pageIndex, next.pageSize);
          }}
          onRowClick={(c) => router.push(`/contacts/${c.id}`)}
          empty={
            contacts.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No contacts yet"
                description="Add people one at a time or import a spreadsheet."
                action={
                  <>
                    {can("contacts.create") && <Button asChild><Link href="/contacts/new">New contact</Link></Button>}
                    {can("contacts.import") && <Button variant="outline" asChild><Link href="/contacts/import">Import</Link></Button>}
                  </>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No contacts match"
                description={filters.search ? `Nothing matches “${filters.search}” with the current filters.` : "Try removing a filter or switching view."}
                action={<Button variant="outline" onClick={() => setView("view_all", DEFAULT_FILTERS)}>Show all contacts</Button>}
              />
            )
          }
        />
      </div>

      <ReassignDialog
        open={!!reassignIds}
        onOpenChange={(o) => !o && setReassignIds(null)}
        contactIds={reassignIds ?? []}
        currentOwnerId={reassignIds?.length === 1 ? contacts.find((c) => c.id === reassignIds[0])?.ownerId : undefined}
        subject={reassignIds?.length === 1 ? (contacts.find((c) => c.id === reassignIds[0])?.displayName ?? "this contact") : `${reassignIds?.length ?? 0} contacts`}
        onDone={() => setSelection({})}
      />
      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={archiveTarget?.length === 1 ? `Archive ${archiveTarget[0].displayName}?` : `Archive ${archiveTarget?.length} contacts?`}
        description="Archived contacts are hidden from everyday lists and can't be edited, but their history is kept. You can restore them from the Archived view."
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          const res = await archiveContacts(archiveTarget!.map((c) => c.id));
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.data.changed === 1 ? "Contact archived" : `${res.data.changed} contacts archived`, {
            action: { label: "Undo", onClick: () => restoreContacts(archiveTarget!.map((c) => c.id)).then((r) => (r.ok ? toast.success("Restored") : toast.error(r.error))) },
          });
          setSelection({});
        }}
      />
      <SaveViewDialog open={saveOpen} onOpenChange={setSaveOpen} onSave={async (name) => {
        const res = await saveView(name, filters);
        if (!res.ok) return toast.error(res.error);
        setView(res.data.id, res.data.filters);
        toast.success(`View “${res.data.name}” saved`);
        setSaveOpen(false);
      }} />
    </PageContainer>
  );
}

function SaveViewDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (name: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <SaveViewForm onCancel={() => onOpenChange(false)} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}

function SaveViewForm({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name);
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>Saves the current search, filters and sort. Only you can see your saved views.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="view-name">Name</Label>
            <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Kumasi wholesale" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Save view</Button>
          </DialogFooter>
        </form>
  );
}
