import { Sparkles } from "lucide-react";

import { cn } from "@repo/utils";

type LogoMarkProps = {
  className?: string;
};

/**
 * The single SPACES brand mark: a three-star sparkle.
 * Use this everywhere a standalone brand icon is needed (navbar, chat header,
 * assistant avatar) so the app shows one consistent logo.
 */
export const LogoMark = ({ className }: LogoMarkProps) => (
  <Sparkles
    aria-hidden
    strokeWidth={1.5}
    className={cn("size-9 text-gold", className)}
  />
);

type LogoProps = {
  className?: string;
};

export const Logo = ({ className }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden className="flex size-9 items-center justify-center">
        <LogoMark className="size-7" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-lg font-semibold tracking-[0.28em] text-foreground">
          SPACES
        </span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.3em] text-muted-foreground">
          BOUTIQUE HOMESTAY
        </span>
      </span>
    </div>
  );
};
