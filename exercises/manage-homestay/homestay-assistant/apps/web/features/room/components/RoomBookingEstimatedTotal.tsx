type RoomBookingEstimatedTotalProps = {
  estimatedTotal: string | null;
  className?: string;
};

export const RoomBookingEstimatedTotal = ({
  estimatedTotal,
  className,
}: RoomBookingEstimatedTotalProps) => {
  if (!estimatedTotal) {
    return null;
  }

  return (
    <div className={className ?? "flex items-center justify-between text-sm"}>
      <span className="text-muted-foreground">Estimated total</span>
      <span className="font-semibold text-foreground">{estimatedTotal}</span>
    </div>
  );
};
