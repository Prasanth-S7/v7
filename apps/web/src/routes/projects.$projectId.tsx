import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { env } from "@v7/env/web";
import { Message, MessageContent, MessageGroup } from "@v7/ui/components/message";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@v7/ui/components/resizable";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ProjectsSidebar from "@/components/projects-sidebar";
import { useSSE } from "@/hooks/useSSE";

export const Route = createFileRoute("/projects/$projectId")({
	component: ProjectComponent,
});

function ProjectComponent() {
	const { projectId } = Route.useParams();
	const initialPrompt = useRouterState({ select: (s) => s.location.state });
	const [messages, setMessages] = useState<{ id: string; text: string }[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const initialSent = useRef(false);
	const _sse = useSSE(env.VITE_SSE_URL, projectId);

	const sendMessage = useCallback(
		async (text: string) => {
			setSending(true);
			try {
				const res = await axios.post(
					`${env.VITE_SERVER_URL}/api/chat/${projectId}`,
					{ prompt: text },
					{ withCredentials: true },
				);
				if (!res.data.msg) {
					toast.error("Error while sending prompt. Please try again later!");
				}
			} catch (error) {
				console.log("Error sending message:", error);
				toast.error("Error sending message");
			} finally {
				setSending(false);
			}
		},
		[projectId],
	);

	useEffect(() => {
		if (initialPrompt && !initialSent.current) {
			initialSent.current = true;
			setMessages([{ id: crypto.randomUUID(), text: initialPrompt.prompt }]);
			sendMessage(initialPrompt.prompt);
		}
	}, [initialPrompt, sendMessage]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (!input.trim() || sending) return;
			const text = input;
			setInput("");
			setMessages((prev) => [...prev, { id: crypto.randomUUID(), text }]);
			sendMessage(text);
		}
	};

	return (
		<div className="flex h-screen bg-black">
			<ProjectsSidebar />
			<ResizablePanelGroup orientation="horizontal" className="h-full flex-1">
				<ResizablePanel defaultSize={40} minSize={30}>
					<div className="flex h-full flex-col">
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							<MessageGroup>
								{messages.map((msg) => (
									<Message key={msg.id} align="end">
										<MessageContent className="text-white text-sm">
											<div className="rounded-lg bg-neutral-800 px-3 py-2">{msg.text}</div>
										</MessageContent>
									</Message>
								))}
							</MessageGroup>
						</div>
						<div className="border-t border-neutral-800 p-4">
							<textarea
								placeholder="build something cool..."
								className="w-full bg-neutral-900 border-l-4 border-red-600 text-white placeholder-gray-500 px-4 py-3 outline-none resize-none"
								rows={3}
								value={input}
								onChange={(e) => setInput(e.currentTarget.value)}
								onKeyDown={handleKeyDown}
							/>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={60} minSize={30}>
					<div className="flex h-full items-center justify-center text-gray-500">Project {projectId}</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
