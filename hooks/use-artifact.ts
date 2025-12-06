"use client";

import { useArtifactStore } from "@/stores/artifact-store";
import type { UIArtifact } from "@/components/artifact";

export { initialArtifactData } from "@/stores/artifact-store";

type Selector<T> = (state: UIArtifact) => T;

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  return useArtifactStore((state) => selector(state.artifact));
}

export function useArtifact() {
  const artifact = useArtifactStore((state) => state.artifact);
  const setArtifact = useArtifactStore((state) => state.setArtifact);
  const metadata = useArtifactStore((state) => state.metadata);
  const setMetadata = useArtifactStore((state) => state.setMetadata);

  return {
    artifact,
    setArtifact,
    metadata,
    setMetadata,
  };
}
