import React, { useState, useEffect } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { Search, FileText, RotateCw, Pencil, Trash2 } from "lucide-react";
import { useLogFile } from "@/contexts/LogFileContext";
import { Spinner } from "@/components/ui/spinner";
import { API_BASE_URL } from '@/config';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [availableLogs, setAvailableLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { selectedFile, setSelectedFile } = useLogFile();
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/get_available_logs`);
      const files = await response.json();
      // Filter only .jsonl files
      const logFiles = files.filter((file: string) => file.endsWith('.jsonl'));
      setAvailableLogs(logFiles);
      
      // If there's a selected file, re-select it to trigger a refresh
      if (selectedFile) {
        // Force a re-selection of the same file to trigger a data refresh
        const currentFile = selectedFile;
        setSelectedFile('');  // Clear selection
        setTimeout(() => setSelectedFile(currentFile), 0);  // Re-select after a tick
      } else if (logFiles.length > 0) {
        setSelectedFile(logFiles[0]);
      }
    } catch (error) {
      console.error('Error fetching log files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    setSearchTerm("");
  }, [selectedFile]);

  const filteredLogs = availableLogs.filter(log => 
    log.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDisplayName = (fullPath: string) => {
    // Extract everything after the last slash and before .jsonl
    const match = fullPath.match(/\/([^/]+)\.jsonl$/);
    return match ? match[1] : fullPath;
  };

  const handleRename = async (oldPath: string, newName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/rename_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_path: oldPath,
          new_name: newName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      // Refresh the file list
      fetchLogs();
      setEditingFile(null);
    } catch (error) {
      console.error('Error renaming file:', error);
      alert('Failed to rename file: ' + error);
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_path: filePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      // Refresh the file list
      fetchLogs();
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file: ' + error);
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-gray-50">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <div className="p-4 space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search logs..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={fetchLogs}
                      disabled={isLoading}
                      className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all disabled:opacity-50"
                      title="Reload logs"
                    >
                      <RotateCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="flex justify-center py-4">
                        <Spinner className="w-6 h-6 text-primary-500" />
                      </div>
                    ) : filteredLogs.length > 0 ? (
                      filteredLogs.map((log) => (
                        <div
                          key={log}
                          className={`flex items-center justify-between px-3 py-2 rounded-md text-sm group ${
                            selectedFile === log 
                              ? 'bg-primary-100' 
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {editingFile === log ? (
                            <form
                              className="flex-1 flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRename(log, newFileName);
                              }}
                            >
                              <input
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border rounded bg-white"
                                autoFocus
                                onBlur={() => {
                                  setEditingFile(null);
                                  setNewFileName("");
                                }}
                              />
                            </form>
                          ) : (
                            <>
                              <button
                                className="flex-1 flex items-center text-left"
                                onClick={() => setSelectedFile(log)}
                              >
                                <FileText className={`w-4 h-4 mr-2 ${
                                  selectedFile === log ? 'text-primary-900' : 'text-gray-500'
                                }`} />
                                <span className={
                                  selectedFile === log ? 'text-primary-900' : 'text-gray-700'
                                }>
                                  {getDisplayName(log)}
                                </span>
                              </button>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (editingFile !== log) {
                                      setEditingFile(log);
                                      setNewFileName(getDisplayName(log));
                                    }
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded transition-all"
                                  title="Rename file"
                                >
                                  <Pencil className="w-3 h-3 text-gray-500" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFileToDelete(log);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded transition-all"
                                  title="Delete file"
                                >
                                  <Trash2 className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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
        <main className="flex-1 p-8 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Log File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{fileToDelete ? getDisplayName(fileToDelete) : ''}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setFileToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => fileToDelete && handleDelete(fileToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};
