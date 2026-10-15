import { Loading } from "@repo/components";

export const AuthLoadingFallback = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loading />
    </div>
  );
};
