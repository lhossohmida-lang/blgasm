import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/app/providers";

export const metadata: Metadata = {
  title: "بلقاسم POS",
  description: "تطبيق إدارة محل مواد غذائية يعمل بدون إنترنت ويدعم QR والكريدي والتقارير.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "بلقاسم POS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#49a35c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
