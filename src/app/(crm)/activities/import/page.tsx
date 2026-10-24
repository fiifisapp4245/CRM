import type { Metadata } from "next";
import { ActivitiesImport } from "@/features/activities/components/activities-import";

export const metadata: Metadata = { title: "Import activities" };

export default function Page() {
  return <ActivitiesImport />;
}
