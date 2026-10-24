import type { Metadata } from "next";
import { CampaignsListPage } from "@/features/messaging/components/campaigns-list-page";

export const metadata: Metadata = { title: "Campaigns" };

export default function Page() {
  return <CampaignsListPage />;
}
