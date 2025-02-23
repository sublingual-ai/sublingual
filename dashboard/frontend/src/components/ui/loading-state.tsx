import { Spinner } from "@/components/ui/spinner";

interface LoadingStateProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage?: string;
}

export const LoadingState = ({ 
  isLoading, 
  isEmpty, 
  emptyMessage = "No items found" 
}: LoadingStateProps) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary-500" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return null;
}; 