import { createMiddleware, createStart } from "@tanstack/react-start";
import { auth } from "@/app/(auth)/-utils/auth";
import { guestRegex } from "@/lib/constants";

const authMiddleware = createMiddleware().server(
  async ({ request, context, next }) => {
    const requestUrl = new URL(request.url);

    /*
     * Playwright starts the dev server and requires a 200 status to
     * begin the tests, so this ensures that the tests can start
     */
    if (requestUrl.pathname.startsWith("/ping")) {
      return {
        request,
        pathname: requestUrl.pathname,
        context,
        response: new Response("pong", { status: 200 }),
      };
    }

    // Allow auth API routes to pass through
    if (requestUrl.pathname.startsWith("/api/auth")) {
      return next();
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      const redirectUrl = encodeURIComponent(request.url);

      return {
        request,
        pathname: requestUrl.pathname,
        context,
        response: Response.redirect(
          new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url),
          302
        ),
      };
    }

    const isGuest = guestRegex.test(session.user?.email ?? "");

    if (
      session &&
      !isGuest &&
      ["/login", "/register"].includes(requestUrl.pathname)
    ) {
      return {
        request,
        pathname: requestUrl.pathname,
        context,
        response: Response.redirect(new URL("/", request.url), 302),
      };
    }

    return next();
  }
);

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [authMiddleware],
  };
});
