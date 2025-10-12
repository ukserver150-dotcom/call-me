
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { type User as FirebaseUser } from "firebase/auth";

const onboardingSchema = z.object({
  fullname: z.string().min(1, "Full name is required"),
  username: z.string().min(3).max(20).regex(/^[a-z0-9._]+$/, "Usernames can only contain lowercase letters, numbers, periods, and underscores."),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function Onboarding({ user }: { user: FirebaseUser }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullname: "",
      username: "",
    },
  });

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!firestore) return;
    setLoading(true);

    try {
      // Check for username uniqueness
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("username", "==", values.username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        form.setError("username", { message: "Username already taken" });
        setLoading(false);
        return;
      }

      // Create user document
      const userRef = doc(firestore, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        fullname: values.fullname,
        username: values.username,
        createdAt: serverTimestamp(),
        avatarUrl: null,
      });

      toast({ title: "Profile created successfully!" });
      // The parent component will detech the profile and re-render.
    } catch (error) {
      console.error("Error creating profile:", error);
      toast({ variant: "destructive", title: "Uh oh! Something went wrong.", description: "Could not create your profile." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to EchoVerse!</CardTitle>
        <CardDescription>Let's get your profile set up.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullname"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormControl>
                    <Input placeholder="Full Name" {...field} id="fullName" className="peer placeholder-transparent" />
                  </FormControl>
                  <FormLabel htmlFor="fullName" className="absolute left-0 -top-2.5 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base">Full Name</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormControl>
                    <Input placeholder="Username" {...field} id="username" className="peer placeholder-transparent"/>
                  </FormControl>
                  <FormLabel htmlFor="username" className="absolute left-0 -top-2.5 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base">Username</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving..." : "Save and Continue"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
