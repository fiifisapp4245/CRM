"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyCheck, Plus, Search, Upload, User } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { hasPermission } from "@/lib/permissions";
import { visibleContacts } from "@/features/contacts/lib/access";
import { DEFAULT_FILTERS, filterContacts, primaryMethod } from "@/features/contacts/lib/filters";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { Kbd } from "@/components/shared/kbd";
import { useVisibleNav } from "./sidebar";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const nav = useVisibleNav();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const contacts = useMemo(() => {
    if (!query.trim()) return [];
    return filterContacts(visibleContacts(db, user), { ...DEFAULT_FILTERS, statuses: [], search: query }, { accounts: db.accounts }).slice(0, 8);
  }, [db, user, query]);

  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const actions = [
    { label: "New contact", href: "/contacts/new", icon: Plus, show: hasPermission(user, "contacts.create") },
    { label: "Import contacts", href: "/contacts/import", icon: Upload, show: hasPermission(user, "contacts.import") },
    { label: "Review duplicates", href: "/contacts/duplicates", icon: CopyCheck, show: hasPermission(user, "contacts.merge") },
  ].filter((a) => a.show && matches(a.label));
  const pages = nav.flatMap((g) => g.items).filter((i) => matches(i.label));

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-md cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Search contacts and pages"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search contacts, pages…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search contacts and pages" className="sm:max-w-xl">
        {/* Filtering is done by our own matcher (phone normalisation etc.), so cmdk's filter is disabled. */}
        <Command shouldFilter={false}>
        <CommandInput placeholder="Name, email, phone or company…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results for “{query}”.</CommandEmpty>
          {contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {contacts.map((c) => {
                const email = primaryMethod(c, "email")?.value;
                const phone = primaryMethod(c, "phone")?.value;
                return (
                  <CommandItem key={c.id} value={`contact-${c.id}`} onSelect={() => go(`/contacts/${c.id}`)}>
                    <User className="text-muted-foreground" />
                    <span className="truncate font-medium">{c.displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{email ?? phone ?? ""}</span>
                    {c.status === "archived" && <CommandShortcut>Archived</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {actions.length > 0 && (
            <CommandGroup heading="Actions">
              {actions.map((a) => (
                <CommandItem key={a.href} value={a.href} onSelect={() => go(a.href)}>
                  <a.icon className="text-muted-foreground" /> {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {pages.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Go to">
                {pages.map((item) => (
                  <CommandItem key={item.href} value={`page:${item.href}`} onSelect={() => go(item.href)}>
                    <item.icon className="text-muted-foreground" /> {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
