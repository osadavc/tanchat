export const queryKeys = {
  chatHistory: ["chat-history"] as const,
  votes: (chatId: string) => ["votes", chatId] as const,
  documents: (id: string) => ["documents", id] as const,
};
