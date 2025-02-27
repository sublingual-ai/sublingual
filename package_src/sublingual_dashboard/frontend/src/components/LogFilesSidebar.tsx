import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogFile } from "@/contexts/LogFileContext"
import { RefreshCcw, CheckSquare, Square, Folder } from "lucide-react"
import { API_BASE_URL } from "@/config"

export function LogFilesSidebar() {
  const { 
    selectedFiles, 
    availableFiles, 
    toggleFile, 
    selectAllFiles, 
    deselectAllFiles,
    logDirectoryError,
    refreshFiles
  } = useLogFile();

  const handleDirectorySelect = async () => {
    try {
      // Create an input element
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      
      input.onchange = async (e) => {
        const directory = (e.target as HTMLInputElement).files?.[0].path;
        if (!directory) return;

        const response = await fetch(`${API_BASE_URL}/set_project_dir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ project_dir: directory }),
        });

        if (!response.ok) {
          throw new Error('Failed to set project directory');
        }

        // Refresh the file list
        refreshFiles();
      };

      input.click();
    } catch (err) {
      console.error('Error selecting directory:', err);
    }
  };

  function getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  return (
    <div className="w-64 border-r bg-gray-50/40 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-4">
          <Input
            type="text"
            placeholder="Search logs..."
            className="h-9"
          />
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <RefreshCcw className="h-4 w-4" />
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
        {logDirectoryError ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="text-sm text-red-600">
              {logDirectoryError}
            </div>
            <Button 
              variant="outline" 
              onClick={handleDirectorySelect}
              className="w-full"
            >
              <Folder className="h-4 w-4 mr-2" />
              Select Project Directory
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {availableFiles.map(file => (
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
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
} 