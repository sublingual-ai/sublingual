import React from "react";
import { LogFilesSidebar } from "@/components/LogFilesSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  showLogsSidebar?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  showLogsSidebar = true 
}) => {
  return (
    <div className="flex h-screen">
      {showLogsSidebar && <LogFilesSidebar />}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
};
