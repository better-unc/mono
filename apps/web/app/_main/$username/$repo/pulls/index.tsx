import { createFileRoute, Link } from "@tanstack/react-router";
import { useRepoPageData, useRepoPullRequests } from "@/lib/hooks/use-repositories";
import { type PullRequestWithAuthor } from "@/lib/api/client";
import { RepoHeader } from "@/components/repo-header";
import {
    GitPullRequest,
    Loader2,
    Plus,
    Search,
    CheckCircle2
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo/pulls/")({
    component: PullsIndexPage,
});

function PullsIndexPage() {
    const { username, repo: repoName } = Route.useParams();
    const { data: repoData, isLoading: repoLoading } = useRepoPageData(username, repoName);
    const { data: pullsData, isLoading: pullsLoading } = useRepoPullRequests(username, repoName);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");

    if (repoLoading || !repoData) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { repo, isOwner } = repoData;
    const pulls = pullsData || [];

    const filteredPulls = pulls.filter((pr: PullRequestWithAuthor) => {
        const matchesStatus = statusFilter === "all" || pr.status === statusFilter;
        const matchesSearch = pr.title.toLowerCase().includes(search.toLowerCase()) ||
            pr.number.toString() === search;
        return matchesStatus && matchesSearch;
    });

    const openCount = pulls.filter((pr: PullRequestWithAuthor) => pr.status === "open").length;
    const closedCount = pulls.filter((pr: PullRequestWithAuthor) => pr.status === "closed").length;

    return (
        <div className="container max-w-6xl px-4 py-8">
            <RepoHeader repo={repo} username={username} activeTab="pulls" isOwner={isOwner} parentRepo={repoData.parentRepo} />

            <div className="mt-8 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search pull requests..."
                            className="pl-9"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Link
                        to="/$username/$repo/pulls/new"
                        params={{ username, repo: repoName }}
                        className={cn(buttonVariants({ variant: "default" }), "gap-2")}
                    >
                        <Plus className="h-4 w-4" />
                        New pull request
                    </Link>
                </div>

                <div className="border border-border bg-card rounded-none overflow-hidden">
                    <div className="bg-secondary/30 px-4 py-3 border-b border-border flex items-center gap-4">
                        <button
                            onClick={() => setStatusFilter("open")}
                            className={cn(
                                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                                statusFilter === "open" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <GitPullRequest className="h-4 w-4" />
                            {openCount} Open
                        </button>
                        <button
                            onClick={() => setStatusFilter("closed")}
                            className={cn(
                                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                                statusFilter === "closed" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            {closedCount} Closed
                        </button>
                    </div>

                    {pullsLoading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredPulls.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <GitPullRequest className="h-10 w-10 mx-auto text-muted-foreground opacity-20" />
                            <h3 className="font-medium text-lg">No pull requests found</h3>
                            <p className="text-muted-foreground">There are no pull requests matching your current filters.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredPulls.map((pr: PullRequestWithAuthor) => (
                                <Link
                                    key={pr.id}
                                    to="/$username/$repo/pulls/$number"
                                    params={{ username, repo: repoName, number: String(pr.number) }}
                                    className="block p-4 hover:bg-secondary/20 transition-colors group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-1",
                                            pr.status === "open" ? "text-green-500" :
                                                pr.mergedAt ? "text-purple-500" : "text-red-500"
                                        )}>
                                            <GitPullRequest className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                                                {pr.title}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <span>#{pr.number}</span>
                                                <span>opened {formatDistanceToNow(new Date(pr.createdAt))} ago by {pr.authorId}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
