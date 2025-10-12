"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/firebase/auth/use-auth";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

const signupSchema = z.object({
  fullname: z.string().min(1, "Full name is required"),
  username: z.string().min(3).max(20).regex(/^[a-z0-9._]+$/, "Usernames can only contain lowercase letters, numbers, periods, and underscores."),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullname: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    if (!auth || !firestore) return;
    setLoading(true);

    try {
      // Check for username uniqueness
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("username", "==", values.username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        form.setError("username", { message: "This username is already taken." });
        setLoading(false);
        return;
      }
        
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await setDoc(doc(firestore, "users", user.uid), {
        uid: user.uid,
        fullname: values.fullname,
        username: values.username,
        createdAt: serverTimestamp(),
        avatarUrl: null,
      });

      toast({ title: "Account created successfully!" });
      router.push("/");

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            form.setError("email", { message: "This email is already in use." });
        } else {
            console.error("Error creating account:", error);
            toast({ variant: "destructive", title: "Sign Up Failed", description: error.message });
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background font-sans">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>Enter your details to get started with EchoVerse.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
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
                      <Input placeholder="john.doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating Account..." : "Sign Up"}
              </Button>
            </form>
          </Form>
           <div className="mt-4 text-center text-sm">
                Already have an account?{' '}
                <Link href="/login" className="underline">
                    Sign in
                </Link>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
