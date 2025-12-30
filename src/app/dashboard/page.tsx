import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";
import { MainStats } from "@/components/dashboard/overview/main-stats";
import { OverviewChart } from "@/components/dashboard/overview/overview-chart";
import { RecentTransactions } from "@/components/dashboard/overview/recent-transactions";


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <AccountBalances />
      <MainStats />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <CategoryExpenses />
        <div className="lg:col-span-3 flex flex-col gap-6">
          <NoticeBoard />
        </div>
      </div>
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <OverviewChart />
          <RecentTransactions />
      </div>
    </div>
  );
}
