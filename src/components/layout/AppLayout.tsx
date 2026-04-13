import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import MobileNav from "./MobileNav";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

export default function AppLayout() {
  useAutoRefresh();

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
