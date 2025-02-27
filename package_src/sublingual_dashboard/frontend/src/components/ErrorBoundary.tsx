import React, { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from "@/hooks/use-toast";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error Boundary caught an error:', error, errorInfo);

        // Use the toast function directly
        toast({
            variant: "destructive",
            title: "Something went wrong",
            description: error.message,
        });
    }

    public render() {
        if (this.state.hasError) {
            // Return an empty div instead of the error UI
            // This prevents the component from re-rendering the error
            return <div className="error-caught" />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary; 