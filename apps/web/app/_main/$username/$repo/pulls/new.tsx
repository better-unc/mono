import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRepoPageData, useCreatePullRequest } from "@/lib/hooks/use-repositories";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    GitPullRequest,
    ArrowLeft,
    Loader2,
    GitBranch,
    GitFork
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RepoHeader } from "@/components/repo-header";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_main/$username/$repo/pulls/new")({
    component: NewPullRequestPage,
});

function NewPullRequestPage() {
    const { username, repo: repoName } = Route.useParams();
    const navigate = useNavigate();
    const { data: repoData, isLoading: repoLoading } = useRepoPageData(username, repoName);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [base, setBase] = useState("");
    const [head, setHead] = useState("");
    const [targetType, setTargetType] = useState<"same" | "parent">("same");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (repoLoading || !repoData) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { repo, branches, isOwner, parentRepo } = repoData;
    const isFork = !!parentRepo;

    // Set default branches if not set using useEffect to avoid state updates in render
    useEffect(() => {
        if (isFork && targetType === "parent") {
            // For parent PRs, default to parent's default branch
            if (!base && parentRepo?.defaultBranch) setBase(parentRepo.defaultBranch);
            if (!head && branches.length > 0) setHead(branches[0]);
        } else {
            // For same-repo PRs
            if (!base && repo.defaultBranch) setBase(repo.defaultBranch);
            if (!head && branches.length > 1) {
                const otherBranch = branches.find(b => b !== repo.defaultBranch) || branches[0];
                setHead(otherBranch);
            }
        }
    }, [base, head, repo.defaultBranch, branches, isFork, targetType, parentRepo]);

    // Reset branches when target type changes
    useEffect(() => {
        setBase("");
        setHead("");
    }, [targetType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !base || !head) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (targetType === "parent" && parentRepo) {
                // Create PR on parent repo with head from this fork
                const pr = await api.repositories.createPullRequest(
                    parentRepo.owner.username,
                    parentRepo.name,
                    {
                        title,
                        description,
                        base,
                        head,
                        headOwner: username,
                        headRepo: repoName,
                    }
                );
                navigate({
                    to: "/$username/$repo/pulls/$number",
                    params: {
                        username: parentRepo.owner.username,
                        repo: parentRepo.name,
                        number: String(pr.number)
                    }
                });
            } else {
                // Create PR within the same repo
                const pr = await api.repositories.createPullRequest(
                    username,
                    repoName,
                    {
                        title,
                        description,
                        base,
                        head,
                    }
                );
                navigate({
                    to: "/$username/$repo/pulls/$number",
                    params: { username, repo: repoName, number: String(pr.number) }
                });
            }
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || "Failed to create pull request");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Determine which branches to show for base and head
    const baseBranches = targetType === "parent" && parentRepo ? parentRepo.branches : branches;
    const headBranches = branches;

    return (
        <div className="container max-w-6xl px-4 py-8">
            <RepoHeader repo={repo} username={username} activeTab="pulls" isOwner={isOwner} parentRepo={repoData.parentRepo} />

            <div className="mt-8 max-w-3xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <h2 className="text-2xl font-bold">Open a pull request</h2>
                </div>

                {/* Fork target selector */}
                {isFork && (
                    <div className="bg-accent/30 border border-border rounded-none p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GitFork className="h-4 w-4" />
                            <span>This is a fork of <strong>{parentRepo.owner.username}/{parentRepo.name}</strong></span>
                        </div>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="targetType"
                                    value="parent"
                                    checked={targetType === "parent"}
                                    onChange={() => setTargetType("parent")}
                                    className="accent-primary"
                                />
                                <span className="text-sm">Contribute to upstream ({parentRepo.owner.username}/{parentRepo.name})</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="targetType"
                                    value="same"
                                    checked={targetType === "same"}
                                    onChange={() => setTargetType("same")}
                                    className="accent-primary"
                                />
                                <span className="text-sm">Open PR within this fork</span>
                            </label>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-secondary/20 border border-border rounded-none p-6 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 space-y-2 w-full">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Base
                            {targetType === "parent" && parentRepo && (
                                <span className="text-xs text-muted-foreground">({parentRepo.owner.username}/{parentRepo.name})</span>
                            )}
                        </label>
                        <Select value={base} onValueChange={(val) => setBase(val as string)}>
                            <SelectTrigger>
                                <SelectValue>
                                    {base || "Select base"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {baseBranches.map(b => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="text-muted-foreground">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Compare
                            {targetType === "parent" && (
                                <span className="text-xs text-muted-foreground">({username}/{repoName})</span>
                            )}
                        </label>
                        <Select value={head} onValueChange={(val) => setHead(val as string)}>
                            <SelectTrigger>
                                <SelectValue>
                                    {head || "Select compare"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {headBranches.map(b => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-none p-6 shadow-sm">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input
                            placeholder="Title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description (optional)</label>
                        <Textarea
                            placeholder="Leave a comment"
                            rows={6}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSubmitting || !title || base === head}>
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Create pull request
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
