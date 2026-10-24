export type AccountType = "customer" | "prospect" | "partner" | "supplier" | "reseller" | "other";
export type AccountRating = "hot" | "warm" | "cold";
export type AccountSize = "micro" | "small" | "medium" | "large" | "enterprise";
export type AccountOwnership = "private" | "public" | "government" | "ngo" | "other";

export interface Address {
  line1?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

export interface Account {
  id: string;
  orgId: string;
  name: string;
  type: AccountType;
  accountNumber?: string;
  /** Head office / parent organisation. null = top level. */
  parentId: string | null;
  rating?: AccountRating;
  ownerId: string | null;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  ownership?: AccountOwnership;
  employees?: number;
  size?: AccountSize;
  annualRevenue?: number;
  billingAddress?: Address;
  shippingAddress?: Address;
  tags: string[];
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  customer: "Customer",
  prospect: "Prospect",
  partner: "Partner",
  supplier: "Supplier",
  reseller: "Reseller",
  other: "Other",
};

export const ACCOUNT_RATING_LABELS: Record<AccountRating, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

export const ACCOUNT_SIZE_LABELS: Record<AccountSize, string> = {
  micro: "Micro (1–9)",
  small: "Small (10–49)",
  medium: "Medium (50–249)",
  large: "Large (250–999)",
  enterprise: "Enterprise (1,000+)",
};

export const ACCOUNT_OWNERSHIP_LABELS: Record<AccountOwnership, string> = {
  private: "Private",
  public: "Public (listed)",
  government: "Government",
  ngo: "Non-profit / NGO",
  other: "Other",
};
