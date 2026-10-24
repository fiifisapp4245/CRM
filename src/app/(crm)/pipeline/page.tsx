import type { Metadata } from "next";
import { PipelineBoardPage } from "@/features/sales/components/pipeline-board-page";

export const metadata: Metadata = { title: "Pipeline" };

export default function Page() {
  return <PipelineBoardPage />;
}
