import type { Metadata } from "next";
import { Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { WebVitals } from "@/components/layout/web-vitals";
import { Toaster } from "@/components/ui/sonner";

// Brand fonts (self-hosted at build by next/font — no runtime request).
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: ["500", "600", "700"],
});
const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body-face",
  weight: ["400", "500", "600", "700", "800"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "East Anglia AI Services — CRM",
  description: "Collaborative CRM for East Anglia AI Services",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <WebVitals />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
