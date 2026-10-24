import type { Account } from "@/features/accounts/types";
import { PRIMARY_ORG_ID } from "./users";

/**
 * Fictional organisations, including head offices with branches, a parent
 * with no account number, and two unrelated businesses that share a name
 * (to exercise ambiguous import matching). Domains use ".example".
 */
type Seed = Omit<Account, "orgId" | "createdAt" | "createdBy" | "updatedAt" | "tags"> & { tags?: string[]; ageDays: number; orgId?: string };

const S: Seed[] = [
  // Head office + branches
  { id: "acc_coastal_pharm", name: "Coastal Pharmacy Group", type: "customer", accountNumber: "ACC-1001", parentId: null, rating: "hot", ownerId: "u_kwame", phone: "+233 30 255 0100", email: "procurement@coastalpharmacy.example", website: "coastalpharmacy.example", industry: "Healthcare", ownership: "private", employees: 420, size: "large", annualRevenue: 38_000_000, billingAddress: { line1: "14 Ring Road Central", city: "Accra", region: "Greater Accra", country: "Ghana" }, tags: ["Key account", "Wholesale"], notes: "Central procurement decides for all branches above GHS 50,000.", ageDays: 420 },
  { id: "acc_coastal_kumasi", name: "Coastal Pharmacy – Kumasi", type: "customer", accountNumber: "ACC-1002", parentId: "acc_coastal_pharm", rating: "warm", ownerId: "u_kwame", phone: "+233 32 255 0110", industry: "Healthcare", ownership: "private", employees: 60, size: "medium", billingAddress: { line1: "Adum Market Road", city: "Kumasi", region: "Ashanti", country: "Ghana" }, ageDays: 300 },
  { id: "acc_coastal_takoradi", name: "Coastal Pharmacy – Takoradi", type: "customer", accountNumber: "ACC-1003", parentId: "acc_coastal_pharm", rating: "cold", ownerId: "u_efua", industry: "Healthcare", employees: 25, size: "small", billingAddress: { city: "Takoradi", region: "Western", country: "Ghana" }, ageDays: 200 },
  { id: "acc_asante_log", name: "Asante Logistics", type: "customer", accountNumber: "ACC-1010", parentId: null, rating: "warm", ownerId: "u_efua", phone: "+233 30 255 0200", email: "info@asantelogistics.example", website: "asantelogistics.example", industry: "Logistics", ownership: "private", employees: 180, size: "medium", annualRevenue: 12_500_000, billingAddress: { line1: "Spintex Road", city: "Accra", region: "Greater Accra", country: "Ghana" }, shippingAddress: { line1: "Harbour Area, Gate 3", city: "Tema", region: "Greater Accra", country: "Ghana" }, ageDays: 380 },
  { id: "acc_asante_tema", name: "Asante Logistics – Tema Depot", type: "customer", accountNumber: "ACC-1011", parentId: "acc_asante_log", ownerId: "u_efua", industry: "Logistics", employees: 40, size: "small", billingAddress: { city: "Tema", region: "Greater Accra", country: "Ghana" }, ageDays: 150 },
  { id: "acc_brightpath", name: "Bright Path Schools", type: "customer", parentId: null, rating: "hot", ownerId: "u_kojo", phone: "+233 30 255 0300", email: "admin@brightpath.example", website: "brightpath.example", industry: "Education", ownership: "private", employees: 310, size: "large", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, notes: "No account number yet — finance to assign.", ageDays: 260 },
  { id: "acc_brightpath_east", name: "Bright Path Schools – East Legon Campus", type: "customer", parentId: "acc_brightpath", ownerId: "u_kojo", industry: "Education", employees: 90, size: "medium", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 120 },
  // Stand-alone organisations
  { id: "acc_nkwanta_agro", name: "Nkwanta Agro Ltd", type: "supplier", accountNumber: "SUP-2001", parentId: null, rating: "warm", ownerId: "u_selasi", industry: "Agriculture", ownership: "private", employees: 75, size: "medium", billingAddress: { city: "Nkwanta", region: "Oti", country: "Ghana" }, ageDays: 340 },
  { id: "acc_osu_bakery", name: "Osu Bakery Co.", type: "customer", accountNumber: "ACC-1020", parentId: null, rating: "warm", ownerId: "u_kwame", phone: "+233 30 255 0400", industry: "Food & Beverage", ownership: "private", employees: 22, size: "small", billingAddress: { line1: "Oxford Street", city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 220 },
  { id: "acc_tema_hw", name: "Tema Hardware Supplies", type: "reseller", accountNumber: "RES-3001", parentId: null, rating: "hot", ownerId: "u_kwame", industry: "Retail", ownership: "private", employees: 48, size: "small", billingAddress: { city: "Tema", region: "Greater Accra", country: "Ghana" }, ageDays: 300 },
  { id: "acc_labadi_events", name: "Labadi Events", type: "prospect", parentId: null, rating: "cold", ownerId: null, industry: "Hospitality", employees: 12, size: "small", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 40 },
  { id: "acc_harmattan", name: "Harmattan Textiles", type: "partner", accountNumber: "PRT-4001", parentId: null, rating: "warm", ownerId: "u_efua", industry: "Manufacturing", ownership: "private", employees: 650, size: "large", annualRevenue: 54_000_000, billingAddress: { city: "Tema", region: "Greater Accra", country: "Ghana" }, ageDays: 400 },
  { id: "acc_kintampo_solar", name: "Kintampo Solar", type: "prospect", parentId: null, rating: "hot", ownerId: "u_ama", industry: "Energy", employees: 30, size: "small", billingAddress: { city: "Kintampo", region: "Bono East", country: "Ghana" }, ageDays: 25 },
  { id: "acc_ridge_dental", name: "Ridge Dental Clinic", type: "customer", accountNumber: "ACC-1030", parentId: null, rating: "cold", ownerId: "u_selasi", industry: "Healthcare", employees: 14, size: "small", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 180 },
  { id: "acc_akwaaba_travel", name: "Akwaaba Travel", type: "customer", accountNumber: "ACC-1040", parentId: null, rating: "warm", ownerId: "u_kojo", industry: "Travel", employees: 35, size: "small", billingAddress: { city: "Kumasi", region: "Ashanti", country: "Ghana" }, ageDays: 210 },
  { id: "acc_takoradi_marine", name: "Takoradi Marine Services", type: "customer", accountNumber: "ACC-1050", parentId: null, rating: "warm", ownerId: "u_selasi", industry: "Maritime", employees: 120, size: "medium", billingAddress: { city: "Takoradi", region: "Western", country: "Ghana" }, ageDays: 330 },
  { id: "acc_sunyani_fresh", name: "Sunyani Fresh Foods", type: "supplier", accountNumber: "SUP-2002", parentId: null, ownerId: "u_ama", industry: "Food & Beverage", employees: 55, size: "medium", billingAddress: { city: "Sunyani", region: "Bono", country: "Ghana" }, ageDays: 280 },
  { id: "acc_accra_techhub", name: "Accra Tech Hub", type: "partner", parentId: null, rating: "warm", ownerId: null, industry: "Technology", employees: 8, size: "micro", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 60 },
  // Two unrelated businesses with the same name and no account numbers — imports must not guess.
  { id: "acc_sunrise_accra", name: "Sunrise Pharmacy", type: "prospect", parentId: null, ownerId: "u_kwame", industry: "Healthcare", employees: 6, size: "micro", billingAddress: { city: "Accra", region: "Greater Accra", country: "Ghana" }, ageDays: 70 },
  { id: "acc_sunrise_ho", name: "Sunrise Pharmacy", type: "prospect", parentId: null, ownerId: "u_efua", industry: "Healthcare", employees: 4, size: "micro", billingAddress: { city: "Ho", region: "Volta", country: "Ghana" }, ageDays: 65 },
  // Other organisation — never visible in Adinkra.
  { id: "acc_volta_coop", orgId: "org_volta", name: "Volta Farmers Co-operative", type: "customer", accountNumber: "ACC-1001", parentId: null, ownerId: "u_volta_mgr", industry: "Agriculture", ageDays: 90 },
];

export const ACCOUNT_DOMAIN: Record<string, string> = {
  acc_asante_log: "asantelogistics.example",
  acc_coastal_pharm: "coastalpharmacy.example",
  acc_nkwanta_agro: "nkwanta-agro.example",
  acc_osu_bakery: "osubakery.example",
  acc_tema_hw: "temahardware.example",
  acc_labadi_events: "labadievents.example",
  acc_harmattan: "harmattantextiles.example",
  acc_kintampo_solar: "kintamposolar.example",
  acc_ridge_dental: "ridgedental.example",
  acc_akwaaba_travel: "akwaabatravel.example",
  acc_brightpath: "brightpath.example",
  acc_takoradi_marine: "takoradimarine.example",
  acc_sunyani_fresh: "sunyanifresh.example",
  acc_accra_techhub: "accratechhub.example",
};

/** Accounts that generated contacts may be attached to (top-level ones with a known domain). */
export const CONTACT_ACCOUNT_IDS = Object.keys(ACCOUNT_DOMAIN);

export function buildAccounts(iso: (offsetMs: number) => string): Account[] {
  const DAY = 86_400_000;
  return S.map(({ ageDays, orgId, tags, ...a }) => ({
    ...a,
    orgId: orgId ?? PRIMARY_ORG_ID,
    tags: tags ?? [],
    createdAt: iso(-ageDays * DAY),
    createdBy: a.ownerId ?? "u_abena",
    updatedAt: iso(-Math.floor(ageDays / 3) * DAY),
  }));
}
