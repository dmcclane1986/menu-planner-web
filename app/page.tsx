"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/instantdb/auth";
import { isInstantDBConfigured } from "@/lib/instantdb/config";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/household");
    }
  }, [user, loading, router]);

  // Show error if InstantDB is not configured
  if (!isInstantDBConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-24">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-4 text-red-500">Configuration Error</h1>
          <p className="text-gray-300 mb-4">
            NEXT_PUBLIC_INSTANTDB_APP_ID is not set in your environment variables.
          </p>
          <p className="text-gray-400 mb-6">
            Please add this environment variable in your Vercel project settings.
          </p>
          <div className="bg-gray-800 p-4 rounded-lg text-left">
            <p className="text-sm text-gray-300 mb-2">In Vercel:</p>
            <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
              <li>Go to your project settings</li>
              <li>Navigate to Environment Variables</li>
              <li>Add NEXT_PUBLIC_INSTANTDB_APP_ID with your InstantDB App ID</li>
              <li>Redeploy your application</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4 text-primary">
          Menu Planning App
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Your family meal planning assistant
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button variant="primary">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline">Sign Up</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

