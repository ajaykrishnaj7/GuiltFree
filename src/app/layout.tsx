import type { Metadata, Viewport } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";

export const metadata: Metadata = {
  title: "GuiltFree | AI Nutrition Tracker",
  description: "Log meals like a human. Precise nutritional data through AI.",
  metadataBase: new URL(appUrl),
  manifest: "/manifest.json",
  applicationName: "GuiltFree",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: appUrl,
    title: "GuiltFree | AI Nutrition Tracker",
    description: "Log meals like a human. Precise nutritional data through AI.",
    siteName: "GuiltFree",
    images: [
      {
        url: `${appUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "GuiltFree - AI Nutrition Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GuiltFree | AI Nutrition Tracker",
    description: "Log meals like a human. Precise nutritional data through AI.",
    images: [`${appUrl}/twitter-image`],
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "64x64", type: "image/png" },
    ],
    shortcut: ["/icon"],
    apple: [
      { url: "/apple-icon", sizes: "64x64", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { AuthProvider } from "@/components/AuthProvider";
import AppUpdateNotifier from "@/components/AppUpdateNotifier";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showUpdateNotifier = process.env.NODE_ENV === 'production';
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="max-w-2xl mx-auto px-4 pb-32 sm:pb-24">
              <Navbar />
              {showUpdateNotifier ? <AppUpdateNotifier /> : null}
              <main>
                {children}
              </main>
            </div>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
