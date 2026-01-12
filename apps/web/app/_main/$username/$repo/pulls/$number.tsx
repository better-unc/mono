import { createFileRoute } from "@tanstack/react-router";
import {
    useRepoPageData,
    usePullRequest,
    usePullRequestCommits,
    usePullRequestDiff,
    usePullRequestEvents,
    useMergePullRequest,
    useUpdatePullRequestBranch,
    type SyncStatus,
    type PullRequestEvent
} from "@/lib/hooks/use-repositories";
import { useState } from "react";
import {
    GitPullRequest,
    MessageSquare,
    History,
    FileCode,
    Loader2,
    CheckCircle2,
    GitMerge,
    Clock,
    User,
    XCircle,
    AlertTriangle,
    RefreshCw,
    GitCommit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepoHeader } from "@/components/repo-header";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_main/$username/$repo/pulls/$number")({
    component: PullRequestDetailPage,
});

function PullRequestDetailPage() {
    const { username, repo: repoName, number } = Route.useParams();
    const prNumber = parseInt(number, 10);

    const { data: repoData, isLoading: repoLoading } = useRepoPageData(username, repoName);
    const { data: pr, isLoading: prLoading, mutate: mutatePr } = usePullRequest(username, repoName, prNumber);
    const { data: diffData, mutate: mutateDiff } = usePullRequestDiff(username, repoName, prNumber);
    const { data: events, mutate: mutateEvents } = usePullRequestEvents(username, repoName, prNumber);

    const [activeTab, setActiveTab] = useState<"conversation" | "commits" | "files">("conversation");

    const handleBranchUpdate = () => {
        // Refresh PR data, diff data, and events after branch update
        mutatePr();
        mutateDiff();
        mutateEvents();
    };

    if (repoLoading || prLoading || !repoData || !pr) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { repo, isOwner } = repoData;

    return (
        <div className="container max-w-6xl px-4 py-8">
            <RepoHeader repo={repo} username={username} activeTab="pulls" isOwner={isOwner} parentRepo={repoData.parentRepo} />

            <div className="mt-8 space-y-6">
                <div className="space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                        <h2 className="text-2xl font-semibold">{pr.title} <span className="text-muted-foreground font-normal">#{pr.number}</span></h2>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-0.5 rounded-none text-xs font-medium",
                            pr.status === "open" ? "bg-green-500/10 text-green-500" :
                                pr.status === "merged" ? "bg-purple-500/10 text-purple-500" :
                                    "bg-red-500/10 text-red-500"
                        )}>
                            {pr.status === "open" ? <GitPullRequest className="h-3.5 w-3.5" /> :
                                pr.status === "merged" ? <GitMerge className="h-3.5 w-3.5" /> :
                                    <XCircle className="h-3.5 w-3.5" />}
                            <span className="capitalize">{pr.status}</span>
                        </div>
                        <span className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{pr.author.username}</span> wants to merge patches from <code className="bg-secondary px-1.5 py-0.5 rounded-none text-foreground">{pr.headBranch}</code> into <code className="bg-secondary px-1.5 py-0.5 rounded-none text-foreground">{pr.baseBranch}</code>
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between border-b border-border">
                    <div className="flex">
                        <TabButton active={activeTab === "conversation"} onClick={() => setActiveTab("conversation")} icon={MessageSquare} label="Conversation" />
                        <TabButton active={activeTab === "commits"} onClick={() => setActiveTab("commits")} icon={History} label="Commits" />
                        <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")} icon={FileCode} label="Files changed" />
                    </div>
                    {diffData && <DiffStats diffs={diffData.diffs} />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="md:col-span-3 space-y-6">
                        {activeTab === "conversation" && <ConversationView pr={pr} onMerge={() => mutatePr()} syncStatus={diffData?.syncStatus} onBranchUpdate={handleBranchUpdate} events={events} />}
                        {activeTab === "commits" && <CommitsView username={username} repo={repoName} number={prNumber} />}
                        {activeTab === "files" && <DiffView username={username} repo={repoName} number={prNumber} />}
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-2">Reviewers</h3>
                            <p className="text-sm text-muted-foreground italic">No reviewers assigned</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-2">Assignees</h3>
                            <p className="text-sm text-muted-foreground italic">No one assigned</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-2">Labels</h3>
                            <p className="text-sm text-muted-foreground italic">None yet</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function ConversationView({ pr, onMerge, syncStatus, onBranchUpdate, events }: { pr: any; onMerge: () => void; syncStatus?: SyncStatus; onBranchUpdate?: () => void; events?: PullRequestEvent[] }) {
    const { username, repo, number } = Route.useParams();
    const mergePr = useMergePullRequest(username, repo, parseInt(number, 10));
    const updateBranch = useUpdatePullRequestBranch(username, repo, parseInt(number, 10));

    const handleMerge = async () => {
        if (!confirm("Are you sure you want to merge this pull request?")) return;
        try {
            await mergePr.trigger();
            onMerge();
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateBranch = async () => {
        try {
            await updateBranch.trigger();
            onBranchUpdate?.();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to update branch");
        }
    };

    const canMerge = !syncStatus?.hasConflicts;

    return (
        <div className="space-y-6">
            {/* PR Description */}
            <div className="bg-card border border-border rounded-none overflow-hidden">
                <div className="bg-secondary/30 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{pr.author.username}</span>
                        <span className="text-muted-foreground">opened this pull request {formatDistanceToNow(new Date(pr.createdAt))} ago</span>
                    </div>
                </div>
                <div className="p-4 prose prose-invert max-w-none">
                    {pr.description ? (
                        <p>{pr.description}</p>
                    ) : (
                        <p className="italic text-muted-foreground">No description provided.</p>
                    )}
                </div>
            </div>

            {/* Events Timeline */}
            {events && events.length > 0 && (
                <div className="space-y-4">
                    {events.map((event) => (
                        <EventItem key={event.id} event={event} />
                    ))}
                </div>
            )}

            {/* Out of sync warning */}
            {pr.status === "open" && syncStatus?.isOutOfSync && (
                <div className={cn(
                    "border rounded-none p-6 space-y-4",
                    syncStatus.hasConflicts
                        ? "bg-red-500/5 border-red-500/30"
                        : "bg-yellow-500/5 border-yellow-500/30"
                )}>
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "p-2 rounded-none",
                            syncStatus.hasConflicts ? "bg-red-500/20" : "bg-yellow-500/20"
                        )}>
                            <AlertTriangle className={cn(
                                "h-5 w-5",
                                syncStatus.hasConflicts ? "text-red-500" : "text-yellow-500"
                            )} />
                        </div>
                        <div className="space-y-2 flex-1">
                            <h4 className="font-semibold">
                                {syncStatus.hasConflicts
                                    ? "This branch has conflicts that must be resolved"
                                    : "This branch is out of sync with the base branch"
                                }
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                The base branch <code className="bg-secondary px-1.5 py-0.5 rounded-none">{syncStatus.baseBranch}</code> has
                                {" "}<span className="font-medium text-foreground">{syncStatus.behindBy} new commit{syncStatus.behindBy !== 1 ? "s" : ""}</span> since
                                this pull request was created.
                            </p>

                            {/* Update branch button - only show when no conflicts */}
                            {!syncStatus.hasConflicts && (
                                <div className="mt-4">
                                    <Button
                                        onClick={handleUpdateBranch}
                                        disabled={updateBranch.isMutating}
                                        variant="outline"
                                        className="gap-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                                    >
                                        {updateBranch.isMutating ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        Update branch
                                    </Button>
                                </div>
                            )}

                            {syncStatus.hasConflicts && syncStatus.conflictingFiles.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-sm font-medium text-red-400">Conflicting files:</p>
                                    <ul className="text-sm space-y-1">
                                        {syncStatus.conflictingFiles.map(file => (
                                            <li key={file} className="flex items-center gap-2">
                                                <FileCode className="h-3.5 w-3.5 text-red-400" />
                                                <code className="bg-red-500/10 px-1.5 py-0.5 rounded-none text-red-300">{file}</code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Show manual instructions when there are conflicts or as alternative */}
                            <details className="mt-4">
                                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                                    {syncStatus.hasConflicts ? "Manual resolution required" : "Or update manually via command line"}
                                </summary>
                                <div className="mt-2 p-3 bg-secondary/30 rounded-none border border-border">
                                    <div className="space-y-1 text-xs font-mono text-muted-foreground">
                                        <p>$ git fetch upstream</p>
                                        <p>$ git checkout {pr.headBranch}</p>
                                        <p>$ git merge upstream/{syncStatus.baseBranch}</p>
                                        {syncStatus.hasConflicts && <p className="text-red-400"># Resolve conflicts, then:</p>}
                                        <p>$ git push origin {pr.headBranch}</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            )}

            {pr.status === "open" && !syncStatus?.hasConflicts && (
                <div className="bg-secondary/10 border border-border rounded-none p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-green-500/20 p-2 rounded-none">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold">
                                {syncStatus?.isOutOfSync
                                    ? "This branch can still be merged (no conflicts)"
                                    : "This branch has no conflicts with the base branch"
                                }
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {syncStatus?.isOutOfSync
                                    ? "Consider updating this branch first for a cleaner history."
                                    : "Merging can be performed automatically."
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <Button onClick={handleMerge} disabled={mergePr.isMutating || !canMerge} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                            {mergePr.isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                            Merge pull request
                        </Button>
                    </div>
                </div>
            )}

            {pr.status === "open" && syncStatus?.hasConflicts && (
                <div className="bg-red-500/5 border border-red-500/30 rounded-none p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-red-500/20 p-2 rounded-none">
                            <XCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold">Merging is blocked</h4>
                            <p className="text-sm text-muted-foreground">
                                This pull request has conflicts that must be resolved before it can be merged.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <Button disabled className="bg-gray-600 text-gray-400 gap-2 cursor-not-allowed">
                            <GitMerge className="h-4 w-4" />
                            Merge pull request
                        </Button>
                    </div>
                </div>
            )}

            {pr.status === "merged" && (
                <div className="flex items-center gap-4 bg-purple-500/5 border border-purple-500/20 rounded-none p-4">
                    <div className="bg-purple-500/20 p-2 rounded-none">
                        <GitMerge className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-semibold">Pull request successfully merged</h4>
                        <p className="text-sm text-muted-foreground">Changes have been applied to the base branch.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function EventItem({ event }: { event: PullRequestEvent }) {
    if (event.type === "commit" && event.data?.commits) {
        const commits = event.data.commits;
        return (
            <div className="flex gap-3">
                <div className="flex flex-col items-center">
                    <div className="bg-secondary p-1.5 rounded-full">
                        <GitCommit className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 w-px bg-border" />
                </div>
                <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 text-sm mb-2">
                        <span className="font-medium">{event.actor?.username || "Unknown"}</span>
                        <span className="text-muted-foreground">
                            added {commits.length} commit{commits.length !== 1 ? "s" : ""} {formatDistanceToNow(new Date(event.createdAt))} ago
                        </span>
                    </div>
                    <div className="border border-border rounded-none divide-y divide-border bg-card">
                        {commits.map((commit) => (
                            <div key={commit.oid} className="p-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-6 w-6 shrink-0">
                                        <AvatarFallback className="text-xs">{commit.author.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{commit.message.split('\n')[0]}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {commit.author.name} • {new Date(commit.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <code className="text-xs font-mono bg-secondary px-2 py-1 rounded-none shrink-0 ml-2">
                                    {commit.oid.substring(0, 7)}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === "branch_update") {
        return (
            <div className="flex gap-3">
                <div className="flex flex-col items-center">
                    <div className="bg-blue-500/20 p-1.5 rounded-full">
                        <RefreshCw className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 w-px bg-border" />
                </div>
                <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{event.actor?.username || "Unknown"}</span>
                        <span className="text-muted-foreground">
                            merged {event.data?.commitCount || 0} commit{(event.data?.commitCount || 0) !== 1 ? "s" : ""} from
                            {" "}<code className="bg-secondary px-1.5 py-0.5 rounded-none text-foreground">{event.data?.baseBranch}</code>
                            {" "}into this branch {formatDistanceToNow(new Date(event.createdAt))} ago
                        </span>
                    </div>
                    {event.data?.mergeCommitOid && (
                        <div className="mt-1 text-xs text-muted-foreground">
                            Merge commit: <code className="bg-secondary px-1 py-0.5 rounded-none">{event.data.mergeCommitOid.substring(0, 7)}</code>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Default/unknown event type
    return null;
}

function CommitsView({ username, repo, number }: { username: string; repo: string; number: number }) {
    const { data: commits, isLoading } = usePullRequestCommits(username, repo, number);

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (!commits) return null;

    return (
        <div className="border border-border rounded-none divide-y divide-border">
            {commits.map((commit) => (
                <div key={commit.oid} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{commit.author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{commit.message}</p>
                            <p className="text-xs text-muted-foreground">{commit.author.name} committed on {new Date(commit.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <code className="text-xs font-mono bg-secondary px-2 py-1 rounded-none">{commit.oid.substring(0, 7)}</code>
                </div>
            ))}
        </div>
    );
}

function DiffStats({ diffs }: { diffs: DiffFile[] }) {
    let totalAdditions = 0;
    let totalDeletions = 0;

    diffs.forEach((file) => {
        const diffLines = computeDiffLines(file.baseContent ?? "", file.headContent ?? "");
        totalAdditions += diffLines.filter(l => l.type === "add").length;
        totalDeletions += diffLines.filter(l => l.type === "del").length;
    });

    const total = totalAdditions + totalDeletions;
    const blocks = 5;

    // Calculate filled blocks using floor to avoiding overfilling
    // This creates a "at least this many" representation
    const addBlocks = total > 0 ? Math.floor((totalAdditions / total) * blocks) : 0;
    const delBlocks = total > 0 ? Math.floor((totalDeletions / total) * blocks) : 0;

    // If we have remainders (e.g. 2.5 and 2.5), floor gives 2 and 2 = 4 total.
    // Ideally we want to fill the "remainder" based on who has more?
    // But keeping it simple with floor is safe.

    // Only boost if we have changes but 0 blocks showing (e.g. extremely small ratio)
    // but since we have 5 blocks, 1/5 = 20%. 
    // Let's refine: Use round but clamp.
    let rAdd = Math.round((totalAdditions / total) * blocks);
    let rDel = Math.round((totalDeletions / total) * blocks);

    if (total > 0) {
        if (rAdd + rDel > blocks) {
            // Reduce the one that matches less close? Or just reduce deletions (secondary)
            if (rDel > 0) rDel--;
            else rAdd--;
        }
        // If we still have space and we rounded down both? 
        // Example 0.5, 0.5 -> 1, 1. Sum 2. OK.
    }

    return (
        <div className="flex items-center gap-3 pr-2">
            <div className="flex items-center gap-1 font-mono text-xs font-medium">
                <span className="text-green-500">+{totalAdditions}</span>
                <span className="text-red-500">−{totalDeletions}</span>
            </div>
            <div className="flex gap-0.5">
                {Array.from({ length: blocks }).map((_, i) => {
                    let color = "bg-secondary";
                    if (i < rAdd) color = "bg-green-500";
                    else if (i < rAdd + rDel) color = "bg-red-500";

                    return (
                        <div key={i} className={cn("w-2.5 h-2.5 rounded-[1px]", color)} />
                    );
                })}
            </div>
        </div>
    );
}

function DiffView({ username, repo, number }: { username: string; repo: string; number: number }) {
    const { data: diffData, isLoading } = usePullRequestDiff(username, repo, number);

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (!diffData) return null;

    const syncStatus = diffData.syncStatus;

    return (
        <div className="space-y-4">
            {/* Out of sync notice in diff view */}
            {syncStatus?.isOutOfSync && (
                <div className={cn(
                    "flex items-center gap-3 p-3 rounded-none border text-sm",
                    syncStatus.hasConflicts
                        ? "bg-red-500/5 border-red-500/30 text-red-300"
                        : "bg-yellow-500/5 border-yellow-500/30 text-yellow-300"
                )}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        {syncStatus.hasConflicts
                            ? `This diff shows the PR author's changes, but there are conflicts with ${syncStatus.behindBy} new commits on ${syncStatus.baseBranch}.`
                            : `This diff shows the PR author's changes. The base branch has ${syncStatus.behindBy} new commit${syncStatus.behindBy !== 1 ? "s" : ""} since this PR was created.`
                        }
                    </span>
                </div>
            )}

            <div className="flex items-center text-sm px-1">
                <span className="text-muted-foreground">Showing {diffData.diffs.length} changed file{diffData.diffs.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-6">
                {diffData.diffs.map((file) => (
                    <FileDiff key={file.path} file={file} conflicting={syncStatus?.conflictingFiles.includes(file.path)} />
                ))}
            </div>
        </div>
    );
}

type DiffFile = {
    path: string;
    type: "added" | "deleted" | "modified";
    baseContent?: string | null;
    headContent?: string | null;
};

function FileDiff({ file, conflicting }: { file: DiffFile; conflicting?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Compute diff lines
    const diffLines = computeDiffLines(file.baseContent ?? "", file.headContent ?? "");
    const additions = diffLines.filter(l => l.type === "add").length;
    const deletions = diffLines.filter(l => l.type === "del").length;

    return (
        <div className={cn(
            "border rounded-none overflow-hidden",
            conflicting ? "border-red-500/50" : "border-border"
        )}>
            <div
                className={cn(
                    "px-4 py-2 border-b flex items-center justify-between cursor-pointer transition-colors",
                    conflicting
                        ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/15"
                        : "bg-secondary/30 border-border hover:bg-secondary/40"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <FileCode className={cn("h-4 w-4", conflicting ? "text-red-400" : "text-muted-foreground")} />
                    {file.path}
                    {conflicting && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-none font-bold bg-red-500/20 text-red-400">
                            Conflict
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {additions > 0 && <span className="text-green-500 text-xs font-mono">+{additions}</span>}
                    {deletions > 0 && <span className="text-red-500 text-xs font-mono">-{deletions}</span>}
                    <span className={cn(
                        "text-[10px] uppercase px-1.5 py-0.5 rounded-none font-bold",
                        file.type === "added" ? "bg-green-500/10 text-green-500" :
                            file.type === "deleted" ? "bg-red-500/10 text-red-500" :
                                "bg-blue-500/10 text-blue-500"
                    )}>
                        {file.type}
                    </span>
                </div>
            </div>
            {isExpanded && (
                <div className="overflow-x-auto">
                    {file.baseContent === null && file.headContent === null ? (
                        <div className="p-8 text-center text-sm text-muted-foreground bg-secondary/5 italic">
                            Binary file not shown
                        </div>
                    ) : (
                        <table className="w-full text-xs font-mono">
                            <tbody>
                                {diffLines.map((line, index) => (
                                    <tr
                                        key={index}
                                        className={cn(
                                            "border-b border-border/30 last:border-b-0",
                                            line.type === "add" && "bg-green-500/10",
                                            line.type === "del" && "bg-red-500/10"
                                        )}
                                    >
                                        <td className="w-10 text-right px-2 py-0.5 text-muted-foreground select-none border-r border-border/20">
                                            {line.oldLineNo ?? ""}
                                        </td>
                                        <td className="w-10 text-right px-2 py-0.5 text-muted-foreground select-none border-r border-border/20">
                                            {line.newLineNo ?? ""}
                                        </td>
                                        <td className={cn(
                                            "w-6 text-center select-none",
                                            line.type === "add" && "text-green-500",
                                            line.type === "del" && "text-red-500"
                                        )}>
                                            {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                                        </td>
                                        <td className="px-2 py-0.5 whitespace-pre">
                                            {line.content}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

type DiffLine = {
    type: "add" | "del" | "normal";
    content: string;
    oldLineNo?: number;
    newLineNo?: number;
};

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
    // Handle empty cases properly - split on empty string gives [""] which is wrong
    const oldLines = oldText === "" ? [] : oldText.split("\n");
    const newLines = newText === "" ? [] : newText.split("\n");

    // Use LCS (Longest Common Subsequence) approach for better diffs
    const result: DiffLine[] = [];

    let oldIdx = 0;
    let newIdx = 0;
    let oldLineNo = 1;
    let newLineNo = 1;

    // Simple diff: compare line by line
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
        if (oldIdx >= oldLines.length) {
            // Rest are additions
            result.push({ type: "add", content: newLines[newIdx], newLineNo: newLineNo++ });
            newIdx++;
        } else if (newIdx >= newLines.length) {
            // Rest are deletions
            result.push({ type: "del", content: oldLines[oldIdx], oldLineNo: oldLineNo++ });
            oldIdx++;
        } else if (oldLines[oldIdx] === newLines[newIdx]) {
            // Same line
            result.push({ type: "normal", content: oldLines[oldIdx], oldLineNo: oldLineNo++, newLineNo: newLineNo++ });
            oldIdx++;
            newIdx++;
        } else {
            // Different - look ahead to find matching lines
            let foundInNew = -1;
            let foundInOld = -1;

            // Look for current old line in upcoming new lines
            for (let i = newIdx; i < Math.min(newIdx + 5, newLines.length); i++) {
                if (newLines[i] === oldLines[oldIdx]) {
                    foundInNew = i;
                    break;
                }
            }

            // Look for current new line in upcoming old lines
            for (let i = oldIdx; i < Math.min(oldIdx + 5, oldLines.length); i++) {
                if (oldLines[i] === newLines[newIdx]) {
                    foundInOld = i;
                    break;
                }
            }

            if (foundInNew !== -1 && (foundInOld === -1 || foundInNew - newIdx <= foundInOld - oldIdx)) {
                // Add the new lines until we reach the match
                while (newIdx < foundInNew) {
                    result.push({ type: "add", content: newLines[newIdx], newLineNo: newLineNo++ });
                    newIdx++;
                }
            } else if (foundInOld !== -1) {
                // Delete the old lines until we reach the match
                while (oldIdx < foundInOld) {
                    result.push({ type: "del", content: oldLines[oldIdx], oldLineNo: oldLineNo++ });
                    oldIdx++;
                }
            } else {
                // No match found nearby, show as deletion then addition
                result.push({ type: "del", content: oldLines[oldIdx], oldLineNo: oldLineNo++ });
                result.push({ type: "add", content: newLines[newIdx], newLineNo: newLineNo++ });
                oldIdx++;
                newIdx++;
            }
        }
    }

    return result;
}

