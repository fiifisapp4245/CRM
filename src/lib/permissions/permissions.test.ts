import { describe, expect, it } from "vitest";
import { USERS } from "@/lib/mock-data/users";
import { canReadRecord, canWriteRecord, hasPermission } from "./index";

const u = (id: string) => USERS.find((x) => x.id === id)!;
const rec = (ownerId: string | null, orgId = "org_adinkra") => ({ orgId, ownerId });

describe("permissions", () => {
  it("viewer cannot create, edit, import, merge or export", () => {
    const viewer = u("u_yaw");
    for (const p of ["contacts.create", "contacts.edit", "contacts.import", "contacts.merge", "contacts.export"] as const) expect(hasPermission(viewer, p)).toBe(false);
    expect(hasPermission(viewer, "contacts.view")).toBe(true);
    expect(canWriteRecord(viewer, rec("u_kwame"), USERS)).toBe(false);
  });
  it("CRM user reads and writes only own and unassigned records", () => {
    const user = u("u_kwame");
    expect(canReadRecord(user, rec("u_kwame"), USERS)).toBe(true);
    expect(canReadRecord(user, rec(null), USERS)).toBe(true);
    expect(canReadRecord(user, rec("u_efua"), USERS)).toBe(false);
    expect(hasPermission(user, "contacts.merge")).toBe(false);
    expect(hasPermission(user, "contacts.reassign")).toBe(false);
  });
  it("sales manager reaches their team but not other teams", () => {
    const mgr = u("u_ama");
    expect(canWriteRecord(mgr, rec("u_kwame"), USERS)).toBe(true);
    expect(canWriteRecord(mgr, rec("u_naa"), USERS)).toBe(true);
    expect(canReadRecord(mgr, rec("u_selasi"), USERS)).toBe(false);
  });
  it("nobody crosses organisation boundaries", () => {
    for (const id of ["u_ama", "u_abena", "u_kofi", "u_yaw"]) expect(canReadRecord(u(id), rec("u_volta_mgr", "org_volta"), USERS)).toBe(false);
  });
  it("inactive users have no permissions", () => {
    expect(hasPermission(u("u_naa"), "contacts.view")).toBe(false);
  });
  it("suite admin governs data but cannot view consent evidence", () => {
    expect(hasPermission(u("u_kofi"), "contacts.merge")).toBe(true);
    expect(hasPermission(u("u_kofi"), "consent.viewEvidence")).toBe(false);
  });
});
