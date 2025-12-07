"use server";

import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { generateText, type UIMessage } from "ai";
import { z } from "zod";
import type { VisibilityType } from "@/components/visibility-selector";
import { titlePrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export const saveChatModelAsCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ model: z.string() }))
  .handler(({ data }) => {
    setCookie("chat-model", data.model);
  });

export const generateTitleFromUserMessage = async ({
  message,
}: {
  message: UIMessage;
}) => {
  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });

  return title;
};

export const deleteTrailingMessages = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [message] = await getMessageById({ id: data.id });

    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });
  });

export const updateChatVisibility = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      chatId: z.string(),
      visibility: z.enum(["private", "public"]),
    })
  )
  .handler(async ({ data }) => {
    await updateChatVisibilityById({
      chatId: data.chatId,
      visibility: data.visibility as VisibilityType,
    });
  });
