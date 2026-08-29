import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "SIPS - Sistem Informasi Pengasuhan Santri",
  description: "Pusat Kendali Data Terintegrasi, Perizinan & Kedisiplinan Santri",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/sips-logo.png?v=2" },
      { url: "/sips-logo.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/sips-logo.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/sips-logo.png?v=2",
    apple: "/sips-logo.png?v=2",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SIPS Pos Gerbang",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${jakarta.className} bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-emerald-600 selection:text-white transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}