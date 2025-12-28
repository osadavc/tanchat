import { createFileRoute } from "@tanstack/react-router";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { UserType } from "@/app/(auth)/-utils/auth";
import { auth } from "@/app/(auth)/-utils/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { guestRegex, isProductionEnvironment } from "@/lib/constants";
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../-utils/actions";
import { type PostRequestBody, postRequestBodySchema } from "./-utils/schema";

const getTokenlensCatalog = async (): Promise<ModelCatalog | undefined> => {
  try {
    return await fetchModels();
  } catch (err) {
    console.warn("TokenLens: catalog fetch failed, using default catalog", err);
    return; // tokenlens helpers will fall back to defaultCatalog
  }
};

export const Route = createFileRoute("/(chat)/api/chat/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestBody: PostRequestBody;

        try {
          const json = await request.json();
          requestBody = postRequestBodySchema.parse(json);
        } catch (_) {
          return new ChatSDKError("bad_request:api").toResponse();
        }

        try {
          const {
            id,
            message,
            selectedChatModel,
            selectedVisibilityType,
          }: {
            id: string;
            message: ChatMessage;
            selectedChatModel: ChatModel["id"];
            selectedVisibilityType: VisibilityType;
          } = requestBody;

          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session?.user) {
            return new ChatSDKError("unauthorized:chat").toResponse();
          }

          // Determine user type from email pattern (guest users have guest-* emails)
          const userType: UserType = guestRegex.test(session.user.email ?? "")
            ? "guest"
            : "regular";

          const messageCount = await getMessageCountByUserId({
            id: session.user.id,
            differenceInHours: 24,
          });

          if (
            messageCount > entitlementsByUserType[userType].maxMessagesPerDay
          ) {
            return new ChatSDKError("rate_limit:chat").toResponse();
          }

          const chat = await getChatById({ id });
          let messagesFromDb: DBMessage[] = [];

          if (chat) {
            if (chat.userId !== session.user.id) {
              return new ChatSDKError("forbidden:chat").toResponse();
            }
            // Only fetch messages if chat already exists
            messagesFromDb = await getMessagesByChatId({ id });
          } else {
            const title = await generateTitleFromUserMessage({
              message,
            });

            await saveChat({
              id,
              userId: session.user.id,
              title,
              visibility: selectedVisibilityType,
            });
            // New chat - no need to fetch messages, it's empty
          }

          const uiMessages = [...convertToUIMessages(messagesFromDb), message];

          const { longitude, latitude, city, country } = geolocation(request);

          const requestHints: RequestHints = {
            longitude,
            latitude,
            city,
            country,
          };

          await saveMessages({
            messages: [
              {
                chatId: id,
                id: message.id,
                role: "user",
                parts: message.parts,
                attachments: [],
                createdAt: new Date(),
              },
            ],
          });

          let finalMergedUsage: AppUsage | undefined;

          const stream = createUIMessageStream({
            execute: ({ writer: dataStream }) => {
              const result = streamText({
                model: myProvider.languageModel(selectedChatModel),
                system: systemPrompt({ selectedChatModel, requestHints }),
                messages: convertToModelMessages(uiMessages),
                stopWhen: stepCountIs(5),
                experimental_activeTools:
                  selectedChatModel === "chat-model-reasoning"
                    ? []
                    : [
                        "getWeather",
                        "createDocument",
                        "updateDocument",
                        "requestSuggestions",
                      ],
                experimental_transform: smoothStream({ chunking: "word" }),
                tools: {
                  getWeather,
                  createDocument: createDocument({ session, dataStream }),
                  updateDocument: updateDocument({ session, dataStream }),
                  requestSuggestions: requestSuggestions({
                    session,
                    dataStream,
                  }),
                },
                experimental_telemetry: {
                  isEnabled: isProductionEnvironment,
                  functionId: "stream-text",
                },
                onFinish: async ({ usage }) => {
                  try {
                    const providers = await getTokenlensCatalog();
                    const modelId =
                      myProvider.languageModel(selectedChatModel).modelId;
                    if (!modelId) {
                      finalMergedUsage = usage;
                      dataStream.write({
                        type: "data-usage",
                        data: finalMergedUsage,
                      });
                      return;
                    }

                    if (!providers) {
                      finalMergedUsage = usage;
                      dataStream.write({
                        type: "data-usage",
                        data: finalMergedUsage,
                      });
                      return;
                    }

                    const summary = getUsage({ modelId, usage, providers });
                    finalMergedUsage = {
                      ...usage,
                      ...summary,
                      modelId,
                    } as AppUsage;
                    dataStream.write({
                      type: "data-usage",
                      data: finalMergedUsage,
                    });
                  } catch (err) {
                    console.warn("TokenLens enrichment failed", err);
                    finalMergedUsage = usage;
                    dataStream.write({
                      type: "data-usage",
                      data: finalMergedUsage,
                    });
                  }
                },
              });

              result.consumeStream();

              dataStream.merge(
                result.toUIMessageStream({
                  sendReasoning: true,
                })
              );
            },
            generateId: generateUUID,
            onFinish: async ({ messages }) => {
              await saveMessages({
                messages: messages.map((currentMessage) => ({
                  id: currentMessage.id,
                  role: currentMessage.role,
                  parts: currentMessage.parts,
                  createdAt: new Date(),
                  attachments: [],
                  chatId: id,
                })),
              });

              if (finalMergedUsage) {
                try {
                  await updateChatLastContextById({
                    chatId: id,
                    context: finalMergedUsage,
                  });
                } catch (err) {
                  console.warn(
                    "Unable to persist last usage for chat",
                    id,
                    err
                  );
                }
              }
            },
            onError: () => {
              return "Oops, an error occurred!";
            },
          });

          return new Response(
            stream.pipeThrough(new JsonToSseTransformStream())
          );
        } catch (error) {
          const vercelId = request.headers.get("x-vercel-id");

          if (error instanceof ChatSDKError) {
            return error.toResponse();
          }

          // Check for Vercel AI Gateway credit card error
          if (
            error instanceof Error &&
            error.message?.includes(
              "AI Gateway requires a valid credit card on file to service requests"
            )
          ) {
            return new ChatSDKError(
              "bad_request:activate_gateway"
            ).toResponse();
          }

          console.error("Unhandled error in chat API:", error, { vercelId });
          return new ChatSDKError("offline:chat").toResponse();
        }
      },
      DELETE: async ({ request }) => {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
          return new ChatSDKError("bad_request:api").toResponse();
        }

        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (!session?.user) {
          return new ChatSDKError("unauthorized:chat").toResponse();
        }

        const chat = await getChatById({ id });

        if (chat?.userId !== session.user.id) {
          return new ChatSDKError("forbidden:chat").toResponse();
        }

        const deletedChat = await deleteChatById({ id });

        return Response.json(deletedChat, { status: 200 });
      },
    },
  },
});
