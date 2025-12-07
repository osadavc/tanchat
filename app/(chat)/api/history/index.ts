import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/app/(auth)/-utils/auth";
import { deleteAllChatsByUserId, getChatsByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const Route = createFileRoute("/(chat)/api/history/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url);

        const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
        const startingAfter = searchParams.get("starting_after");
        const endingBefore = searchParams.get("ending_before");

        if (startingAfter && endingBefore) {
          return new ChatSDKError(
            "bad_request:api",
            "Only one of starting_after or ending_before can be provided."
          ).toResponse();
        }

        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (!session?.user) {
          return new ChatSDKError("unauthorized:chat").toResponse();
        }

        const chats = await getChatsByUserId({
          id: session.user.id,
          limit,
          startingAfter,
          endingBefore,
        });

        return Response.json(chats);
      },
      DELETE: async ({ request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (!session?.user) {
          return new ChatSDKError("unauthorized:chat").toResponse();
        }

        const result = await deleteAllChatsByUserId({
          userId: session.user.id,
        });

        return Response.json(result, { status: 200 });
      },
    },
  },
});
