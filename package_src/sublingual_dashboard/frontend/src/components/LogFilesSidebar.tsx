import * as React from "react"
import { RefreshCcw, CheckSquare, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogFile } from "@/contexts/LogFileContext"

export function LogFilesSidebar() {
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

  return (
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
        <div className="flex gap-2">
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
        <div className="text-xs text-gray-500 mt-2 text-center">
          {selectedFiles.length} of {availableFiles.length} logs selected
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredFiles.length > 0 ? (
            filteredFiles.map(file => (
              <button
                key={file.path}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedFiles.includes(file.path) 
                    ? 'bg-primary-50 text-primary-900' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => toggleFile(file.path)}
              >
                <div className="text-sm truncate">{getFileName(file.path)}</div>
              </button>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              {searchQuery ? "No matching log files found" : "No log files available"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 