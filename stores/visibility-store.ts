import { create } from "zustand";
import type { VisibilityType } from "@/components/visibility-selector";

interface VisibilityState {
  visibility: Record<string, VisibilityType>;
  setVisibility: (chatId: string, visibility: VisibilityType) => void;
}

export const useVisibilityStore = create<VisibilityState>((set) => ({
  visibility: {},
  setVisibility: (chatId, visibility) =>
    set((state) => ({
      visibility: {
        ...state.visibility,
        [chatId]: visibility,
      },
    })),
}));
