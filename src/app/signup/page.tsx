
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
        form.setError("username", { message: "Username already taken" });
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullname"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input placeholder="Full Name" {...field} id="fullname" className="peer placeholder-transparent"/>
                    </FormControl>
                    <FormLabel htmlFor="fullname" className="absolute left-0 -top-2.5 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base">Full Name</FormLabel>
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
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem className="relative">
                    <FormControl>
                        <Input placeholder="name@example.com" {...field} id="email" className="peer placeholder-transparent"/>
                    </FormControl>
                    <FormLabel htmlFor="email" className="absolute left-0 -top-2.5 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base">Email</FormLabel>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem className="relative">
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} id="password" className="peer placeholder-transparent"/>
                    </FormControl>
                    <FormLabel htmlFor="password" className="absolute left-0 -top-2.5 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base">Password</FormLabel>
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
