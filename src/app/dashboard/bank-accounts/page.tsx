
import { AccountList } from "@/components/dashboard/bank-accounts/account-list";

export default async function BankAccountsPage(props: {
  params: Promise<any>;
}) {
  // Await params for Next.js 15 compatibility
  await props.params;

  return (
    <div className="space-y-6">
      <AccountList />
    </div>
  );
}
