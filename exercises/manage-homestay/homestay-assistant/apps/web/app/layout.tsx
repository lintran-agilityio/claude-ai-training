import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

import { cn } from "@repo/utils";
import { AppErrorBoundary } from "@/providers/app-error-boundary";
import ChatbotProvider from "@/features/chatbot/provider";

// Single font for the whole app.
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HOMESTAY — Room Booking",
  description: "Find and book workspace rooms with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn("font-sans antialiased", lato.variable)}
        suppressHydrationWarning
      >
        <AppErrorBoundary>
          <ClerkProvider
            appearance={{
              options: {
                unsafe_disableDevelopmentModeWarnings: true,
              },
              elements: {
                // Hides "Secured by Clerk" branding in the UserButton popover
                // (dev workaround; production removal requires a paid Clerk
                // plan via Dashboard → Branding).
                userButtonPopoverFooter: {
                  display: "none",
                },
              },
            }}
          >
            <ChatbotProvider>{children}</ChatbotProvider>
          </ClerkProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
