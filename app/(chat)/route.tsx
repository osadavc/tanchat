import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SessionProvider } from "@/components/session-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "../(auth)/auth";

const loader = createServerFn().handler(async () => {
  const [session, sidebarState] = await Promise.all([
    auth.api.getSession({
      headers: getRequestHeaders(),
    }),
    getCookie("sidebar_state"),
  ]);

  return { session, sidebarState };
});

export const Route = createFileRoute("/(chat)")({
  component: Layout,
  loader: () => loader(),
});

function Layout() {
  const { session, sidebarState } = Route.useLoaderData();
  const isCollapsed = sidebarState !== "true";

  return (
    <SessionProvider initialSession={session}>
      <DataStreamProvider>
        <SidebarProvider defaultOpen={!isCollapsed}>
          <AppSidebar user={session?.user} />
          <SidebarInset>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </SessionProvider>
  );
}
