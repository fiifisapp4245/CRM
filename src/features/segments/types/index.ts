import type { ConsentChannel, ConsentPurpose, ContactSource } from "@/features/contacts/types";

export type SegmentCondition =
  | { id: string; kind: "location"; field: "city" | "region" | "country"; values: string[] }
  | { id: string; kind: "source"; values: ContactSource[] }
  | { id: string; kind: "owner"; values: string[] }
  | { id: string; kind: "gender"; values: string[] }
  | { id: string; kind: "consent"; channel: ConsentChannel; purpose: ConsentPurpose }
  | { id: string; kind: "has_method"; method: "phone" | "email"; present: boolean }
  | { id: string; kind: "birthday_month"; months: number[] }
  | { id: string; kind: "created"; from?: string; to?: string }
  | { id: string; kind: "tags"; mode: "include" | "exclude"; values: string[] };

export type SegmentConditionKind = SegmentCondition["kind"];

export interface Segment {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  /** Private segments are visible to their owner only. */
  isPrivate: boolean;
  ownerUserId: string;
  conditions: SegmentCondition[];
  createdAt: string;
  updatedAt: string;
}
