import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { Suspense, useCallback, useState } from "react";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import type { CustomSubmitData } from "@/components/multimodal-input";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/-utils/auth";

const loader = createServerFn().handler(async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });

  if (!session) {
    redirect({ to: "/api/auth/guest" });
  }

  const id = generateUUID();
  const modelIdFromCookie = getCookie("chat-model");

  return { id, modelIdFromCookie };
});

export const Route = createFileRoute("/(chat)/")({
  component: Home,
  loader: () => loader(),
});

function Home() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <NewChatPage />
    </Suspense>
  );
}

function NewChatPage() {
  const { modelIdFromCookie, id } = Route.useLoaderData();
  const navigate = useNavigate();
  const [currentModelId, setCurrentModelId] = useState(
    modelIdFromCookie ?? DEFAULT_CHAT_MODEL
  );

  const handleCustomSubmit = useCallback(
    (data: CustomSubmitData) => {
      navigate({
        to: "/chat/$chatId",
        params: { chatId: id },
        search: { new: true },
        state: {
          newChatMessage: {
            input: data.input,
            attachments: data.attachments,
            modelId: currentModelId,
            visibilityType: "private" as const,
          },
        },
      });
    },
    [navigate, id, currentModelId]
  );

  return (
    <>
      <Chat
        id={id}
        initialChatModel={currentModelId}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
        onCustomSubmit={handleCustomSubmit}
        onModelChange={setCurrentModelId}
      />
      <DataStreamHandler />
    </>
  );
}
