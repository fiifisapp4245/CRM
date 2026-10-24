/** Pure calendar layout: which events fall on which business-local day, and side-by-side lanes for overlaps. */
import { addDaysKey, dayKey, startOfWeekKey, toWall } from "@/lib/business/time";
import { plannedMinutes } from "@/features/activities/lib/activities";
import type { Activity } from "@/features/activities/types";

export interface Placed {
  a: Activity;
  start: string;
  startMin: number; // minutes from local midnight
  endMin: number;
  lane: number;
  lanes: number;
}

/** When an activity sits on the calendar: planned start, or when it happened. */
export const calendarStart = (a: Activity) => a.dueAt ?? a.occurredAt;

export function placeDay(events: Activity[], key: string, tz: string): Placed[] {
  const items = events
    .filter((a) => {
      const s = calendarStart(a);
      return s && dayKey(s, tz) === key;
    })
    .map((a) => {
      const start = calendarStart(a)!;
      const w = toWall(start, tz);
      const startMin = w.h * 60 + w.min;
      const mins = a.status ? plannedMinutes(a) : (a.durationMinutes ?? 30);
      return { a, start, startMin, endMin: Math.min(24 * 60, startMin + Math.max(20, mins)), lane: 0, lanes: 1 };
    })
    .sort((x, y) => x.startMin - y.startMin || y.endMin - x.endMin);
  // Greedy lanes within clusters of overlapping events.
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
  };
  for (const p of items) {
    if (p.startMin >= clusterEnd) flush();
    const used = new Set(cluster.filter((q) => q.endMin > p.startMin).map((q) => q.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    p.lane = lane;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  flush();
  return items;
}

/** Monday-first 6-week grid for a month (YYYY-MM). */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const start = startOfWeekKey(first);
  return Array.from({ length: 42 }, (_, i) => addDaysKey(start, i));
}
