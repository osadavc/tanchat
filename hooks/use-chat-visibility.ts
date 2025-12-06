"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { updateChatVisibility } from "@/app/(chat)/actions";
import {
  type ChatHistory,
} from "@/components/sidebar-history";
import type { VisibilityType } from "@/components/visibility-selector";
import { queryKeys } from "@/lib/query-keys";
import { useVisibilityStore } from "@/stores/visibility-store";

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const queryClient = useQueryClient();
  const history = queryClient.getQueryData<{
    pages: ChatHistory[];
    pageParams: unknown[];
  }>(queryKeys.chatHistory);

  const localVisibility = useVisibilityStore((state) => state.visibility[chatId] ?? initialVisibilityType);
  const setLocalVisibility = useVisibilityStore((state) => state.setVisibility);

  const visibilityType = useMemo(() => {
    if (!history) {
      return localVisibility;
    }
    
    // Flatten all pages to find the chat
    const chat = history.pages
      .flatMap((page) => page.chats)
      .find((currentChat) => currentChat.id === chatId);

    if (!chat) {
      return localVisibility;
    }
    return chat.visibility;
  }, [history, chatId, localVisibility]);

  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(chatId, updatedVisibilityType);
    
    // Optimistically update the history cache if it exists
    queryClient.setQueryData<{
      pages: ChatHistory[];
      pageParams: unknown[];
    }>(queryKeys.chatHistory, (oldData) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          chats: page.chats.map((chat) => 
            chat.id === chatId 
              ? { ...chat, visibility: updatedVisibilityType } 
              : chat
          ),
        })),
      };
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory });

    updateChatVisibility({
      chatId,
      visibility: updatedVisibilityType,
    });
  };

  return { visibilityType, setVisibilityType };
}
