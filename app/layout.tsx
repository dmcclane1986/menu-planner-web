import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/instantdb/auth";

export const metadata: Metadata = {
  title: "Menu Planning App",
  description: "Plan your family meals with AI-powered menu generation",
  manifest: "/manifest.json",
  themeColor: "#ff6b35",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Menu Planner",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Menu Planner" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

