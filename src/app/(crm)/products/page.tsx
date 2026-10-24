import type { Metadata } from "next";
import { ProductsPage } from "@/features/sales/components/products-page";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <ProductsPage />;
}
