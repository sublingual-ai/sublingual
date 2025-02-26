import React from "react";
import { LogFilesSidebar } from "@/components/ui/sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <LogFilesSidebar />
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}
