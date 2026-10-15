type ErrorMessagesProps = {
  error: Error;
};

export const ErrorMessages = ({ error }: ErrorMessagesProps) => {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-destructive">{error.message}</p>
    </div>
  );
};
