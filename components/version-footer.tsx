"use client";

import { useQueryClient } from "@tanstack/react-query";
import { isAfter } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { queryKeys } from "@/lib/query-keys";
import { getDocumentTimestampByIndex } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { Button } from "./ui/button";

type VersionFooterProps = {
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  documents: Document[] | undefined;
  currentVersionIndex: number;
};

export const VersionFooter = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
}: VersionFooterProps) => {
  const { artifact } = useArtifact();

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const queryClient = useQueryClient();
  const [isMutating, setIsMutating] = useState(false);

  if (!documents) {
    return;
  }

  return (
    <motion.div
      animate={{ y: 0 }}
      className="absolute bottom-0 z-50 flex w-full flex-col justify-between gap-4 border-t bg-background p-4 lg:flex-row"
      exit={{ y: isMobile ? 200 : 77 }}
      initial={{ y: isMobile ? 200 : 77 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
    >
      <div>
        <div>You are viewing a previous version</div>
        <div className="text-muted-foreground text-sm">
          Restore this version to make edits
        </div>
      </div>

      <div className="flex flex-row gap-4">
        <Button
          disabled={isMutating}
          onClick={async () => {
            setIsMutating(true);

            const timestamp = getDocumentTimestampByIndex(
              documents,
              currentVersionIndex
            );
            
            const queryKey = queryKeys.documents(artifact.documentId);

            // Optimistic update
            queryClient.setQueryData<Document[]>(queryKey, (oldDocuments) => {
                if (!oldDocuments) return [];
                return [
                  ...oldDocuments.filter((document) =>
                    isAfter(
                      new Date(document.createdAt),
                      new Date(timestamp)
                    )
                  ),
                ];
            });

            try {
              await fetch(
                `/api/document?id=${artifact.documentId}&timestamp=${timestamp}`,
                {
                  method: "DELETE",
                }
              );
              
              // Invalidate to ensure consistency
              queryClient.invalidateQueries({ queryKey });
            } catch (error) {
              // Revert or handle error - for now we just invalidate
               queryClient.invalidateQueries({ queryKey });
            } finally {
               setIsMutating(false);
            }
          }}
        >
          <div>Restore this version</div>
          {isMutating && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
        </Button>
        <Button
          onClick={() => {
            handleVersionChange("latest");
          }}
          variant="outline"
        >
          Back to latest version
        </Button>
      </div>
    </motion.div>
  );
};
