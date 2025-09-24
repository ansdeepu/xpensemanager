
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { format } from "date-fns";

// Function to generate a color from a string
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


export function Header({ pageTitle }: { pageTitle: string }) {
  const [user, loading] = useAuthState(auth);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);


  useEffect(() => {
    setClientLoaded(true);
    setCurrentDateTime(new Date());
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
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

  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2 flex-1">
        <SidebarTrigger className="md:hidden" />
        <div>
            <h1 className="text-xl font-semibold">{pageTitle}</h1>
            {currentDateTime ? (
                <p className="text-xs text-muted-foreground">{format(currentDateTime, "EEEE, dd/MM/yyyy, hh:mm a")}</p>
            ) : (
                <Skeleton className="h-4 w-48 mt-1" />
            )}
        </div>
      </div>

      <div className="hidden md:flex flex-1 justify-center">
        {currentDateTime ? (
             <h2 className="text-lg font-semibold">{format(currentDateTime, "MMMM yyyy")}</h2>
        ) : (
            <Skeleton className="h-6 w-32" />
        )}
      </div>

      <div className="flex-1 flex justify-end">
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
                <User className="mr-2" />
                <span>Profile</span>
                </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <Link href="/">
                <DropdownMenuItem onClick={() => auth.signOut()}>
                <LogOut className="mr-2" />
                <span>Log out</span>
                </DropdownMenuItem>
            </Link>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
