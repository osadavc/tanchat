import { getMessageByErrorCode } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { expect, test } from "../fixtures";
import { TEST_PROMPTS } from "../prompts/routes";

const chatIdsCreatedByAda: string[] = [];

// Helper function to normalize stream data for comparison
function normalizeStreamData(lines: string[]): string[] {
  return lines.map((line) => {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
        if (data.id) {
          // Replace dynamic id with a static one for comparison
          return `data: ${JSON.stringify({ ...data, id: "STATIC_ID" })}`;
        }
        return line;
      } catch {
        return line; // Return as-is if it's not valid JSON
      }
    }
    return line;
  });
}

test.describe
  .serial("/api/chat", () => {
    test("Ada cannot invoke a chat generation with empty request body", async ({
      adaContext,
    }) => {
      const response = await adaContext.request.post("/api/chat", {
        data: JSON.stringify({}),
      });
      expect(response.status()).toBe(400);

      const { code, message } = await response.json();
      expect(code).toEqual("bad_request:api");
      expect(message).toEqual(getMessageByErrorCode("bad_request:api"));
    });

    test("Ada can invoke chat generation", async ({ adaContext }) => {
      const chatId = generateUUID();

      const response = await adaContext.request.post("/api/chat", {
        data: {
          id: chatId,
          message: TEST_PROMPTS.SKY.MESSAGE,
          selectedChatModel: "chat-model",
          selectedVisibilityType: "private",
        },
      });
      expect(response.status()).toBe(200);

      const text = await response.text();
      const lines = text.split("\n");

      const [_, ...rest] = lines;
      const actualNormalized = normalizeStreamData(rest.filter(Boolean));
      const expectedNormalized = normalizeStreamData(
        TEST_PROMPTS.SKY.OUTPUT_STREAM
      );

      expect(actualNormalized).toEqual(expectedNormalized);

      chatIdsCreatedByAda.push(chatId);
    });

    test("Babbage cannot append message to Ada's chat", async ({
      babbageContext,
    }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await babbageContext.request.post("/api/chat", {
        data: {
          id: chatId,
          message: TEST_PROMPTS.GRASS.MESSAGE,
          selectedChatModel: "chat-model",
          selectedVisibilityType: "private",
        },
      });
      expect(response.status()).toBe(403);

      const { code, message } = await response.json();
      expect(code).toEqual("forbidden:chat");
      expect(message).toEqual(getMessageByErrorCode("forbidden:chat"));
    });

    test("Babbage cannot delete Ada's chat", async ({ babbageContext }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await babbageContext.request.delete(
        `/api/chat?id=${chatId}`
      );
      expect(response.status()).toBe(403);

      const { code, message } = await response.json();
      expect(code).toEqual("forbidden:chat");
      expect(message).toEqual(getMessageByErrorCode("forbidden:chat"));
    });

    test("Ada can delete her own chat", async ({ adaContext }) => {
      const [chatId] = chatIdsCreatedByAda;

      const response = await adaContext.request.delete(
        `/api/chat?id=${chatId}`
      );
      expect(response.status()).toBe(200);

      const deletedChat = await response.json();
      expect(deletedChat).toMatchObject({ id: chatId });
    });
  });
