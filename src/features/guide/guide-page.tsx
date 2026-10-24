"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Info, Search } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState } from "@/components/feedback/states";
import { GUIDE } from "./content";

/** Help guide: a searchable list of short how-tos, grouped like the sidebar. */
export function GuidePage() {
  const [q, setQ] = useState("");
  const sections = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return GUIDE;
    return GUIDE.map((sec) => ({ ...sec, topics: sec.topics.filter((t) => [t.title, t.summary, ...(t.steps ?? []), ...(t.notes ?? [])].join(" ").toLowerCase().includes(s)) })).filter((sec) => sec.topics.length);
  }, [q]);
  const count = sections.reduce((n, s) => n + s.topics.length, 0);

  return (
    <PageContainer>
      <PageHeader title="Guide" description="Short how-tos for everyday work in the CRM. Each one links to the page where you do it." />
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Guide contents">
          <div className="mb-4">
            <SearchField value={q} onChange={setQ} placeholder="Search the guide" label="Search the guide" />
          </div>
          <nav className="hidden lg:block">
            <ul className="space-y-4 text-sm">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} className="font-medium text-foreground hover:underline">
                    {sec.title}
                  </a>
                  <ul className="mt-1.5 space-y-1 border-l border-border pl-3">
                    {sec.topics.map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`} className="block py-0.5 text-muted-foreground hover:text-foreground">
                          {t.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          {q && (
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
              {count} topic{count === 1 ? "" : "s"} match “{q}”
            </p>
          )}
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState icon={Search} title="Nothing in the guide matches" description="Try a simpler word, such as deal, call or file." />
            </div>
          ) : (
            <div className="space-y-12">
              {sections.map((sec) => (
                <section key={sec.id} id={sec.id} aria-labelledby={`${sec.id}-h`} className="scroll-mt-24">
                  <h2 id={`${sec.id}-h`} className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
                    <BookOpen className="size-4 text-brand-700" /> {sec.title}
                  </h2>
                  <div className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
                    {sec.topics.map((t) => (
                      <article key={t.id} id={t.id} className="scroll-mt-24 px-6 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-[0.9375rem] font-semibold">{t.title}</h3>
                          {t.link && (
                            <Link href={t.link.href} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                              {t.link.label} <ArrowRight className="size-3.5" />
                            </Link>
                          )}
                        </div>
                        <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{t.summary}</p>
                        {t.steps && (
                          <ol className="mt-3 max-w-[68ch] list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
                            {t.steps.map((s, i) => (
                              <li key={i} className="pl-1">
                                {s}
                              </li>
                            ))}
                          </ol>
                        )}
                        {t.notes && (
                          <ul className="mt-3 max-w-[68ch] space-y-1 text-sm">
                            {t.notes.map((n, i) => (
                              <li key={i} className="flex gap-2 text-muted-foreground">
                                <Info className="mt-0.5 size-3.5 shrink-0 text-brand-700" /> {n}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
