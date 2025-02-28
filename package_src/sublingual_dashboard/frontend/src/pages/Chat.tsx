import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMetrics } from "@/contexts/MetricsContext";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function Chat() {
    const navigate = useNavigate();
    const { stagedItems, viewMode, selectedCriteria } = useMetrics();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        // Add user message
        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // Add bot response
        setTimeout(() => {
            const botMessage: Message = { role: 'assistant', content: 'boink' };
            setMessages(prev => [...prev, botMessage]);
        }, 500);
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