"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

import { cn } from "@repo/utils";
import { NavbarTab } from "@repo/types";
import { ROUTES } from "@/constants";
import { Logo } from "@/components/common";
import { Loading } from "@repo/components";

type NavbarProps = {
  activeTab?: NavbarTab.HOME | NavbarTab.MY_BOOKINGS;
  className?: string;
};

export const Navbar = ({ activeTab = NavbarTab.HOME, className }: NavbarProps) => {
  const { isLoaded, user } = useUser();
  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : (user?.firstName?.[0] ?? "AL");

  if (!isLoaded) {
    return <Loading />;
  }

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border px-6 py-4",
        className,
      )}
    >
      <Link
        href="/"
        className="text-sm transition-colors"
      >
        <Logo />
      </Link>

      <nav className="flex items-center gap-8">
        <Link
          href="/"
          className={cn(
            "border-b-2 pb-1 text-sm transition-colors",
            activeTab === NavbarTab.HOME
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Homestay
        </Link>
        <Link
          href={ROUTES.BOOKINGS}
          className={cn(
            "border-b-2 pb-1 text-sm transition-colors",
            activeTab === NavbarTab.MY_BOOKINGS
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          My Bookings
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground lg:hidden">
            {initials.toUpperCase()}
          </div>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-9",
              },
            }}
          />
        </div>
      </nav>
    </header>
  );
}
