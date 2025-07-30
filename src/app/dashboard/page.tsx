import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { MainStats } from "@/components/dashboard/overview/main-stats";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";
import { OverviewChart } from "@/components/dashboard/overview/overview-chart";
import { RecentTransactions } from "@/components/dashboard/overview/recent-transactions";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <AccountBalances />
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryExpenses />
        <NoticeBoard />
      </div>
      <MainStats />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <OverviewChart />
        <RecentTransactions />
      </div>
    </div>
  );
}
