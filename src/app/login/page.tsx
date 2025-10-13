
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
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/firebase/auth/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    if (!auth) return;
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Signed in successfully!" });
      router.push("/");
    } catch (error: any) {
      console.error("Error signing in:", error);
      if (error.code === 'auth/invalid-credential') {
        toast({ variant: "destructive", title: "Sign In Failed", description: "Invalid email or password. Please try again." });
      } else {
        toast({ variant: "destructive", title: "Sign In Failed", description: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background font-sans">
        <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                {loading ? "Signing In..." : "Sign In"}
                </Button>
            </form>
            </Form>
            <div className="mt-4 text-center text-sm">
                Don't have an account?{' '}
                <Link href="/signup" className="underline">
                    Sign up
                </Link>
            </div>
        </CardContent>
        </Card>
    </main>
  );
}
