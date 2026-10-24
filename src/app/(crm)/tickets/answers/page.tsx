import type { Metadata } from "next";
import { SavedAnswersPage } from "@/features/tickets/components/saved-answers-page";

export const metadata: Metadata = { title: "Saved answers" };

export default function Page() {
  return <SavedAnswersPage />;
}
