
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
  LogOut,
  Menu,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { useAuthState } from "@/hooks/use-auth-state";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/dashboard/loans", label: "Loans", icon: HandCoins },
  { href: "/dashboard/bank-accounts", label: "Accounts", icon: Landmark },
  { href: "/dashboard/categories", label: "Categories", icon: Shapes },
  { href: "/dashboard/bills-and-events", label: "Bills & Events", icon: FileText },
  { href: "/dashboard/reports", label: "Reports", icon: BookText },
  { href: "/dashboard/help", label: "Help", icon: HelpCircle },
];

const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

export function Header() {
  const [user, loading] = useAuthState();
  const [clientLoaded, setClientLoaded] = useState(false);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setClientLoaded(true);
  }, []);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  const avatarColor = user?.displayName ? generateColor(user.displayName) : '#cccccc';
  
  if (!clientLoaded) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Skeleton className="h-6 w-32" />
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:flex-initial">
          <div className="ml-auto flex-1 sm:flex-initial">
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
       <div className="flex items-center gap-6">
         <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          <Wallet className="h-6 w-6 text-primary" />
          <span className="">Expense Manager</span>
        </Link>
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
            {menuItems.map(item => (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "transition-colors hover:text-foreground",
                    pathname === item.href ? "text-foreground" : "text-muted-foreground"
                )}
            >
                {item.label}
            </Link>
            ))}
        </nav>
       </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
                <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
                >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <nav className="grid gap-6 text-lg font-medium">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-lg font-semibold"
                    onClick={() => setMobileMenuOpen(false)}
                >
                    <Wallet className="h-6 w-6 text-primary" />
                    <span>Expense Manager</span>
                </Link>
                {menuItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                            "transition-colors hover:text-foreground",
                            pathname === item.href ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {item.label}
                    </Link>
                ))}
                </nav>
            </SheetContent>
        </Sheet>
      <div className="flex items-center gap-4">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 rounded-full p-1 pr-3">
                    <Avatar className="h-8 w-8">
                        {loading || !clientLoaded ? (
                            <Skeleton className="h-full w-full rounded-full" />
                        ) : (
                            <>
                            <AvatarImage src={user?.photoURL || ''} data-ai-hint="user avatar" />
                            <AvatarFallback style={{ backgroundColor: avatarColor, color: '#fff' }}>
                                {getInitials(user?.displayName)}
                            </AvatarFallback>
                            </>
                        )}
                    </Avatar>
                    {loading || !clientLoaded ? (
                        <Skeleton className="h-4 w-20" />
                    ) : (
                        <span className="font-medium hidden md:block">{user?.displayName}</span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.displayName || "My Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/dashboard/profile">
                <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
                </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <Link href="/">
                <DropdownMenuItem onClick={() => auth.signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
                </DropdownMenuItem>
            </Link>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
