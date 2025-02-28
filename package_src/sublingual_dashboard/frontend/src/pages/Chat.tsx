import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from '@/config';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
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

export default function Chat() {
    const navigate = useNavigate();
    const location = useLocation();
    const routerState = location.state || {};
    
    const { stagedItems = { runs: [], sessions: new Set<string>() } } = routerState;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Ensure stagedItems.runs is an array before using flatMap
            const runs = Array.isArray(stagedItems.runs) ? stagedItems.runs : [];
            
            // Convert each run into a single message containing the full conversation
            const stagedMessages = runs.map(run => {
                // Convert the run's messages into a conversation string
                const conversation = [
                    ...run.messages,
                    run.response
                ]
                .filter(msg => msg && msg.content != null)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
                
                return {
                    role: 'user' as const,
                    content: conversation
                };
            });
            
            // Construct prefix messages
            const prefixMessages: Message[] = [
                { role: 'system', content: '' },
                ...stagedMessages
            ];

            const allMessages = [...prefixMessages, ...messages, userMessage];

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
            const botMessage: Message = { 
                role: 'assistant', 
                content: data.message 
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="h-full flex flex-col">
                {/* Back button */}
                <div className="flex-none p-4 border-b">
                    <div className="max-w-4xl mx-auto">
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
                </div>

                {/* Messages Area - wrap in centered container */}
                <div className="flex-1 overflow-auto p-4">
                    <div className="max-w-4xl mx-auto space-y-2">
                        {messages.map((message, i) => (
                            <div
                                key={i}
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
                                </div>
                            </div>
                        ))}
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

                {/* Input Area - wrap in centered container */}
                <div className="border-t p-4">
                    <div className="max-w-4xl mx-auto">
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
        </DashboardLayout>
    );
} 