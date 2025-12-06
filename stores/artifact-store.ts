import { create } from "zustand";
import type { UIArtifact } from "@/components/artifact";

export const initialArtifactData: UIArtifact = {
  documentId: "init",
  content: "",
  kind: "text",
  title: "",
  status: "idle",
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

interface ArtifactState {
  artifact: UIArtifact;
  metadata: any;
  setArtifact: (updater: UIArtifact | ((current: UIArtifact) => UIArtifact)) => void;
  setMetadata: (updater: any | ((current: any) => any)) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  artifact: initialArtifactData,
  metadata: null,
  setArtifact: (updater) =>
    set((state) => {
      const newArtifact =
        typeof updater === "function" ? updater(state.artifact) : updater;
      
      // Reset metadata if documentId changes
      if (newArtifact.documentId !== state.artifact.documentId) {
        return { artifact: newArtifact, metadata: null };
      }
      
      return { artifact: newArtifact };
    }),
  setMetadata: (updater) =>
    set((state) => ({
      metadata: typeof updater === "function" ? updater(state.metadata) : updater,
    })),
}));
