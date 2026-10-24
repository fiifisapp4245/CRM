import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivitiesPage } from "@/features/activities/components/activities-page";

export const metadata: Metadata = { title: "Tasks & calls" };

export default function Page() {
  return (
    <Suspense>
      <ActivitiesPage />
    </Suspense>
  );
}
