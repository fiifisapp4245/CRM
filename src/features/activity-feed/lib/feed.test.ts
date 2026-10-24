import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { USERS } from "@/lib/mock-data/users";
import { humanizeField } from "./describe";
import { buildFeed, filterFeed } from "./feed";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const u = (id: string) => USERS.find((x) => x.id === id)!;
const db = buildSeed(NOW);

describe("activity feed", () => {
  it("translates technical field keys", () => {
    expect(humanizeField("owner_user_id")).toBe("Owner");
    expect(humanizeField("middle_names")).toBe("Middle names");
    expect(humanizeField("tag_ids")).toBe("Tags");
    expect(humanizeField("full_name")).toBe("Full name");
    expect(humanizeField("some_new_key")).toBe("Some new key");
    expect(humanizeField("Job title")).toBe("Job title");
  });
  it("resolves owner ids to names and never shows raw keys as labels", () => {
    const feed = buildFeed(db, u("u_ama"));
    const sync = feed.find((e) => e.technical.entityId === "ct_kwesi" && e.technical.action === "synced")!;
    const owner = sync.changes.find((c) => c.rawKey === "owner_user_id")!;
    expect(owner.label).toBe("Owner");
    expect(owner.to).toBe("Kwame Boateng");
    expect(feed.every((e) => e.changes.every((c) => !/_/.test(c.label)))).toBe(true);
  });
  it("drops events about records the viewer can't access and hides settings from non-admins", () => {
    const kwame = buildFeed(db, u("u_kwame"));
    expect(kwame.some((e) => e.recordName === "Oliver Bennett")).toBe(false); // Efua's contact
    expect(kwame.some((e) => e.category === "settings")).toBe(false);
    expect(buildFeed(db, u("u_abena")).some((e) => e.category === "settings")).toBe(true);
  });
  it("withholds change values from roles without change-history access", () => {
    const viewer = buildFeed(db, u("u_yaw"));
    const e = viewer.find((x) => x.technical.entityId === "ct_dup_grace_b" && x.technical.action === "synced")!;
    expect(e.restricted).toBe(true);
    expect(e.changes.every((c) => !c.from && !c.to)).toBe(true);
  });
  it("defaults to a useful range and can widen", () => {
    const feed = buildFeed(db, u("u_ama"));
    const d30 = filterFeed(feed, { category: "all", search: "", actorIds: [], range: "30d" }, NOW);
    const all = filterFeed(feed, { category: "all", search: "", actorIds: [], range: "all" }, NOW);
    expect(d30.length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(d30.length);
  });
});
