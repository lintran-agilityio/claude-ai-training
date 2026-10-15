"use client";

import { MainLayout } from "@/components/layouts";

/**
 * Shared shell for Home and Bookings so chat/thread state survives tab navigation.
 * Without this, each page mounts its own MainLayout and remounts CopilotChat.
 */
export default function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainLayout>{children}</MainLayout>;
}
