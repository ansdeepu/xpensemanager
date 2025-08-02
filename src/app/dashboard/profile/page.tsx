
"use client";

import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { updateProfile, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


const passwordFormSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export default function ProfilePage() {
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const { toast } = useToast();

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsProfileSubmitting(true);
    try {
      await updateProfile(user, { displayName });
      toast({
        title: "Profile updated",
        description: "Your display name has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } finally {
      setIsProfileSubmitting(false);
    }
  };
  
  async function handleUpdatePassword(values: z.infer<typeof passwordFormSchema>) {
    if (!user) return;
    setIsPasswordSubmitting(true);
    try {
      await updatePassword(user, values.password);
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "This is a sensitive operation and requires recent authentication. Please log out and log back in to change your password.",
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="w-full max-w-2xl">
            <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
            </div>
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-28" />
            </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        <Card className="w-full max-w-2xl">
            <form onSubmit={handleUpdateProfile}>
                <CardHeader>
                    <CardTitle>Profile Details</CardTitle>
                    <CardDescription>
                        View and update your personal information here.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                        id="email"
                        value={user?.email || ""}
                        disabled
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isProfileSubmitting}>
                        {isProfileSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </CardFooter>
            </form>
        </Card>

        <Card className="w-full max-w-2xl">
            <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handleUpdatePassword)}>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>
                            Enter a new password for your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={passwordForm.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isPasswordSubmitting}>
                            {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Change Password
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    </div>
  );
}
