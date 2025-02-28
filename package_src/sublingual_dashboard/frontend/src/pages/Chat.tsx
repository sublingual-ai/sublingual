import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from '@/config';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
}

interface RunData {
    messages: Array<{role: string, content: string}>;
    response_texts: string[];
    // add other fields as needed
}

interface StagedRun {
    id: string;
    messages: Array<{role: string, content: string}>;
    response: {role: string, content: string};
}

const getPreviewText = (run: StagedRun) => {
    const lastMessage = [...run.messages, run.response].filter(msg => msg?.content).pop();
    if (!lastMessage) return 'Empty conversation';
    return lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
};

const getTotalTokens = (runs: StagedRun[]) => {
    return runs.reduce((total, run) => {
        // Count tokens in all messages and response
        const allMessages = [...run.messages, run.response];
        return total + allMessages.reduce((msgTotal, msg) => 
            msgTotal + (msg?.content?.length || 0) / 4, 0); // Rough approximation of tokens
    }, 0);
};

export default function Chat() {
    const navigate = useNavigate();
    const location = useLocation();
    const routerState = location.state || {};
    const { stagedItems = { runs: [], sessions: new Set<string>() } } = routerState;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedRuns, setExpandedRuns] = useState<string[]>([]);

    const stagedRuns = Array.isArray(stagedItems.runs) ? stagedItems.runs : [];

    const toggleRun = (runId: string) => {
        setExpandedRuns(prev =>
            prev.includes(runId)
                ? prev.filter(id => id !== runId)
                : [...prev, runId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const runs = Array.isArray(stagedItems.runs) ? stagedItems.runs : [];
            
            // Update the staged messages mapping to use slugs
            const stagedMessages = runs.map((run) => {
                const conversation = [
                    ...run.messages,
                    run.response
                ]
                .filter(msg => msg && msg.content != null)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
                
                return {
                    role: 'user' as const,
                    content: conversation,
                    id: run.id // Just use the existing ID
                };
            });
            
            // Update system prompt to include citation instructions
            const systemPrompt = {
                role: 'system' as const,
                content: `You are an assistant helping a user navigate the logs from their LLM app. You will be provided all of the logs as "user" messages in the history. You can reference previous conversations using citations. Use <inline>[id]</inline> for inline citations or <block>[id]</block> for block citations. You must use this exact format. Only include the ID here--do not repeat the content of the cited item. Example: <block>b872e181-7241-49d7-b0d7-cff9314954d2</block>.`
            };

            const allMessages = [systemPrompt, ...stagedMessages, systemPrompt, ...messages, userMessage];  // sysprompt twice xd

            const response = await fetch(`${API_BASE_URL}/chatwith`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: allMessages
                })
            });

            if (!response.ok) throw new Error('Failed to get response');
            
            const data = await response.json();
            
            // Process citations in the response
            let processedContent = data.message;
            
            // Extract all inline tag contents
            const inlineMatches = processedContent.matchAll(/<inline>(.*?)<\/inline>/gs);
            for (const match of inlineMatches) {
                const fullMatch = match[0];
                const content = match[1]?.trim();
                console.log('Inline content found:', content);
                
                // Check if it's a valid citation format
                const citationMatch = content.match(/\s*\[(.*?)\]\s*/);
                if (citationMatch) {
                    const id = citationMatch[1]?.trim();
                    console.log('Valid inline citation ID:', id);
                }
                
                processedContent = processedContent.replace(fullMatch, '');
            }

            // Extract all block tag contents
            const blockMatches = processedContent.matchAll(/<block>(.*?)<\/block>/gs);
            for (const match of blockMatches) {
                const fullMatch = match[0];
                const content = match[1]?.trim();
                console.log('Block content found:', content);
                
                // Check if it's a valid citation format
                const citationMatch = content.match(/\s*\[(.*?)\]\s*/);
                if (citationMatch) {
                    const id = citationMatch[1]?.trim();
                    console.log('Valid block citation ID:', id);
                }
                
                processedContent = processedContent.replace(fullMatch, '');
            }

            // Clean up any remaining whitespace artifacts
            processedContent = processedContent
                .replace(/\s+/g, ' ')  // Collapse multiple spaces
                .replace(/\s+\./g, '.') // Clean up spaces before periods
                .replace(/\s+,/g, ',') // Clean up spaces before commas
                .trim();

            const botMessage: Message = { 
                role: 'assistant', 
                content: processedContent
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Update the message rendering to include IDs
    const renderMessage = (message: Message, index: number) => (
        <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[80%] rounded-lg px-4 py-1.5 ${
                    message.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                }`}
            >
                {message.content}
                {message.id && (
                    <div className="text-xs opacity-50 mt-1">
                        ID: {message.id}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <DashboardLayout showLogsSidebar={false}>
            <div className="h-screen flex">
                {/* Staged Messages Sidebar */}
                <div className="w-64 border-r bg-gray-50 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">Staged Messages</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                                {stagedRuns.length} messages staged
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">
                                {Math.round(getTotalTokens(stagedRuns)).toLocaleString()} tokens
                            </span>
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <table className="w-full">
                            <tbody className="divide-y divide-gray-100">
                                {stagedRuns.map((run, index) => [
                                    <tr
                                        key={`${run.id || index}-row`}
                                        className={`group hover:bg-gray-50 cursor-pointer ${
                                            expandedRuns.includes(run.id) ? 'bg-gray-50' : ''
                                        }`}
                                        onClick={() => toggleRun(run.id)}
                                    >
                                        <td className="px-4 py-2">
                                            <div className="flex items-center space-x-2">
                                                {expandedRuns.includes(run.id) ? (
                                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                                )}
                                                <MessageSquare className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {getPreviewText(run)}
                                                </span>
                                            </div>
                                            <div className="ml-10 mt-1">
                                                <Badge variant="secondary" className="text-xs">
                                                    {run.messages.length} messages
                                                </Badge>
                                            </div>
                                        </td>
                                    </tr>,
                                    expandedRuns.includes(run.id) && (
                                        <tr key={`${run.id || index}-details`}>
                                            <td className="px-4 py-2 bg-gray-50">
                                                <div className="ml-10 text-sm text-gray-600">
                                                    {run.messages.map((msg, msgIndex) => (
                                                        <div key={msgIndex} className="mb-2">
                                                            <div className="font-medium text-xs text-gray-500 mb-1">
                                                                {msg.role}:
                                                            </div>
                                                            <div className="pl-2 text-xs">
                                                                {msg.content}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {run.response && (
                                                        <div className="mb-2">
                                                            <div className="font-medium text-xs text-gray-500 mb-1">
                                                                response:
                                                            </div>
                                                            <div className="pl-2 text-xs">
                                                                {run.response.content}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                ])}
                                {stagedRuns.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-8 text-center text-gray-500 text-sm">
                                            No messages staged
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </ScrollArea>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {/* Back button - outside container */}
                    <div className="flex-none p-4 border-b">
                        <Button
                            variant="link"
                            size="sm"
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="w-3 h-3" />
                            <span className="text-sm">Back</span>
                        </Button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-auto p-4">
                        <div className="max-w-4xl mx-auto w-full space-y-2">
                            {messages.map((message, i) => renderMessage(message, i))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="max-w-[80%] rounded-lg px-4 py-1.5 bg-gray-100">
                                        <div className="flex space-x-2">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="border-t p-4">
                        <div className="max-w-4xl mx-auto w-full">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1"
                                />
                                <Button type="submit">
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 