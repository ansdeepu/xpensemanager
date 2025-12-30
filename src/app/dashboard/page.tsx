import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { ExpenseDistributionChart } from "@/components/dashboard/overview/expense-distribution-chart";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <AccountBalances />
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
         <CategoryExpenses />
         <div className="lg:col-span-3 flex flex-col gap-6">
            <ExpenseDistributionChart />
            <NoticeBoard />
         </div>
      </div>
    </div>
  );
}
