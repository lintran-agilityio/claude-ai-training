import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip the Intelligence realtime WS proxy — Clerk must not touch upgrades.
    "/((?!_next|api/intelligence-realtime|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ttf|woff2?|ico)).*)",
    "/(api(?!/intelligence-realtime)|trpc)(.*)",
  ],
};
