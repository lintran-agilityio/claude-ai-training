"use client";

// Libs
import { SignIn } from "@clerk/nextjs";

import { ROUTES } from "@/constants";

const LoginPage = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-24">
      <div className="flex flex-col items-center justify-center">
        <SignIn
          routing="path"
          path={ROUTES.LOGIN}
          appearance={{
            elements: {
              // Hides "Secured by Clerk" footer branding (dev workaround;
              // production removal requires Clerk Dashboard → Branding).
              footer: {
                "& > :last-child": {
                  display: "none",
                },
              },
            },
          }}
        />
      </div>
    </main>
  );
};

export default LoginPage;
