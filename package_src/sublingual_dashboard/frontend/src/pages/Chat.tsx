import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from '@/config';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LLMInteraction } from "@/components/LLMInteraction";
import ReactMarkdown from 'react-markdown';

interface Citation {
	type: 'block';
	id: string;
	index: number;
}

interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	id?: string;
	citations?: Citation[];
}

interface RunData {
	messages: Array<{ role: string, content: string }>;
	response_texts: string[];
	// add other fields as needed
}

interface StagedRun {
	id: string;
	messages: Array<{ role: string, content: string }>;
	response: { role: string, content: string };
	usage?: { total_tokens: number };
}

const getTotalTokens = (runs: StagedRun[]) => {
	return runs.reduce((total, run) => {
		// Use actual token count if available
		if (run.usage?.total_tokens) {
			return total + run.usage.total_tokens;
		}
		// Fallback to rough approximation only if necessary
		const allMessages = [...run.messages, run.response];
		return total + allMessages.reduce((msgTotal, msg) =>
			msgTotal + (msg?.content?.length || 0) / 4, 0);
	}, 0);
};

// Create a new MessageInput component
const MessageInput = ({ onSubmit }: { onSubmit: (message: string) => void }) => {
	const [inputValue, setInputValue] = useState('');

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputValue.trim()) return;
		onSubmit(inputValue);
		setInputValue('');
	};

	return (
		<form onSubmit={handleSubmit} className="flex gap-2">
			<Input
				value={inputValue}
				onChange={(e) => setInputValue(e.target.value)}
				placeholder="Type a message..."
				className="flex-1"
			/>
			<Button type="submit">
				<Send className="w-4 h-4" />
			</Button>
		</form>
	);
};

const getPreviewText = (run: StagedRun) => {
	// Helper function to clean and truncate text
	const truncateText = (text: string) => {
		// Remove newlines and extra spaces
		const cleanText = text.replace(/\s+/g, ' ').trim();
		if (cleanText.length <= 25) return cleanText;
		// Truncate at word boundary
		const truncated = cleanText.slice(0, 22).split(' ').slice(0, -1).join(' ');
		return truncated + '...';
	};

	// First try to get content from messages
	const messageWithContent = run.messages.find(msg => msg?.content);
	if (messageWithContent?.content) {
		return truncateText(messageWithContent.content);
	}

	// If no message content, check response
	if (run.response?.content) {
		return truncateText(run.response.content);
	}

	return 'No content';
};

export default function Chat() {
	const navigate = useNavigate();
	const location = useLocation();
	const routerState = location.state || {};
	const { stagedItems = { runs: [], sessions: new Set<string>() } } = routerState;

	// Add debug logging for staged items
	console.log('Router state:', routerState);
	console.log('Staged items:', stagedItems);
	console.log('Staged runs:', stagedItems.runs);

	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [expandedRuns, setExpandedRuns] = useState<string[]>([]);
	const [expandedCitations, setExpandedCitations] = useState<string[]>([]);

	const stagedRuns = Array.isArray(stagedItems.runs) ? stagedItems.runs : [];

	// Add debug logging for staged runs after processing
	console.log('Processed staged runs:', stagedRuns);

	const toggleRun = (runId: string) => {
		setExpandedRuns(prev =>
			prev.includes(runId)
				? prev.filter(id => id !== runId)
				: [...prev, runId]
		);
	};

	// Move handleSubmit logic here but keep input state in child component
	const handleSubmit = async (message: string) => {
		const userMessage: Message = { role: 'user', content: message };
		setMessages(prev => [...prev, userMessage]);
		setIsLoading(true);

        try {
            const runs = Array.isArray(stagedItems.runs) ? stagedItems.runs : [];
            
            // Convert each run into a single message containing the full conversation
            const stagedMessages = runs.map((run) => {
                const conversationText = [
                    ...run.messages.map(msg => `${msg.role}: ${msg.content}`),
                    `${run.response.role}: ${run.response.content}`
                ].join('\n');
                
                return {
                    role: 'user' as Message['role'],
                    content: `[ID: ${run.id}]\n${conversationText}`
                };
            }).filter(msg => msg && msg.content != null);
            
            // Update system prompt to include citation instructions
            const systemPrompt = {
                role: 'system' as const,
                content: `You are an assistant helping a user navigate the logs from their LLM app.
                You will be provided all of the logs as "user" messages in the history.
                You can reference previous conversations using block citations.
                Use <block>id</block> to cite a conversation.
                You must use this exact format. Only include the ID here--do not repeat the content of the cited item.
                Cite things helpfully and tastefully.
                Example: <block>run-123456789</block>.`,
			};

			const allMessages = [systemPrompt, ...stagedMessages, systemPrompt, ...messages, userMessage];

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

			let processedContent = data.message;
			const citations: Citation[] = [];

			// Process block citations for embedding
			console.log('Processing content:', processedContent);
			const blockMatches = processedContent.matchAll(/<block>(.*?)<\/block>/gs);
			for (const match of blockMatches) {
				const fullMatch = match[0];
				const content = match[1]?.trim();
				console.log('Block content found:', content);

				// Replace block tags with bold markdown instead of removing
				processedContent = processedContent.replace(fullMatch, `**${content}**`);

				// The content IS the ID
				const id = content.trim();
				console.log('Block citation ID:', id);
				citations.push({
					type: 'block',
					id,
					index: match.index || 0
				});
			}

			console.log('Citations array:', citations);
			console.log('Processed content before cleanup:', processedContent);

			// Clean up whitespace
			processedContent = processedContent
				.replace(/\s+/g, ' ')
				.trim();

			console.log('Final processed content:', processedContent);

			console.log('Available staged runs before message creation:', stagedItems.runs);

			const botMessage: Message = {
				role: 'assistant',
				content: processedContent,
				citations: citations.length > 0 ? citations : undefined
			};

			console.log('Bot message being set:', botMessage);
			setMessages(prev => [...prev, botMessage]);
		} catch (error) {
			console.error('Chat error:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const renderCitedContent = (citation: Citation, stagedRuns: StagedRun[], totalCitations: number) => {
		const run = stagedRuns.find(r => r.id === citation.id);
		if (!run) return null;

		const isExpanded = totalCitations === 1 || expandedCitations.includes(citation.id);
		const previewText = getPreviewText(run);

		return (
			<div className="mt-2">
				{totalCitations > 1 && (
					<button
						onClick={() => setExpandedCitations(prev =>
							isExpanded ? prev.filter(id => id !== citation.id) : [...prev, citation.id]
						)}
						className="flex flex-col gap-1 text-sm text-gray-500 hover:text-gray-700 w-full"
					>
						<div className="flex items-center gap-2">
							{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
							<span className="font-medium">Run {run.id}</span>
						</div>
						<div className="ml-6 text-xs text-gray-400 truncate">
							{getPreviewText(run)}
						</div>
					</button>
				)}
				{isExpanded && (
					<div className="mt-2 border rounded-md overflow-hidden">
						<LLMInteraction run={run} />
					</div>
				)}
			</div>
		);
	};

	const renderMessage = (message: Message, index: number, stagedRuns: StagedRun[]) => {
		console.log('Rendering message:', message);
		console.log('With citations:', message.citations);

		const totalCitations = message.citations?.length || 0;

		return (
			<div
				key={index}
				className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
			>
				<div
					className={`max-w-[80%] rounded-lg px-4 py-1.5 ${message.role === 'user'
							? 'bg-primary-500 text-white'
							: 'bg-gray-100 text-gray-900'
						}`}
				>
					<ReactMarkdown>{message.content}</ReactMarkdown>
					{message.citations?.map((citation, i) => (
						<div key={i}>
							{citation.type === 'block' && renderCitedContent(citation, stagedRuns, totalCitations)}
						</div>
					))}
					{message.id && (
						<div className="text-xs opacity-50 mt-1">
							ID: {message.id}
						</div>
					)}
				</div>
			</div>
		);
	};

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
								{stagedRuns.map((run, index) => {
									console.log('Staged run:', {
										id: run.id,
										messages: run.messages,
										response: run.response,
										fullRun: run
									});
									return [
										<tr
											key={`${run.id || index}-row`}
											className={`hover:bg-gray-50 cursor-pointer ${expandedRuns.includes(run.id) ? 'bg-gray-50' : ''
												}`}
											onClick={() => toggleRun(run.id)}
										>
											<td className="p-2">
												<div className="flex flex-col">
													<div className="flex items-center gap-2">
														{expandedRuns.includes(run.id) ? (
															<ChevronDown className="w-4 h-4" />
														) : (
															<ChevronRight className="w-4 h-4" />
														)}
														<span className="text-sm font-medium">Run {run.id}</span>
													</div>
													<div className="ml-6 text-xs text-gray-400 truncate">
														{getPreviewText(run)}
													</div>
												</div>
											</td>
										</tr>,
										expandedRuns.includes(run.id) && run.messages && Array.isArray(run.messages) && (
											<tr key={`${run.id || index}-content`}>
												<td className="p-2">
													<div className="border rounded-md overflow-hidden">
														<LLMInteraction run={run} />
													</div>
												</td>
											</tr>
										)
									];
								})}
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
							{messages.map((message, i) => renderMessage(message, i, stagedItems.runs))}
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
							<MessageInput onSubmit={handleSubmit} />
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
} 