"use client";

import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONSENT_CHANNELS, consentStatus } from "../lib/consent";
import { CONSENT_CHANNEL_LABELS, CONSENT_METHOD_LABELS, CONSENT_METHODS_BY_DECISION, type ConsentChannel, type ConsentMethod, type ConsentRecord } from "../types";
import { ConsentBadge } from "./contact-badges";

export type InitialConsentDecision = "" | "agreed" | "declined";
export type InitialConsent = Record<ConsentChannel, { decision: InitialConsentDecision; method: ConsentMethod | "" }>;

export const EMPTY_INITIAL_CONSENT: InitialConsent = {
  sms: { decision: "", method: "" },
  whatsapp: { decision: "", method: "" },
  email: { decision: "", method: "" },
  phone: { decision: "", method: "" },
};

const NOT_ASKED = "__not_asked";

export function initialConsentErrors(value: InitialConsent): Partial<Record<ConsentChannel, string>> {
  const errors: Partial<Record<ConsentChannel, string>> = {};
  for (const ch of CONSENT_CHANNELS) if (value[ch].decision && !value[ch].method) errors[ch] = "Say how they told you.";
  return errors;
}

/**
 * Optional marketing-permission capture while creating a contact. Every
 * channel starts at "Not asked"; choosing a decision requires a method, and
 * each choice is saved as its own consent record (same as the profile
 * workflow), so it stays auditable and is never part of a generic edit.
 */
export function ConsentCapture({ value, onChange, errors }: { value: InitialConsent; onChange: (v: InitialConsent) => void; errors: Partial<Record<ConsentChannel, string>> }) {
  const set = (ch: ConsentChannel, patch: Partial<InitialConsent[ConsentChannel]>) => onChange({ ...value, [ch]: { ...value[ch], ...patch } });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Marketing permission per channel. Leave a channel as <strong className="font-medium text-foreground">Not asked</strong> unless the customer has told you. Nothing is assumed.
      </p>
      <div className="divide-y divide-border/70 rounded-xl border border-border">
        {CONSENT_CHANNELS.map((ch) => {
          const v = value[ch];
          return (
            <div key={ch} className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_11rem_1fr] sm:items-start">
              <span className="pt-2 text-sm font-medium">{CONSENT_CHANNEL_LABELS[ch]}</span>
              <Select value={v.decision || NOT_ASKED} onValueChange={(d) => set(ch, { decision: d === NOT_ASKED ? "" : (d as InitialConsentDecision), method: "" })}>
                <SelectTrigger className="w-full" aria-label={`${CONSENT_CHANNEL_LABELS[ch]} marketing permission`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_ASKED}>Not asked</SelectItem>
                  <SelectItem value="agreed">Agreed</SelectItem>
                  <SelectItem value="declined">Refused</SelectItem>
                </SelectContent>
              </Select>
              {v.decision ? (
                <div>
                  <Select value={v.method} onValueChange={(m) => set(ch, { method: m as ConsentMethod })}>
                    <SelectTrigger className="w-full" aria-label={`How they told you about ${CONSENT_CHANNEL_LABELS[ch]}`} aria-invalid={!!errors[ch]}>
                      <SelectValue placeholder="How did they tell you?" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSENT_METHODS_BY_DECISION[v.decision].map((m) => (
                        <SelectItem key={m} value={m}>
                          {CONSENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[ch] && <p className="mt-1 text-sm text-destructive" role="alert">{errors[ch]}</p>}
                </div>
              ) : (
                <span className="hidden pt-2 text-sm text-subtle-foreground sm:block">No permission recorded</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only current status in edit mode; changes go through the profile's dedicated workflow. */
export function ConsentSummary({ contactId, consents }: { contactId: string; consents: ConsentRecord[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {CONSENT_CHANNELS.map((ch) => (
          <span key={ch} className="flex items-center gap-2 text-sm">
            {CONSENT_CHANNEL_LABELS[ch]} <ConsentBadge status={consentStatus(consents, contactId, ch, "marketing")} />
          </span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Marketing permission shown. To record a change, use{" "}
        <Link href={`/contacts/${contactId}`} className="font-medium text-primary underline-offset-4 hover:underline">
          Communication preferences on the profile
        </Link>
        , which keeps the full history and evidence.
      </p>
    </div>
  );
}
