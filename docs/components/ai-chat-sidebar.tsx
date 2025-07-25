"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Plus } from "lucide-react";
import { ChatArea } from "./chat-area";
import { ENV } from "@/lib/constants";

interface Citation {
	document_id: string;
	chunk_ind: number;
	semantic_identifier: string;
	link: string;
	blurb: string;
	source_type: string;
	boost: number;
	hidden: boolean;
	metadata: Record<string, any>;
	score: number;
	is_relevant: boolean | null;
	relevance_explanation: string | null;
	match_highlights: string[];
	updated_at: string | null;
	primary_owners: string[] | null;
	secondary_owners: string[] | null;
	is_internet: boolean;
}

interface Message {
	id: string;
	content: string;
	sender: "user" | "ai";
	timestamp: Date;
	citations?: Citation[];
}

interface ChatHistory {
	id: string;
	title: string;
	messages: Message[];
	lastUpdated: Date;
}

interface AIChatSidebarProps {
	isOpen: boolean;
	onToggle: () => void;
}

export function AIChatSidebar({ isOpen, onToggle }: AIChatSidebarProps) {
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [width, setWidth] = useState(500);
	const [isResizing, setIsResizing] = useState(false);
	const [chatSessionId, setChatSessionId] = useState<string | null>(null);
	const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const sidebarRef = useRef<HTMLDivElement>(null);
	const chatAreaRef = useRef<HTMLDivElement>(null);

	// Load chat session ID and chat history from localStorage on mount
	useEffect(() => {
		const savedSessionId = localStorage.getItem("ai-chat-session-id");
		if (savedSessionId) {
			setChatSessionId(savedSessionId);
		}

		const savedHistory = localStorage.getItem("ai-chat-history");
		if (savedHistory) {
			try {
				const history = JSON.parse(savedHistory).map((chat: any) => ({
					...chat,
					lastUpdated: new Date(chat.lastUpdated),
					messages: chat.messages.map((msg: any) => ({
						...msg,
						timestamp: new Date(msg.timestamp),
					})),
				}));
				setChatHistory(history);
			} catch (error) {
				console.error("Failed to load chat history:", error);
			}
		}
	}, []);

	// Save chat history to localStorage whenever it changes
	useEffect(() => {
		if (chatHistory.length > 0) {
			localStorage.setItem("ai-chat-history", JSON.stringify(chatHistory));
		}
	}, [chatHistory]);

	// Save current conversation when messages change
	useEffect(() => {
		if (messages.length > 0 && currentChatId) {
			const firstUserMessage = messages.find((msg) => msg.sender === "user");
			const title = firstUserMessage
				? firstUserMessage.content.slice(0, 50) +
					(firstUserMessage.content.length > 50 ? "..." : "")
				: "New Chat";

			setChatHistory((prev) => {
				const existingIndex = prev.findIndex(
					(chat) => chat.id === currentChatId,
				);
				const updatedChat: ChatHistory = {
					id: currentChatId,
					title,
					messages,
					lastUpdated: new Date(),
				};

				if (existingIndex !== -1) {
					const newHistory = [...prev];
					newHistory[existingIndex] = updatedChat;
					return newHistory;
				} else {
					return [updatedChat, ...prev];
				}
			});
		}
	}, [messages, currentChatId]);

	// Save chat session ID to localStorage whenever it changes
	useEffect(() => {
		if (chatSessionId) {
			localStorage.setItem("ai-chat-session-id", chatSessionId);
		}
	}, [chatSessionId]);

	// Function to load a previous chat
	const loadChat = useCallback((chat: ChatHistory) => {
		setMessages(chat.messages);
		setCurrentChatId(chat.id);
		setChatSessionId(chat.id); // Use chat ID as session ID for continuity
	}, []);

	// Function to start a new chat
	const startNewChat = useCallback(() => {
		setMessages([]);
		setCurrentChatId(null);
		setChatSessionId(null);
		localStorage.removeItem("ai-chat-session-id");
	}, []);

	// Function to get the maximum allowed width
	const getMaxWidth = useCallback(() => {
		return Math.min(800, window.innerWidth * 0.8);
	}, []);

	// Function to constrain width to valid bounds
	const constrainWidth = useCallback(
		(newWidth: number) => {
			const maxWidth = getMaxWidth();
			return Math.max(400, Math.min(maxWidth, newWidth));
		},
		[getMaxWidth],
	);

	// Function to scroll to bottom smoothly
	const scrollToBottom = useCallback(() => {
		if (chatAreaRef.current) {
			chatAreaRef.current.scrollTo({
				top: chatAreaRef.current.scrollHeight,
				behavior: "smooth",
			});
		}
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	// Prevent scroll events from bubbling up to parent
	useEffect(() => {
		const chatArea = chatAreaRef.current;
		if (!chatArea) return;

		const handleWheel = (e: WheelEvent) => {
			const { scrollTop, scrollHeight, clientHeight } = chatArea;
			const isAtTop = scrollTop === 0;
			const isAtBottom = scrollTop + clientHeight >= scrollHeight;

			// Prevent scroll if at boundaries and trying to scroll further
			if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
				e.preventDefault();
				e.stopPropagation();
			}
		};

		chatArea.addEventListener("wheel", handleWheel, { passive: false });
		return () => chatArea.removeEventListener("wheel", handleWheel);
	}, []);

	// Handle viewport resize
	useEffect(() => {
		const handleResize = () => {
			setWidth((prevWidth) => constrainWidth(prevWidth));
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [constrainWidth]);

	const handleSend = async () => {
		if (message.trim() && !isLoading) {
			// Create new chat ID if this is the first message
			if (!currentChatId) {
				const newChatId = crypto.randomUUID();
				setCurrentChatId(newChatId);
			}

			const userMessage: Message = {
				id: Date.now().toString(),
				content: message.trim(),
				sender: "user",
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, userMessage]);
			const currentMessage = message.trim();
			setMessage("");
			setIsLoading(true);

			// Add loading message
			const loadingMessage: Message = {
				id: (Date.now() + 1).toString(),
				content: "Thinking...",
				sender: "ai",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, loadingMessage]);

			try {
				// Check if API token is configured
				if (!ENV.NEXT_PUBLIC_AI_CHAT_API_TOKEN) {
					throw new Error("AI Chat API token is not configured. Please check your environment variables.");
				}

				// Prepare request body with chat session ID if available
				const requestBody: any = {
					query: currentMessage,
					agent_id: 60,
				};

				if (chatSessionId) {
					requestBody.chat_session_id = chatSessionId;
				}

				const response = await fetch("https://api.clarm.com/v1/search", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ENV.NEXT_PUBLIC_AI_CHAT_API_TOKEN}`,
					},
					body: JSON.stringify(requestBody),
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();

				// Extract and save chat session ID if this is the first message
				if (!chatSessionId && data.chat_session_id) {
					setChatSessionId(data.chat_session_id);
				}

				// Filter citations to only include those referenced in the response
				const referencedCitations = (() => {
					if (!data.citations || !data.answer) return [];

					// Extract citation numbers from the response text
					const citationMatches = data.answer.match(/\[\[(\d+)\]\]/g);
					if (!citationMatches) return [];

					const referencedNumbers = citationMatches
						.map((match: string) => {
							const numberMatch = match.match(/\[\[(\d+)\]/);
							return numberMatch ? parseInt(numberMatch[1]) - 1 : null; // Convert to 0-based index
						})
						.filter((num: number | null) => num !== null);

					// Return only citations that are actually referenced
					return data.citations.filter((_: any, index: number) =>
						referencedNumbers.includes(index),
					);
				})();

				// Replace loading message with real response
				setMessages((prev) => {
					const newMessages = [...prev];
					const loadingIndex = newMessages.findIndex(
						(msg) => msg.content === "Thinking...",
					);
					if (loadingIndex !== -1) {
						newMessages[loadingIndex] = {
							id: newMessages[loadingIndex].id,
							content: data.answer,
							sender: "ai",
							timestamp: new Date(),
							citations: referencedCitations,
						};
					}
					return newMessages;
				});
			} catch (error) {
				console.error("Error sending message:", error);

				// Replace loading message with error
				setMessages((prev) => {
					const newMessages = [...prev];
					const loadingIndex = newMessages.findIndex(
						(msg) => msg.content === "Thinking...",
					);
					if (loadingIndex !== -1) {
						newMessages[loadingIndex] = {
							id: newMessages[loadingIndex].id,
							content:
								"Sorry, I encountered an error while processing your request. Please try again.",
							sender: "ai",
							timestamp: new Date(),
						};
					}
					return newMessages;
				});
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && e.shiftKey) {
			// Adds a new line , just pass through
		} else if (e.key === "Enter") {
			// Regular Enter sends the message
			e.preventDefault();
			handleSend();
		}
	};

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsResizing(true);

			const startX = e.clientX;
			const startWidth = width;

			const handleMouseMove = (e: MouseEvent) => {
				const deltaX = startX - e.clientX;
				const newWidth = constrainWidth(startWidth + deltaX);
				setWidth(newWidth);
			};

			const handleMouseUp = () => {
				setIsResizing(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[width, constrainWidth],
	);

	return (
		<>
			{/* Sidebar Overlay */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/10 z-[9999999999999] backdrop-blur-sm"
						onClick={onToggle}
					/>
				)}
			</AnimatePresence>

			{/* Sidebar Sheet */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						ref={sidebarRef}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", damping: 25, stiffness: 200 }}
						className="fixed right-0 top-0 h-full bg-background border-l border-border shadow-xl !z-[9999999999999] isolate flex flex-col"
						style={{ width: `${width}px` }}
					>
						{/* Resize Handle */}
						<div
							className="absolute left-0 top-0 bottom-0 w-1 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group"
							onMouseDown={handleMouseDown}
						>
							<div className="w-1 h-8 bg-muted-foreground/30 rounded-full group-hover:bg-primary/50 transition-colors" />
						</div>

						{/* Header */}
						<div className="flex items-center justify-between p-4 border-b border-border">
							<div className="flex items-center gap-2">
								<button
									onClick={startNewChat}
									className="p-2 hover:bg-muted rounded-md transition-colors"
									title="Start new chat"
								>
									<Plus className="size-4" />
								</button>
								<h2 className="text-lg font-semibold">Chat with Better Auth</h2>
							</div>
							<button
								onClick={onToggle}
								className="p-2 hover:bg-muted rounded-md transition-colors"
							>
								<X className="size-4" />
							</button>
						</div>

						{/* Content Area */}
						<div className="flex-1 p-4 overflow-y-auto mb-12" ref={chatAreaRef}>
							<ChatArea
								messages={messages}
								chatHistory={chatHistory}
								onLoadChat={loadChat}
							/>
						</div>

						{/* Chat Input */}
						<div className="border-t border-border p-4">
							<div className="flex gap-2 items-end">
								<textarea
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder={
										isLoading
											? "AI is thinking..."
											: "Type your message... (Ctrl+Enter for new line)"
									}
									disabled={isLoading}
									rows={1}
									className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none min-h-[40px] max-h-32 overflow-y-auto"
									style={{
										height: "auto",
										minHeight: "40px",
									}}
									onInput={(e) => {
										const target = e.target as HTMLTextAreaElement;
										target.style.height = "auto";
										target.style.height =
											Math.min(target.scrollHeight, 128) + "px";
									}}
								/>
								<button
									onClick={handleSend}
									disabled={!message.trim() || isLoading}
									className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
								>
									{isLoading ? (
										<div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
									) : (
										<Send className="size-4" />
									)}
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
