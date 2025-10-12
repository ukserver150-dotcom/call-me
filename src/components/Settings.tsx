"use client";

import { type User as FirebaseUser } from "firebase/auth";
import { type User } from "@/lib/firebase/schema";
import { DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

export default function Settings({ user, profile }: { user: FirebaseUser, profile: User }) {

  return (
    <>
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>
          Manage your account settings, profile, and app preferences.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 p-4">
        <Tabs defaultValue="profile" orientation="vertical" className="w-full">
            <TabsList className="w-full flex-col h-auto items-start">
                <TabsTrigger value="profile" className="w-full justify-start">Profile</TabsTrigger>
                <TabsTrigger value="account" className="w-full justify-start">Account</TabsTrigger>
                <TabsTrigger value="privacy" className="w-full justify-start">Privacy</TabsTrigger>
                <TabsTrigger value="theme" className="w-full justify-start">Theme</TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="mt-0">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>This is how other users will see you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={profile.avatarUrl || ''} />
                                <AvatarFallback>{profile.fullname.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <Button>Change Picture</Button>
                        </div>
                        <div>
                            <p className="font-semibold text-lg">{profile.fullname}</p>
                            <p className="text-muted-foreground">@{profile.username}</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="account">
                <p>Account Settings</p>
            </TabsContent>
            <TabsContent value="privacy">
                <p>Privacy Settings</p>
            </TabsContent>
            <TabsContent value="theme">
                <p>Theme Settings</p>
            </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
