import React, { useState, useEffect } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { Search, FileText } from "lucide-react";
import { useLogFile } from "@/contexts/LogFileContext";
import { Spinner } from "@/components/ui/spinner";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [availableLogs, setAvailableLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { selectedFile, setSelectedFile } = useLogFile();

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:5360/get_available_logs');
        const files = await response.json();
        // Filter only .jsonl files
        const logFiles = files.filter((file: string) => file.endsWith('.jsonl'));
        setAvailableLogs(logFiles);
        
        // Select the first file by default if none is selected
        if (logFiles.length > 0 && !selectedFile) {
          setSelectedFile(logFiles[0]);
        }
      } catch (error) {
        console.error('Error fetching log files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = availableLogs.filter(log => 
    log.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="flex justify-center py-4">
                        <Spinner className="w-6 h-6 text-primary-500" />
                      </div>
                    ) : filteredLogs.length > 0 ? (
                      filteredLogs.map((log) => (
                        <button
                          key={log}
                          className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                            selectedFile === log 
                              ? 'bg-primary-100 text-primary-900' 
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                          onClick={() => setSelectedFile(log)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {log}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No logs found
                      </div>
                    )}
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </SidebarProvider>
  );
};
