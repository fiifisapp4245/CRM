import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/dashboard" className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}
