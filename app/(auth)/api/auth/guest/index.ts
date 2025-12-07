import { createFileRoute } from "@tanstack/react-router";
import { APIError } from "better-auth/api";
import { auth } from "@/app/(auth)/-utils/auth";
import { generateUUID } from "@/lib/utils";

export const Route = createFileRoute("/(auth)/api/auth/guest/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url);
        const redirectUrl = searchParams.get("redirectUrl") || "/";

        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (session) {
          return Response.redirect(new URL("/", request.url));
        }

        // Create guest user in Better Auth system
        // Use guest.local domain to make it a valid email while matching guest pattern
        const guestEmail = `guest-${Date.now()}@guest.local`;
        const guestPassword = generateUUID();

        // Sign up and sign in the guest user
        try {
          await auth.api.signUpEmail({
            body: {
              email: guestEmail,
              password: guestPassword,
              name: "Guest",
            },
            headers: request.headers,
          });
        } catch (error) {
          if (error instanceof APIError && error.status === 409) {
            // If user already exists, try to sign in
            try {
              await auth.api.signInEmail({
                body: {
                  email: guestEmail,
                  password: guestPassword,
                },
                headers: request.headers,
              });
            } catch (signInError) {
              if (signInError instanceof APIError) {
                const status =
                  typeof signInError.status === "number"
                    ? signInError.status
                    : 500;

                return Response.json(
                  { error: signInError.message },
                  { status }
                );
              }

              console.log(signInError);
              return Response.json(
                { error: "Failed to create guest session" },
                { status: 500 }
              );
            }
          } else if (error instanceof APIError) {
            const status =
              typeof error.status === "number" ? error.status : 500;

            return Response.json({ error: error.message }, { status });
          } else {
            console.log(error);
            return Response.json(
              { error: "Failed to create guest session" },
              { status: 500 }
            );
          }
        }

        return Response.redirect(new URL(redirectUrl, request.url));
      },
    },
  },
});
