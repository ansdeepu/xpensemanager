
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


export function Header() {
  const [user, loading] = useAuthState(auth);
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [currentMonthYear, setCurrentMonthYear] = useState("");
  const [clientLoaded, setClientLoaded] = useState(false);

  useEffect(() => {
    setClientLoaded(true);

    const updateDateTime = () => {
      const date = new Date();
      const dateTimeOptions: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
       };
       const monthYearOptions: Intl.DateTimeFormatOptions = {
        month: 'long',
        year: 'numeric',
       }
      setCurrentDateTime(date.toLocaleString('en-US', dateTimeOptions));
      setCurrentMonthYear(date.toLocaleString('en-US', monthYearOptions));
    };

    updateDateTime();
    const intervalId = setInterval(updateDateTime, 1000);

    return () => clearInterval(intervalId);
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
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-xs text-muted-foreground hidden md:block">{clientLoaded ? currentDateTime : ''}</p>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="text-sm font-medium text-muted-foreground">{clientLoaded ? currentMonthYear : ''}</div>
      </div>

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
          <DropdownMenuItem>
            <User className="mr-2" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Link href="/">
            <DropdownMenuItem>
              <LogOut className="mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
