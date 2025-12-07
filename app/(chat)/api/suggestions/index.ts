import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/app/(auth)/-utils/auth";
import { getSuggestionsByDocumentId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const Route = createFileRoute("/(chat)/api/suggestions/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url);
        const documentId = searchParams.get("documentId");

        if (!documentId) {
          return new ChatSDKError(
            "bad_request:api",
            "Parameter documentId is required."
          ).toResponse();
        }

        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (!session?.user) {
          return new ChatSDKError("unauthorized:suggestions").toResponse();
        }

        const suggestions = await getSuggestionsByDocumentId({
          documentId,
        });

        const [suggestion] = suggestions;

        if (!suggestion) {
          return Response.json([], { status: 200 });
        }

        if (suggestion.userId !== session.user.id) {
          return new ChatSDKError("forbidden:api").toResponse();
        }

        return Response.json(suggestions, { status: 200 });
      },
    },
  },
});
