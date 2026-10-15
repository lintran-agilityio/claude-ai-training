import { formatPrice, cn } from "@repo/utils";

type RoomBookingPricePerNightProps = {
  pricePerNight: number;
  size?: "sm" | "lg";
  className?: string;
};

export const RoomBookingPricePerNight = ({
  pricePerNight,
  size = "lg",
  className,
}: RoomBookingPricePerNightProps) => {
  return (
    <p
      className={cn(
        "font-semibold text-foreground",
        size === "lg" ? "text-lg" : "text-sm",
        className,
      )}
    >
      {formatPrice(pricePerNight)}
      <span
        className={cn(
          "font-normal text-muted-foreground",
          size === "lg" ? "text-sm" : "text-inherit",
        )}
      >
        {" "}
        / night
      </span>
    </p>
  );
};
