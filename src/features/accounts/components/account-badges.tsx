import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { ACCOUNT_RATING_LABELS, ACCOUNT_TYPE_LABELS, type AccountRating, type AccountType } from "../types";

const RATING_TONE: Record<AccountRating, PillTone> = { hot: "danger", warm: "warning", cold: "info" };

export function RatingPill({ rating }: { rating?: AccountRating }) {
  if (!rating) return <span className="text-subtle-foreground">—</span>;
  return <StatusPill tone={RATING_TONE[rating]}>{ACCOUNT_RATING_LABELS[rating]}</StatusPill>;
}

export function TypeLabel({ type }: { type: AccountType }) {
  return <span>{ACCOUNT_TYPE_LABELS[type]}</span>;
}
