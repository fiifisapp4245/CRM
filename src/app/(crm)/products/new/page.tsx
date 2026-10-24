"use client";

import Link from "next/link";
import { usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/features/sales/components/product-form";

export default function Page() {
  if (!usePermission("products.manage"))
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't add products" action={<Button asChild variant="outline"><Link href="/products">Back to products</Link></Button>} />
      </PageContainer>
    );
  return <ProductForm />;
}
