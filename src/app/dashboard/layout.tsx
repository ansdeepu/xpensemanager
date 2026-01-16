"use client";

import { Header } from "@/components/dashboard/header";
import { ReportDateProvider } from "@/context/report-date-context";
import { useAuthState } from "@/hooks/use-auth-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, loading] = useAuthState();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-5 w-36" />
            </div>
            <nav className="hidden md:flex md:flex-row md:items-center md:gap-5 lg:gap-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Skeleton className="h-48 lg:col-span-1" />
              <Skeleton className="h-48 lg:col-span-2" />
            </div>
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  return (
      <ReportDateProvider>
        <div className="flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </ReportDateProvider>
  );
}
