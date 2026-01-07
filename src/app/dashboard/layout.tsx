
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Shapes,
  FileText,
  HelpCircle,
  User,
  BookText,
  HandCoins,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Header } from "@/components/dashboard/header";
import { ReportDateProvider } from "@/context/report-date-context";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", description: "An overview of your financial status.", icon: LayoutDashboard },
  {
    href: "/dashboard/transactions",
    label: "Transaction History",
    description: "A detailed record of your financial activities.",
    icon: ArrowRightLeft,
  },
  { href: "/dashboard/bank-accounts", label: "Bank Accounts", description: "Manage your bank accounts and wallets.", icon: Landmark },
  { href: "/dashboard/categories", label: "Categories", description: "Organize your income and expenses.", icon: Shapes },
  { href: "/dashboard/bills-and-events", label: "Bills & Events", description: "Track upcoming payments and special days.", icon: FileText },
  { href: "/dashboard/loans", label: "Loans", description: "Track loans taken and given.", icon: HandCoins },
  { href: "/dashboard/reports", label: "Financial Reports", description: "An overview of your financial performance for each account.", icon: BookText },
  { href: "/dashboard/help", label: "Help", description: "Get help on how to use the app.", icon: HelpCircle },
  { href: "/dashboard/profile", label: "User Profile", description: "Manage your profile settings.", icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeItem = menuItems.find((item) => item.href === pathname);
  const pageTitle = activeItem?.label || "Dashboard";
  const pageDescription = activeItem?.description;

  return (
    <SidebarProvider>
      <ReportDateProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 p-2">
                <Wallet className="size-8 text-primary" />
                <span className="text-lg font-semibold">Expense Manager</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <Header pageTitle={pageTitle} pageDescription={pageDescription} />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </div>
      </ReportDateProvider>
    </SidebarProvider>
  );
}
