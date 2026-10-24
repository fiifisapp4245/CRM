"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/sales/components/product-form";

export default function Page() {
  const { productId } = useParams<{ productId: string }>();
  const p = useDbStore((s) => s.db.products.find((x) => x.id === productId));
  if (!p)
    return (
      <PageContainer>
        <EmptyState icon={SearchX} title="Product not found" action={<Button asChild variant="outline"><Link href="/products">Back to products</Link></Button>} />
      </PageContainer>
    );
  return <ProductForm key={p.id} product={p} />;
}
