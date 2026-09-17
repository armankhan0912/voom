import { clerkMiddleware } from "@clerk/nextjs/server";

function isPublicRoute(request: Request, pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/v/") ||
    pathname.startsWith("/voom/") ||
    pathname.startsWith("/embed/")
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
      /^\/api\/videos\/[^/]+\/summary$/.test(pathname) ||
      /^\/api\/videos\/[^/]+\/chapters$/.test(pathname))
  );
}

function isApiRoute(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // API routes return JSON 401 themselves. auth.protect() rewrites unsigned
  // extension requests into an HTML 404 (dev-browser-missing), which the
  // recorder surfaces as a generic "Request failed".
  if (isPublicRoute(req, pathname) || isApiRoute(pathname)) {
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
