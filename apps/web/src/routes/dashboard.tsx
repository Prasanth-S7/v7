import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@v7/env/web";
import LogoutButton from "@/components/logout-button";
import { useSSE } from "@/hooks/useSSE";

const TITLE = `
██╗   ██╗██████╗
██║   ██║╚════██╗
██║   ██║   ██╔╝
╚██╗ ██╔╝  ██╔╝
 ╚████╔╝  ██╔╝
  ╚═══╝   ╚═╝
`;

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      try {
        const res = await axios.post(env.VITE_SERVER_URL + "/api/project/create");
        if (!res.data?.projectId) {
          console.log("reaches here")
          toast.error("Project creation failed");
          return;
        }
        navigate({ to: "/projects/$projectId", params: { projectId: res.data.projectId }, state: { prompt: prompt } });
      } catch (error) {
        console.log(error)
        toast.error("Project creation failed");
      }
    }
  };

  return (
    <div className="flex h-screen bg-black">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <pre className="text-white font-mono text-sm leading-tight mb-10">
          {TITLE}
        </pre>
        <div className="w-full max-w-xl">
          <textarea
            placeholder="build something cool..."
            className="w-full bg-neutral-900 border-l-4 border-red-600 text-white placeholder-gray-500 px-4 py-3 outline-none resize-none"
            rows={3}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            value={prompt}
            onKeyDown={handleKeyDown}
          />
        </div>
      </main>
    </div>
  );
}