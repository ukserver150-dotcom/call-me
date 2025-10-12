"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type User as FirebaseUser } from "firebase/auth";
import { type User } from "@/lib/firebase/schema";
import { DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import { useStorage } from "@/firebase/storage/use-storage";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Switch } from "./ui/switch";
import { useAuth } from "@/firebase/auth/use-auth";
import { useTheme } from "next-themes";


const accountSchema = z.object({
    fullname: z.string().min(1, "Full name is required"),
    username: z.string().min(3).max(20).regex(/^[a-z0-9._]+$/, "Invalid username format."),
});

type AccountFormValues = z.infer<typeof accountSchema>;


export default function Settings({ user, profile }: { user: FirebaseUser, profile: User }) {
  const { toast } = useToast();
  const storage = useStorage();
  const firestore = useFirestore();
  const auth = useAuth();
  const { setTheme, theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();


  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
        fullname: profile.fullname,
        username: profile.username,
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !storage || !firestore) return;

    startAvatarTransition(async () => {
        try {
            const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, { avatarUrl: downloadURL });

            toast({ title: "Profile picture updated!" });
        } catch (error) {
            console.error("Error updating profile picture:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update profile picture." });
        }
    });
  };

  const onAccountSubmit = (values: AccountFormValues) => {
    startAccountTransition(async () => {
        if (!firestore) return;

        try {
            const userDocRef = doc(firestore, "users", user.uid);
            const updates: Partial<User> = {};

            if (values.fullname !== profile.fullname) {
                updates.fullname = values.fullname;
            }

            if (values.username !== profile.username) {
                // Check for username uniqueness
                const usersRef = collection(firestore, "users");
                const q = query(usersRef, where("username", "==", values.username));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    form.setError("username", { message: "This username is already taken." });
                    return;
                }
                updates.username = values.username;
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(userDocRef, updates);
                toast({ title: "Account updated successfully!" });
            } else {
                toast({ title: "No changes to save." });
            }

        } catch (error) {
            console.error("Error updating account:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update account." });
        }
    });
  }

  const handleSignOut = async () => {
    if (auth) {
        await auth.signOut();
        toast({ title: "Signed Out", description: "You have been signed out." });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>
          Manage your account settings, profile, and app preferences.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 p-4">
        <Tabs defaultValue="profile" orientation="vertical" className="w-full -ml-4">
            <TabsList className="w-full flex-col h-auto items-start bg-transparent border-r">
                <TabsTrigger value="profile" className="w-full justify-start">Profile</TabsTrigger>
                <TabsTrigger value="account" className="w-full justify-start">Account</TabsTrigger>
                <TabsTrigger value="privacy" className="w-full justify-start">Privacy</TabsTrigger>
                <TabsTrigger value="appearance" className="w-full justify-start">Appearance</TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="mt-0 pl-6">
                <Card className="border-0 shadow-none">
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>This is how other users will see you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20 cursor-pointer" onClick={handleAvatarClick}>
                                <AvatarImage src={profile.avatarUrl || ''} />
                                <AvatarFallback>{profile.fullname.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <Button onClick={handleAvatarClick} disabled={isAvatarPending}>
                                {isAvatarPending ? "Uploading..." : "Change Picture"}
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                        <div>
                            <p className="font-semibold text-lg">{profile.fullname}</p>
                            <p className="text-muted-foreground">@{profile.username}</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="account" className="mt-0 pl-6">
                 <Card className="border-0 shadow-none">
                    <CardHeader>
                        <CardTitle>Account</CardTitle>
                        <CardDescription>Update your account details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onAccountSubmit)} className="space-y-4">
                                <FormField
                                control={form.control}
                                name="fullname"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={isAccountPending} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={isAccountPending} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <Button type="submit" disabled={isAccountPending}>
                                    {isAccountPending ? "Saving..." : "Save Changes"}
                                </Button>
                            </form>
                        </Form>
                        <div className="mt-8 pt-8 border-t">
                            <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                             <p className="text-sm text-muted-foreground mb-4">Signing out will end your current session.</p>
                            <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="privacy" className="mt-0 pl-6">
                <Card className="border-0 shadow-none">
                    <CardHeader>
                        <CardTitle>Privacy</CardTitle>
                        <CardDescription>Control your privacy settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center justify-between">
                            <Label htmlFor="online-status" className="flex flex-col space-y-1">
                                <span>Show Online Status</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Allow others to see when you are online.
                                </span>
                            </Label>
                            <Switch id="online-status" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                             <Label htmlFor="friend-requests" className="flex flex-col space-y-1">
                                <span>Allow Friend Requests</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Turn off to prevent others from sending you friend requests.
                                </span>
                            </Label>
                            <Switch id="friend-requests" defaultChecked />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="appearance" className="mt-0 pl-6">
                <Card className="border-0 shadow-none">
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>Customize the look and feel of the app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center justify-between">
                            <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                                <span>Dark Mode</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Toggle between light and dark themes.
                                </span>
                            </Label>
                            <Switch 
                                id="dark-mode" 
                                checked={theme === 'dark'}
                                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                            />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
