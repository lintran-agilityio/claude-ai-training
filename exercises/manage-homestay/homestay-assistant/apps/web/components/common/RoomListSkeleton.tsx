import { cn } from "@repo/utils";

type RoomListSkeletonProps = {
  className?: string;
  itemCount?: number;
};

const SkeletonItem = () => (
  <div className="w-full min-w-0 rounded-2xl border border-border bg-muted/40 p-3">
    <div className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
    <div className="mt-4 space-y-3">
      <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted/70" />
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted/70" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted/70" />
      </div>
    </div>
  </div>
);

export const RoomListSkeleton = ({
  className,
  itemCount = 6,
}: RoomListSkeletonProps) => (
  <section className={cn("space-y-4", className)} aria-busy="true">
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-gold/40" />
      <div className="h-5 w-44 animate-pulse rounded-full bg-muted" />
    </div>

    <div className="grid grid-cols-1 gap-4 overflow-hidden pb-1 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: itemCount }, (_, index) => (
        <SkeletonItem key={`skeleton-item-${index}`} />
      ))}
    </div>
  </section>
);
