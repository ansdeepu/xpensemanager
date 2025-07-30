import { Landmark } from "lucide-react";
import { SignUpForm } from "@/components/auth/signup-form";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Landmark className="h-10 w-10" />
            <h1 className="text-4xl font-bold text-foreground">
              Expense Manager
            </h1>
          </div>
          <p className="text-muted-foreground">
            Create an account to start managing your finances.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
