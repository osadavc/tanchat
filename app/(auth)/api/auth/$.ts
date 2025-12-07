import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../-utils/auth";

export const Route = createFileRoute("/(auth)/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => {
        return auth.handler(request);
      },
      POST: ({ request }) => {
        return auth.handler(request);
      },
    },
  },
});
