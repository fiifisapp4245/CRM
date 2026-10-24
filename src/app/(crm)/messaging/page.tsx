import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagingPage } from "@/features/messaging/components/messaging-page";

export const metadata: Metadata = { title: "Messaging" };

export default function Page() {
  return (
    <Suspense>
      <MessagingPage />
    </Suspense>
  );
}
