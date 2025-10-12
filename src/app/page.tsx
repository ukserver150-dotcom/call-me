"use client";

import { useUser } from "@/firebase/auth/use-user";
import EchoVerseClient from "@/components/EchoVerseClient";
import Onboarding from "@/components/Onboarding";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useRouter } from "next/navigation";


export default function Home() {
  const { user, loading, profile } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background font-sans">
        <LoadingSpinner />
      </main>
    );
  }

  if (user && !profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-12 lg:p-24 bg-background font-sans">
        <Onboarding user={user} />
      </main>
    );
  }

  if (user && profile) {
    return (
      <SidebarProvider>
        <EchoVerseClient user={user} profile={profile} />
      </SidebarProvider>
    );
  }

  return null;
}
