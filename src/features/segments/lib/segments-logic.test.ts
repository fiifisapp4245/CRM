import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { USERS } from "@/lib/mock-data/users";
import { consentStatus } from "@/features/contacts/lib/consent";
import { canEditSegment, isIncomplete, segmentAudience, visibleSegments } from "./match";
import type { SegmentCondition } from "../types";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const u = (id: string) => USERS.find((x) => x.id === id)!;
const db = buildSeed(NOW);

describe("segment matching", () => {
  const ama = u("u_ama");
  it("adding a consent condition narrows the live count and only counts current agreement", () => {
    const base: SegmentCondition[] = [{ id: "a", kind: "has_method", method: "phone", present: true }];
    const withSms: SegmentCondition[] = [...base, { id: "b", kind: "consent", channel: "sms", purpose: "marketing" }];
    const all = segmentAudience(db, ama, base);
    const sms = segmentAudience(db, ama, withSms);
    expect(sms.length).toBeLessThan(all.length);
    expect(sms.every((c) => consentStatus(db.consents, c.id, "sms", "marketing") === "agreed")).toBe(true);
    // Abigail agreed to SMS then withdrew — she must not be counted.
    expect(sms.some((c) => c.id === "ct_abigail")).toBe(false);
  });
  it("combines conditions with AND and values with OR", () => {
    const either = segmentAudience(db, ama, [{ id: "a", kind: "source", values: ["mystoreguard", "loandrift"] }]);
    const one = segmentAudience(db, ama, [{ id: "a", kind: "source", values: ["mystoreguard"] }]);
    const both = segmentAudience(db, ama, [
      { id: "a", kind: "source", values: ["mystoreguard"] },
      { id: "b", kind: "location", field: "region", values: ["Greater Accra"] },
    ]);
    expect(either.length).toBeGreaterThan(one.length);
    expect(both.every((c) => c.source === "mystoreguard" && c.region === "Greater Accra")).toBe(true);
  });
  it("tag exclusion removes tagged contacts", () => {
    const out = segmentAudience(db, ama, [{ id: "a", kind: "tags", mode: "exclude", values: ["VIP"] }]);
    expect(out.some((c) => c.tags.includes("VIP"))).toBe(false);
  });
  it("counts only contacts the viewer can access", () => {
    const kwame = segmentAudience(db, u("u_kwame"), []);
    expect(kwame.every((c) => c.ownerId === null || c.ownerId === "u_kwame")).toBe(true);
  });
  it("treats empty conditions as incomplete", () => {
    expect(isIncomplete({ id: "x", kind: "tags", mode: "include", values: [] })).toBe(true);
    expect(isIncomplete({ id: "x", kind: "consent", channel: "sms", purpose: "marketing" })).toBe(false);
  });
});

describe("segment visibility and editing", () => {
  it("hides private segments from everyone but their owner", () => {
    expect(visibleSegments(db, u("u_kwame")).some((s) => s.id === "seg_kwame_birthdays")).toBe(true);
    expect(visibleSegments(db, u("u_ama")).some((s) => s.id === "seg_kwame_birthdays")).toBe(false);
  });
  it("lets owners edit; admins manage shared ones; viewers never edit", () => {
    const shared = db.segments.find((s) => s.id === "seg_sms_marketing")!;
    expect(canEditSegment(u("u_ama"), shared)).toBe(true);
    expect(canEditSegment(u("u_kwame"), shared)).toBe(false);
    expect(canEditSegment(u("u_abena"), shared)).toBe(true);
    expect(canEditSegment(u("u_yaw"), shared)).toBe(false);
  });
});
