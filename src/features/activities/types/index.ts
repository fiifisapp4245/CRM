export type ActivityType = "note" | "call" | "meeting" | "visit" | "task" | "email" | "message";

/** What Tasks & Calls calls a "kind": messages split by channel. */
export type ActivityKind = "task" | "call" | "meeting" | "visit" | "note" | "email" | "sms" | "whatsapp";

export type CallOutcome = "connected" | "no_answer" | "left_voicemail" | "wrong_number" | "busy";
export type Priority = "low" | "normal" | "high";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
/** "default" = business default; "none"; or minutes before the start (0 = at the time). */
export type Reminder = "default" | "none" | number;

export interface Activity {
  id: string;
  orgId: string;
  /** null for internal work not about one customer (e.g. "Prepare stock count"). */
  contactId: string | null;
  /** Set when the interaction was logged against a deal. */
  dealId?: string;
  accountId?: string;
  type: ActivityType;
  subject: string;
  body?: string;
  /** When the interaction happened (logged / completed). */
  occurredAt?: string;
  /** Planned start for tasks, calls, meetings and visits. */
  dueAt?: string;
  /** Planned end (calendar). Duration = endAt − dueAt. */
  endAt?: string;
  /** Planned items: open until completed. Logged items have no status. */
  status?: "open" | "done" | "cancelled";
  completedAt?: string;
  priority?: Priority;
  reminder?: Reminder;
  smsReminder?: boolean;
  recurrence?: Recurrence;
  location?: string;
  attendeeIds?: string[];
  callOutcome?: CallOutcome;
  direction?: "inbound" | "outbound";
  durationMinutes?: number;
  /** Messages only. */
  channel?: "sms" | "whatsapp" | "email";
  messagePurpose?: "marketing" | "operational";
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  visit: "Visit",
  task: "Task",
  email: "Email",
  message: "Message",
};

export const KIND_LABELS: Record<ActivityKind, string> = {
  task: "Task",
  call: "Call",
  meeting: "Meeting",
  visit: "Visit",
  note: "Note",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/** Labels follow the reference "What happened" options. */
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Answered",
  no_answer: "No answer",
  busy: "Busy",
  left_voicemail: "Left a message",
  wrong_number: "Wrong number",
};

export const DIRECTION_LABELS = { outbound: "We contacted them", inbound: "They contacted us" } as const;
export const PRIORITY_LABELS: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High" };
export const RECURRENCE_LABELS: Record<Recurrence, string> = { none: "Doesn't repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Business default" },
  { value: "none", label: "None" },
  { value: "0", label: "At time" },
  { value: "5", label: "5 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "60 minutes before" },
  { value: "1440", label: "1 day before" },
];
