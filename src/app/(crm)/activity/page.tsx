import type { Metadata } from "next";
import { ActivityFeedPage } from "@/features/activity-feed/components/activity-feed-page";

export const metadata: Metadata = { title: "Activity feed" };

export default function Page() {
  return <ActivityFeedPage />;
}
