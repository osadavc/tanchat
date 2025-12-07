import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@/app/(auth)/-utils/auth";
import { authClient } from "@/lib/auth-client";

type SessionContextType = {
  session: Session | null;
  isPending: boolean;
  refetch: () => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider = ({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) => {
  const [session, setSession] = useState<Session | null>(initialSession);
  const { data, isPending, refetch } = authClient.useSession();

  useEffect(() => {
    if (data) {
      setSession(data);
    }
  }, [data]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isPending,
        refetch,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return {
    data: context.session,
    isPending: context.isPending,
    refetch: context.refetch,
  };
};
