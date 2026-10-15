import { cn } from "@repo/utils";

import { getBookingStatusMeta } from "@/features/booking/utils/booking";

type BookingStatusBadgeProps = {
  status: string;
  className?: string;
};

export const BookingStatusBadge = ({
  status,
  className,
}: BookingStatusBadgeProps) => {
  const { label, className: statusClassName } = getBookingStatusMeta(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-medium tracking-wide uppercase",
        statusClassName,
        className,
      )}
    >
      {label}
    </span>
  );
};
