import type { Metadata } from "next";
import { GuidePage } from "@/features/guide/guide-page";

export const metadata: Metadata = { title: "Guide" };

export default function Page() {
  return <GuidePage />;
}
