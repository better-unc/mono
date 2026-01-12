import { Link, useParams } from "@tanstack/react-router";
import { Code, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

export function RepoTabs({ activeTab }: { activeTab: "code" | "pulls" }) {
    const { username, repo } = useParams({ strict: false });

    if (!username || !repo) return null;

    const tabs = [
        { id: "code", label: "Code", icon: Code, to: "/$username/$repo" },
        { id: "pulls", label: "Pull Requests", icon: GitPullRequest, to: "/$username/$repo/pulls" },
    ];

    return (
        <div className="flex items-center gap-1 border-b border-border">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <Link
                        key={tab.id}
                        to={tab.to as any}
                        params={{ username, repo } as any}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
                            isActive
                                ? "text-foreground border-primary bg-primary/5"
                                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
