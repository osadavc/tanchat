import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";

const loader = createServerFn()
  .inputValidator((data: { chatId: string }) => data)
  .handler(async ({ data: { chatId } }) => {
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

export const Route = createFileRoute("/(chat)/chat/$chatId")({
  component: Page,
});

function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatPage />
    </Suspense>
  );
}

function ChatPage() {
  const { chatId } = Route.useParams();
  const loaderFn = useServerFn(loader);

  const {
    data: { chat, chatModelFromCookie, uiMessages: rawMessages, session },
  } = useSuspenseQuery({
    queryKey: ["chat", "chatId", chatId],
    queryFn: () => loaderFn({ data: { chatId } }),
  });

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
