import { Landmark } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-primary">
            <Landmark className="h-10 w-10" />
            <h1 className="text-4xl font-bold text-foreground">
              Expense Manager
            </h1>
          </div>
          <p className="text-muted-foreground">
            Welcome back! Please sign in to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
