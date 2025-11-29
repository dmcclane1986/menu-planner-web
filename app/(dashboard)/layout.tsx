"use client";

import { useAuth } from "@/lib/instantdb/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-secondary-lighter bg-secondary-light">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            <div className="flex items-center space-x-2 md:space-x-8 flex-1 min-w-0">
              <Link href="/" className="text-lg md:text-xl font-bold text-primary whitespace-nowrap">
                Menu Planner
              </Link>
              <div className="flex space-x-1 md:space-x-4 overflow-x-auto flex-1 min-w-0 scrollbar-hide">
                <Link
                  href="/household"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Households
                </Link>
                <Link
                  href="/menu"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Entrees
                </Link>
                <Link
                  href="/sides"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Sides
                </Link>
                <Link
                  href="/recipes"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Recipes
                </Link>
                <Link
                  href="/menu/calendar"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Calendar
                </Link>
                <Link
                  href="/menu/ai"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  AI Menu
                </Link>
                <Link
                  href="/shopping"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Shopping
                </Link>
                <Link
                  href="/statistics"
                  className="text-gray-300 hover:text-primary active:text-primary px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation"
                >
                  Stats
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
              <span className="text-gray-300 text-xs md:text-sm hidden sm:inline">{user.name}</span>
              <Button variant="outline" size="sm" onClick={signOut} className="touch-manipulation text-xs md:text-sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

