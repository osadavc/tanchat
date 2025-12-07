import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { zodValidator } from "@tanstack/zod-adapter";
import { Suspense } from "react";
import z from "zod";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/auth";

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
  validateSearch: zodValidator(
    z.object({
      query: z.string().optional(),
    })
  ),
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
  const { query } = Route.useSearch();

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          autoResume={false}
          id={id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
          initialVisibilityType="private"
          isReadonly={false}
          key={id}
          query={query}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={modelIdFromCookie}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
        query={query}
      />
      <DataStreamHandler />
    </>
  );
}
