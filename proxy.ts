import { clerkMiddleware } from "@clerk/nextjs/server";

function isPublicRoute(request: Request, pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/v/") ||
    pathname.startsWith("/voom/")
  ) {
    return true;
  }

  if (pathname === "/api/webhooks/assemblyai") {
    return true;
  }

  if (request.method === "GET" && /^\/api\/videos\/[^/]+$/.test(pathname)) {
    return true;
  }

  return (
    request.method === "GET" &&
    (/^\/api\/videos\/[^/]+\/transcript$/.test(pathname) ||
      /^\/api\/videos\/[^/]+\/summary$/.test(pathname))
  );
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req, req.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
