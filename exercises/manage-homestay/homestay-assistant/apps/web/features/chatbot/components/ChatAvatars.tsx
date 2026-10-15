import { cn } from "@repo/utils";

import { LogoMark } from "@/components/common";

type AvatarProps = {
  className?: string;
};

export const ChatAgentAvatar = ({ className }: AvatarProps) => (
  <div
    className={cn(
      "flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/15",
      className,
    )}
    aria-hidden
  >
    <LogoMark className="size-4" />
  </div>
);
