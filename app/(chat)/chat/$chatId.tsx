import {
  createFileRoute,
  notFound,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { auth } from "@/app/(auth)/-utils/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";

const fetchChatData = createServerFn()
  .inputValidator((data: { chatId: string }) => data)
  .handler(async ({ data: { chatId } }) => {
    if (!z.uuid().safeParse(chatId).success) {
      throw notFound();
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      throw notFound();
    }

    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      throw redirect({ to: "/api/auth/guest" });
    }

    if (chat.visibility === "private") {
      if (!session?.user) {
        throw notFound();
      }

      if (session.user.id !== chat.userId) {
        throw notFound();
      }
    }

    const messagesFromDb = await getMessagesByChatId({
      id: chatId,
    });
    const uiMessages = convertToUIMessages(messagesFromDb);

    const chatModelFromCookie = getCookie("chat-model");

    return {
      chat,
      chatModelFromCookie,
      // TODO: serialization issue with UIMessage type
      uiMessages: uiMessages as any,
      session,
    };
  });

// Server function for new chats (without chat validation)
const fetchNewChatData = createServerFn()
  .inputValidator((data: { chatId: string }) => data)
  .handler(async ({ data: { chatId } }) => {
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      throw redirect({ to: "/api/auth/guest" });
    }

    const chatModelFromCookie = getCookie("chat-model");

    return {
      chatId,
      chatModelFromCookie,
      session,
      isNewChat: true as const,
    };
  });

export const Route = createFileRoute("/(chat)/chat/$chatId")({
  component: ChatPage,
  validateSearch: zodValidator(
    z.object({
      new: z.boolean().optional(),
    })
  ),
  loaderDeps: ({ search }) => ({ isNew: search.new }),
  loader: async ({ params: { chatId }, deps: { isNew } }) => {
    if (isNew) {
      return await fetchNewChatData({ data: { chatId } });
    }

    return await fetchChatData({ data: { chatId } });
  },
});

function ChatPage() {
  const loaderData = Route.useLoaderData();
  const { new: isNewChat } = Route.useSearch();

  const newChatMessage = useRouterState({
    select: (s) => s.location.state.newChatMessage,
  });

  if (isNewChat && "chatId" in loaderData) {
    const { chatId: id, chatModelFromCookie: modelFromCookie } = loaderData;
    const modelId =
      newChatMessage?.modelId ?? modelFromCookie ?? DEFAULT_CHAT_MODEL;
    const visibilityType = newChatMessage?.visibilityType ?? "private";

    return (
      <>
        <Chat
          id={id}
          initialChatModel={modelId}
          initialMessages={[]}
          initialPendingMessage={newChatMessage}
          initialVisibilityType={visibilityType}
          isReadonly={false}
        />
        <DataStreamHandler />
      </>
    );
  }

  const existingChatData = loaderData as {
    chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>;
    chatModelFromCookie: string | undefined;
    uiMessages: ChatMessage[];
    session: { user: { id: string } };
  };

  const { chat, chatModelFromCookie, uiMessages, session } = existingChatData;

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialLastContext={chat.lastContext ?? undefined}
          initialMessages={uiMessages}
          initialVisibilityType={chat.visibility}
          isReadonly={session?.user?.id !== chat.userId}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        id={chat.id}
        initialChatModel={chatModelFromCookie}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
