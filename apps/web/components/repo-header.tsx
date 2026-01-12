import { Star, GitFork, Eye, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarButton } from "@/components/star-button";
import { RepoTabs } from "@/components/repo-tabs";
import { api, type ParentRepo } from "@/lib/api/client";
import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";

interface RepoHeaderProps {
    repo: {
        id: string;
        name: string;
        visibility: string;
        description?: string | null;
        starCount: number;
        starred: boolean;
        forkCount?: number;
    };
    username: string;
    activeTab: "code" | "pulls";
    isOwner?: boolean;
    parentRepo?: ParentRepo | null;
}

export function RepoHeader({ repo, username, activeTab, isOwner = false, parentRepo }: RepoHeaderProps) {
    const [isForking, setIsForking] = useState(false);
    const navigate = useNavigate();


    const handleFork = async () => {
        if (isForking || isOwner) return;

        setIsForking(true);
        try {
            const forkedRepo = await api.repositories.fork(username, repo.name);
            navigate({
                to: "/$username/$repo",
                params: { username: forkedRepo.owner.username, repo: forkedRepo.name }
            });
        } catch (err: unknown) {
            const error = err as Error;
            alert(error.message || "Failed to fork repository");
        } finally {
            setIsForking(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border text-muted-foreground">
                            {repo.visibility}
                        </span>
                    </div>
                    {parentRepo && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <GitFork className="h-3.5 w-3.5" />
                            forked from{" "}
                            <Link
                                to="/$username/$repo"
                                params={{ username: parentRepo.owner.username, repo: parentRepo.name }}
                                className="text-primary hover:underline"
                            >
                                {parentRepo.owner.username}/{parentRepo.name}
                            </Link>
                        </p>
                    )}
                    {repo.description && (
                        <p className="text-muted-foreground max-w-2xl">{repo.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <StarButton repoId={repo.id} initialStarred={repo.starred} initialCount={repo.starCount} />
                    <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 border border-border rounded-none"
                        onClick={handleFork}
                        disabled={isForking || isOwner}
                        title={isOwner ? "Cannot fork your own repository" : "Fork this repository"}
                    >
                        {isForking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <GitFork className="h-3.5 w-3.5" />
                        )}
                        <span>Fork</span>
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="h-4 w-4" />
                    <span className="font-medium text-foreground">{repo.starCount}</span>
                    <span>stars</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <GitFork className="h-4 w-4" />
                    <span className="font-medium text-foreground">{repo.forkCount ?? 0}</span>
                    <span>forks</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium text-foreground">0</span>
                    <span>watching</span>
                </div>
            </div>

            {parentRepo && (parentRepo.aheadBy > 0 || parentRepo.behindBy > 0) && (
                <div className="flex items-center gap-4 px-3 py-2 bg-secondary/30 border border-border text-sm">
                    <span className="text-muted-foreground">
                        This branch is
                    </span>
                    {parentRepo.behindBy > 0 && (
                        <span className="flex items-center gap-1 text-yellow-500">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                            <span className="font-medium">{parentRepo.behindBy}</span>
                            <span>commit{parentRepo.behindBy !== 1 ? "s" : ""} behind</span>
                        </span>
                    )}
                    {parentRepo.aheadBy > 0 && parentRepo.behindBy > 0 && (
                        <span className="text-muted-foreground">,</span>
                    )}
                    {parentRepo.aheadBy > 0 && (
                        <span className="flex items-center gap-1 text-green-500">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            <span className="font-medium">{parentRepo.aheadBy}</span>
                            <span>commit{parentRepo.aheadBy !== 1 ? "s" : ""} ahead of</span>
                        </span>
                    )}
                    <Link
                        to="/$username/$repo"
                        params={{ username: parentRepo.owner.username, repo: parentRepo.name }}
                        className="text-primary hover:underline font-medium"
                    >
                        {parentRepo.owner.username}:{parentRepo.defaultBranch}
                    </Link>
                </div>
            )}

            <RepoTabs activeTab={activeTab} />
        </div>
    );
}
