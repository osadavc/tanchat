import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
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
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return { notFound: true as const };
    }

    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      return { redirect: "/api/auth/guest" as const };
    }

    if (chat.visibility === "private") {
      if (!session?.user) {
        return { notFound: true as const };
      }

      if (session.user.id !== chat.userId) {
        return { notFound: true as const };
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

export const Route = createFileRoute("/(chat)/chat/$chatId")({
  component: ChatPage,
  loader: async ({ params: { chatId } }) => {
    const result = await fetchChatData({ data: { chatId } });

    if ("notFound" in result) {
      throw notFound();
    }

    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }

    return result;
  },
});

function ChatPage() {
  const {
    chat,
    chatModelFromCookie,
    uiMessages: rawMessages,
    session,
  } = Route.useLoaderData();

  const uiMessages = rawMessages as ChatMessage[];

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
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
        autoResume={true}
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
