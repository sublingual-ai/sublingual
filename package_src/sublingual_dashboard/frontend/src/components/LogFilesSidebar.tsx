import * as React from "react"
import { RefreshCcw, CheckSquare, Square, Trash2, AlertTriangle, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogFile } from "@/contexts/LogFileContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { API_BASE_URL } from "@/config"

export function LogFilesSidebar() {
  const { toast } = useToast();
  const { 
    selectedFiles, 
    availableFiles, 
    toggleFile, 
    selectAllFiles, 
    deselectAllFiles,
    refreshFiles
  } = useLogFile();
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [editingFile, setEditingFile] = React.useState<string | null>(null);
  const [newFileName, setNewFileName] = React.useState("");

  // Filter files based on search query
  const filteredFiles = React.useMemo(() => {
    if (!searchQuery.trim()) return availableFiles;
    
    const query = searchQuery.toLowerCase();
    return availableFiles.filter(file => {
      const fileName = getFileName(file.path).toLowerCase();
      return fileName.includes(query);
    });
  }, [availableFiles, searchQuery]);

  function getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFiles();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    
    try {
      // Send batched delete request to the backend
      const response = await fetch(`${API_BASE_URL}/delete_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_paths: selectedFiles }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete log files');
      }
      
      // Refresh the file list after deletion
      await refreshFiles();
      
      // Deselect all files after successful deletion
      deselectAllFiles();
      
      // Show success toast
      toast({
        title: "Logs deleted",
        description: `Successfully deleted ${selectedFiles.length} log file(s)`,
      });
    } catch (error) {
      console.error('Error deleting log files:', error);
      
      // Show error toast instead of alert
      toast({
        variant: "destructive",
        title: "Error deleting logs",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditFileName = (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent toggling selection
    const fileName = getFileName(filePath).replace(/\.jsonl$/, '');
    setEditingFile(filePath);
    setNewFileName(fileName);
  };
  
  const handleSaveFileName = async () => {
    if (!editingFile || !newFileName.trim()) {
      setEditingFile(null);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rename_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_path: editingFile,
          new_name: newFileName.trim()
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename log file');
      }
      
      // Refresh the file list after renaming
      await refreshFiles();
      
      // Show success toast
      toast({
        title: "Log renamed",
        description: "Successfully renamed the log file",
      });
    } catch (error) {
      console.error('Error renaming log file:', error);
      
      toast({
        variant: "destructive",
        title: "Error renaming log",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setEditingFile(null);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveFileName();
    } else if (e.key === 'Escape') {
      setEditingFile(null);
    }
  };

  return (
    <>
      <div className="w-64 border-r bg-gray-50/40 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex gap-2 mb-4">
            <Input
              type="text"
              placeholder="Search logs..."
              className="h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllFiles}
              className="flex-1"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAllFiles}
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={isDeleting || selectedFiles.length === 0}
            className="w-full"
          >
            <Trash2 className={`h-4 w-4 mr-2 ${isDeleting ? 'animate-pulse' : ''}`} />
            Delete Selected
          </Button>
          <div className="text-xs text-gray-500 mt-2 text-center">
            {selectedFiles.length} of {availableFiles.length} logs selected
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <div key={file.path} className="relative flex items-center">
                  {editingFile === file.path ? (
                    <div className="flex-1 px-3 py-1">
                      <Input
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="text-sm h-7"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        className={`flex-1 text-left px-3 py-2 rounded-md transition-colors ${
                          selectedFiles.includes(file.path) 
                            ? 'bg-primary-50 text-primary-900' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => toggleFile(file.path)}
                      >
                        <div className="text-sm truncate">{getFileName(file.path)}</div>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-50 hover:opacity-100 mr-1"
                        onClick={(e) => handleEditFileName(file.path, e)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                {searchQuery ? "No matching log files found" : "No log files available"}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedFiles.length} selected log file(s)? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 