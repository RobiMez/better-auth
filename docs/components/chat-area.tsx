"use client";

import { MessageSquare, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { motion } from "framer-motion";
import { Logo } from "./logo";

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

interface ChatAreaProps {
	messages: Message[];
	chatHistory?: ChatHistory[];
	onLoadChat?: (chat: ChatHistory) => void;
	onStartNewChat?: () => void;
}

// Function to extract citation numbers from text
function extractCitationNumbers(text: string): number[] {
	const citationMatches = text.match(/\[\[(\d+)\]\]/g);
	if (!citationMatches) return [];
	
	return citationMatches
		.map(match => {
			const numberMatch = match.match(/\[\[(\d+)\]/);
			return numberMatch ? parseInt(numberMatch[1]) : null;
		})
		.filter((num): num is number => num !== null)
		.sort((a, b) => a - b);
}

// Enhanced text formatter that handles dashed delimiter code blocks with TypeScript syntax highlighting
function formatAIText(text: string) {
	// First, replace all citations with proper HTML links
	const textWithCitations = text.replace(
		/\[\[(\d+)\]\]\(([^)]+)\)/g,
		(match, number, url) => {
			return `<a href="${url}" class="text-muted-foreground hover:text-primary text-xs inline" target="_blank" rel="noopener noreferrer">[${number}]</a>`;
		}
	);
	
	// Detect and handle code blocks with dashed delimiters 
    // ( clarm doesnt seem to have proper markdown code blocks )
	const codeBlockRegex = /-{10,}\n([\s\S]*?)\n-{10,}/g;
	const parts: (string | { type: "code"; content: string })[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;

	while ((match = codeBlockRegex.exec(textWithCitations)) !== null) {
		// Add text before the code block
		if (match.index > lastIndex) {
			parts.push(textWithCitations.slice(lastIndex, match.index));
		}

		// Add the code block
		parts.push({
			type: "code",
			content: match[1].trim(),
		});

		lastIndex = match.index + match[0].length;
	}

	// Add remaining text after the last code block
	if (lastIndex < textWithCitations.length) {
		parts.push(textWithCitations.slice(lastIndex));
	}

	// Process each part
	const result: JSX.Element[] = [];
	let keyIndex = 0;

	parts.forEach((part) => {
		if (typeof part === "string") {
			// Process regular text
			const lines = part.split("\n");
			lines.forEach((line, lineIndex) => {
				const trimmed = line.trim();

				// Handle bullet points
				if (trimmed.startsWith("•")) {
					result.push(
						<div
							key={`${keyIndex}-${lineIndex}`}
							className="flex items-start gap-2 mb-1"
						>
							<span className="text-muted-foreground mt-1">•</span>
							<span className="text-sm" dangerouslySetInnerHTML={{ __html: trimmed.slice(1).trim() }} />
						</div>,
					);
					return;
				}

				// Handle numbered lists
				if (/^\d+\./.test(trimmed)) {
					const numberMatch = trimmed.match(/^\d+\./);
					const number = numberMatch ? numberMatch[0] : "";
					const content = trimmed.replace(/^\d+\.\s*/, "");
					
					result.push(
						<div
							key={`${keyIndex}-${lineIndex}`}
							className="flex items-start gap-2 mb-1"
						>
							<span className="text-muted-foreground mt-1 text-xs">
								{number}
							</span>
							<span className="text-sm" dangerouslySetInnerHTML={{ __html: content }} />
						</div>,
					);
					return;
				}

				// Handle inline code (single backticks)
				if (
					trimmed.includes("`") &&
					trimmed.startsWith("`") &&
					trimmed.endsWith("`")
				) {
					result.push(
						<code
							key={`${keyIndex}-${lineIndex}`}
							className="bg-muted px-2 py-1 rounded text-xs font-mono inline-block mb-2"
						>
							{trimmed.slice(1, -1)}
						</code>,
					);
					return;
				}

				// Handle regular links [text](url)
				if (
					trimmed.includes("[") &&
					trimmed.includes("](") &&
					trimmed.includes(")")
				) {
					const linkMatch = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/);
					if (linkMatch) {
						result.push(
							<a
								key={`${keyIndex}-${lineIndex}`}
								href={linkMatch[2]}
								className="text-primary underline hover:text-primary/80 text-sm block mb-2"
								target="_blank"
								rel="noopener noreferrer"
							>
								{linkMatch[1]}
							</a>,
						);
						return;
					}
				}

				// Handle empty lines
				if (trimmed === "") {
					result.push(<div key={`${keyIndex}-${lineIndex}`} className="h-2" />);
					return;
				}

				// Regular text (citations already processed)
				result.push(
					<p
						key={`${keyIndex}-${lineIndex}`}
						className="text-sm mb-2 last:mb-0"
						dangerouslySetInnerHTML={{ __html: line }}
					/>,
				);
			});
		} else {
			// Render code block with TypeScript syntax highlighting
			result.push(
				<div key={`code-${keyIndex}`} className="my-4">
					<CodeBlock lang="ts">
						<Pre>
							<code>{part.content}</code>
						</Pre>
					</CodeBlock>
				</div>,
			);
		}
		keyIndex++;
	});

	return result;
}

export function ChatArea({ messages, chatHistory = [], onLoadChat, }: ChatAreaProps) {
	if (messages.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
				<div className="text-center mb-6">
					<Logo className="size-12 mx-auto mb-4 opacity-50" />
					<p className="text-sm">Chat with the Better Auth library </p>
					<p className="text-xs mt-2 opacity-70">
						Start a conversation to get help with Better Auth. 
					</p>
				</div>
				
				{chatHistory.length > 0 && (
					<div className="w-full max-w-md">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-medium text-muted-foreground">Or continue a conversation</h3>
						</div>
						<div className="space-y-2 max-h-48 overflow-y-auto">
							{chatHistory.slice(0, 5).map((chat) => (
								<button
									key={chat.id}
									onClick={() => onLoadChat?.(chat)}
									className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
								>
									<div className="text-sm text-foreground truncate group-hover:text-primary capitalize">
										{chat.title}
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										{chat.lastUpdated.toLocaleDateString()} • {chat.messages.length} messages
									</div>
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 h-full !pb-12">
			{messages.map((message) => (
				<div
					key={message.id}
					className={cn(
						"flex gap-3",
						message.sender === "user" ? "justify-end" : "justify-start",
					)}
				>
					{message.sender === "ai" && (
						<div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
							<Bot className="size-4 text-primary" />
						</div>
					)}

					<div
						className={cn(
							"max-w-[80%] px-4 py-2 rounded-lg",
							message.sender === "user"
								? "bg-primary text-primary-foreground"
								: "bg-muted text-foreground",
						)}
					>
						{message.sender === "ai" ? (
							<div className="text-sm">
								{message.content === "Thinking..." ? (
									<div className="flex items-center gap-2">
										<div className="flex space-x-1">
											<div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
											<div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
											<div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
										</div>
										<span className="text-muted-foreground">Thinking...</span>
									</div>
								) : (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.3, ease: "easeOut" }}
									>
										{formatAIText(message.content)}
									</motion.div>
								)}
							</div>
						) : (
							<p className="text-sm whitespace-pre-wrap">{message.content}</p>
						)}
						<p className="text-xs opacity-70 mt-1">
							{message.timestamp.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</p>
						
						{/* Citation Pills - Separate from message content */}
						{message.sender === "ai" && message.citations && message.citations.length > 0 && (() => {
							const citationNumbers = extractCitationNumbers(message.content);
							const filteredCitations = message.citations.filter((_, index) => 
								citationNumbers.includes(index + 1)
							);
							
							return filteredCitations.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-1">
									{filteredCitations.map((citation, index) => {
										const citationNumber = citationNumbers[index];
										return (
											<a
												key={citation.document_id}
												href={citation.link}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center px-2 py-1 bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground rounded-md transition-colors"
												title={citation.semantic_identifier}
											>
												<span className="text-xs opacity-70 mr-1">[{citationNumber}]</span>
												{citation.semantic_identifier}
											</a>
										);
									})}
								</div>
							) : null;
						})()}
					</div>
				</div>
			))}
		</div>
	);
}
