import { Link, useNavigate } from "@tanstack/react-router";
import { env } from "@v7/env/web";
import { Button } from "@v7/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@v7/ui/components/dialog";
import { Input } from "@v7/ui/components/input";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ProjectSummary = {
	id: string;
	name: string | null;
	projectStatus: "IDLE" | "GENERATING" | "ERROR" | "COMPLETED";
	createdAt: string;
};

export default function ProjectsSidebar() {
	const navigate = useNavigate();
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [showDialog, setShowDialog] = useState(false);
	const [projectName, setProjectName] = useState("");
	const [creating, setCreating] = useState(false);

	const fetchProjects = useCallback(async () => {
		try {
			const res = await axios.get<{ projects: ProjectSummary[] }>(`${env.VITE_SERVER_URL}/api/project`, {
				withCredentials: true,
			});
			setProjects(res.data.projects);
			setError(false);
		} catch (err) {
			console.log("Failed to load projects:", err);
			setError(true);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		fetchProjects().finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [fetchProjects]);

	const handleCreateProject = async () => {
		if (!projectName.trim()) {
			toast.error("Please enter a project name");
			return;
		}

		setCreating(true);
		try {
			const res = await axios.post(
				`${env.VITE_SERVER_URL}/api/project/create`,
				{ name: projectName },
				{ withCredentials: true },
			);
			if (!res.data?.projectId) {
				toast.error("Project creation failed");
				return;
			}
			toast.success("Project created");
			setShowDialog(false);
			setProjectName("");
			await fetchProjects();
			navigate({ to: "/projects/$projectId", params: { projectId: res.data.projectId } });
		} catch (error) {
			console.error("Failed to create project:", error);
			toast.error("Failed to create project");
		} finally {
			setCreating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleCreateProject();
		}
	};

	return (
		<aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
			<div className="flex items-center justify-between px-4 py-3">
				<div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Projects</div>
				<Button
					size="sm"
					className="h-6 px-2 text-xs bg-red-600 text-white hover:bg-red-700"
					onClick={() => setShowDialog(true)}
				>
					+
				</Button>
			</div>

			<Dialog open={showDialog} onOpenChange={setShowDialog}>
				<DialogContent className="bg-neutral-900 border-neutral-800">
					<DialogHeader>
						<DialogTitle className="text-white">Create New Project</DialogTitle>
						<DialogDescription className="text-gray-400">Enter a name for your new project</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Input
							placeholder="Project name"
							value={projectName}
							onChange={(e) => setProjectName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="bg-neutral-800 border-neutral-700 text-white placeholder-gray-500"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDialog(false)}
							className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateProject}
							disabled={creating}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							{creating ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<nav className="flex-1 overflow-y-auto px-2 pb-4">
				{loading && <p className="px-2 py-1 text-sm text-gray-500">Loading...</p>}
				{error && <p className="px-2 py-1 text-sm text-red-500">Could not load projects</p>}
				{!loading && !error && projects.length === 0 && (
					<p className="px-2 py-1 text-sm text-gray-500">No projects yet</p>
				)}
				<ul className="space-y-1">
					{projects.map((project) => (
						<li key={project.id}>
							<Link
								to="/projects/$projectId"
								params={{ projectId: project.id }}
								className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-gray-300 hover:bg-neutral-800"
								activeProps={{ className: "bg-neutral-800 text-white" }}
							>
								<span className="truncate">{project.name ?? "Untitled project"}</span>
								<span className="shrink-0 text-xs text-gray-500">{project.projectStatus.toLowerCase()}</span>
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</aside>
	);
}
