import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ArrowUp } from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { env } from "@v7/env/web";

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
  const { session } = Route.useRouteContext();
  const userName = session.data?.user.name || "User";

  const [prompt, setPrompt] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter"){
      e.preventDefault();
      try{
          axios.post(env.VITE_SERVER_URL + "/api/project/", {
          projectId: '123',
          prompt: prompt,
        });
      }
      catch (error) {
        console.log("Error sending prompt:", error);
      }
    }
  }

  return (
    <div className="flex h-screen bg-white">
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-300 to-purple-500" />
              </div>
              <h1 className="text-3xl font-medium text-gray-900 mb-2">
                Good Afternoon, {userName}
              </h1>
              <p className="text-3xl font-medium text-gray-900">
                What's on{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-purple-700">
                  your mind?
                </span>
              </p>
            </div>
            <div className="relative mb-8">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <textarea
                    placeholder="Ask AI"
                    className="w-full resize-none border-0 outline-none text-gray-700 placeholder-gray-400 min-h-[80px]"
                    rows={3}
                    onChange={(e) => setPrompt(e.target.value)}
                    value={prompt}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="flex items-center justify-between px-4 pb-4">
                  <div className="flex items-center space-x-3">
                    <button className="p-2 rounded-lg bg-black text-white hover:bg-gray-800">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}