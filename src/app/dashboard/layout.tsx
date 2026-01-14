
"use client";

import { Header } from "@/components/dashboard/header";
import { ReportDateProvider } from "@/context/report-date-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
      <ReportDateProvider>
        <div className="flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </ReportDateProvider>
  );
}
