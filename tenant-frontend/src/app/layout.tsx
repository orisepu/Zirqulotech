import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeWrapper } from "@/context/ThemeContext";
import ThemeRegistry from "./ThemeRegistry";
import { cookies } from "next/headers";
import { ReactQueryProvider } from "@/features/auth/components/providers/ReactQueryProvider";
import { DpiDebugger } from "@/shared/components/dev/DpiDebugger";
import { ResponsiveTypography } from "@/shared/components/layout/ResponsiveTypography";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zirqulo",
  description: "Zirqulo trade app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme_mode')?.value;
  const initialMode = themeCookie === 'dark' || themeCookie === 'light' ? themeCookie : undefined;
  return (
    <html lang="es" data-theme-mode={initialMode ?? undefined}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeRegistry>
          <ThemeWrapper initialMode={initialMode as 'dark' | 'light' | undefined}>
            <ReactQueryProvider>
              <ResponsiveTypography />
              {children}
              <DpiDebugger />
            </ReactQueryProvider>
          </ThemeWrapper>
        </ThemeRegistry>
      </body>
    </html>
  );
}
