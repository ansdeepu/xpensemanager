import { AccountBalances } from "@/components/dashboard/overview/account-balances";
import { CategoryExpenses } from "@/components/dashboard/overview/category-expenses";
import { NoticeBoard } from "@/components/dashboard/overview/notice-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <AccountBalances />
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
         <CategoryExpenses />
         <NoticeBoard />
      </div>
    </div>
  );
}
