import type { Organization, RoleId, User } from "@/lib/types";

/** All organisations and people below are fictional. */
export const ORGANIZATIONS: Organization[] = [
  { id: "org_adinkra", name: "Adinkra Home & Office Ltd" },
  { id: "org_volta", name: "Volta Agro Supplies" }, // second tenant — used to prove org boundaries
];

export const PRIMARY_ORG_ID = "org_adinkra";

export const USERS: User[] = [
  { id: "u_ama", orgId: "org_adinkra", name: "Ama Mensah", email: "ama.mensah@adinkra.example", role: "crm_sales_manager", jobTitle: "Head of Sales", status: "active" },
  { id: "u_kwame", orgId: "org_adinkra", name: "Kwame Boateng", email: "kwame.boateng@adinkra.example", role: "crm_user", managerId: "u_ama", jobTitle: "Account Executive", status: "active" },
  { id: "u_efua", orgId: "org_adinkra", name: "Efua Owusu", email: "efua.owusu@adinkra.example", role: "crm_user", managerId: "u_ama", jobTitle: "Account Executive", status: "active" },
  { id: "u_kojo", orgId: "org_adinkra", name: "Kojo Asamoah", email: "kojo.asamoah@adinkra.example", role: "crm_user", managerId: "u_ama", jobTitle: "Sales Representative", status: "active" },
  { id: "u_selasi", orgId: "org_adinkra", name: "Selasi Agbeko", email: "selasi.agbeko@adinkra.example", role: "crm_user", jobTitle: "Customer Success Lead", status: "active" },
  { id: "u_yaw", orgId: "org_adinkra", name: "Yaw Darko", email: "yaw.darko@adinkra.example", role: "crm_viewer", jobTitle: "Finance Analyst", status: "active" },
  { id: "u_abena", orgId: "org_adinkra", name: "Abena Asante", email: "abena.asante@adinkra.example", role: "crm_admin", jobTitle: "CRM Administrator", status: "active" },
  { id: "u_kofi", orgId: "org_adinkra", name: "Kofi Adjei", email: "kofi.adjei@adinkra.example", role: "suite_admin", jobTitle: "IT Manager", status: "active" },
  // Edge cases the owner selector must handle:
  { id: "u_naa", orgId: "org_adinkra", name: "Naa Lamptey", email: "naa.lamptey@adinkra.example", role: "crm_user", managerId: "u_ama", jobTitle: "Sales Representative", status: "inactive" },
  { id: "u_qa", orgId: "org_adinkra", name: "QA Automation", email: "qa+crm@adinkra.example", role: "crm_user", status: "active", isTestAccount: true },
  { id: "u_kwame_dup", orgId: "org_adinkra", name: "Kwame Boateng", email: "k.boateng@adinkra.example", role: "crm_user", status: "active", duplicateOfUserId: "u_kwame" },
  // Other organisation — must never appear anywhere in Adinkra's workspace.
  { id: "u_volta_mgr", orgId: "org_volta", name: "Edem Kpodo", email: "edem@volta.example", role: "crm_sales_manager", status: "active" },
];

/** The persona used when switching to each role in the prototype. */
export const DEMO_PERSONA_BY_ROLE: Record<RoleId, string> = {
  crm_sales_manager: "u_ama",
  crm_user: "u_kwame",
  crm_viewer: "u_yaw",
  crm_admin: "u_abena",
  suite_admin: "u_kofi",
};

/** Users who may own contacts: active, same org, not test, not duplicate identities, and a role that can hold records. */
export function eligibleOwners(users: User[], orgId: string): User[] {
  return users.filter(
    (u) =>
      u.orgId === orgId &&
      u.status === "active" &&
      !u.isTestAccount &&
      !u.duplicateOfUserId &&
      (u.role === "crm_user" || u.role === "crm_sales_manager" || u.role === "crm_admin"),
  );
}
