import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCreatePullRequest, useRepoBranches, useRepositoryInfo } from "@gitbruv/hooks";
import { PRForm } from "@/components/pulls/pr-form";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_main/$username/$repo/pulls/new")({
  component: NewPullRequestPage,
});

function NewPullRequestPage() {
  const { username, repo } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const { data: repoInfo, isLoading: isLoadingRepo } = useRepositoryInfo(username, repo);
  const { data: branchesData, isLoading: isLoadingBranches } = useRepoBranches(username, repo);

  const forkedFrom = repoInfo?.repo.forkedFrom;
  const { data: upstreamBranchesData } = useRepoBranches(
    forkedFrom?.owner.username || "",
    forkedFrom?.name || ""
  );

  const createPR = useCreatePullRequest(
    forkedFrom ? forkedFrom.owner.username : username,
    forkedFrom ? forkedFrom.name : repo
  );

  const branches = branchesData?.branches || [];
  const upstreamBranches = upstreamBranchesData?.branches || [];
  const defaultBranch = repoInfo?.repo.defaultBranch || "main";

  const handleSubmit = async (data: {
    title: string;
    body: string;
    headBranch: string;
    baseBranch: string;
    toUpstream?: boolean;
  }) => {
    if (data.toUpstream && forkedFrom) {
      const pr = await api.pullRequests.create(forkedFrom.owner.username, forkedFrom.name, {
        title: data.title,
        body: data.body || undefined,
        headRepoOwner: username,
        headRepoName: repo,
        headBranch: data.headBranch,
        baseBranch: data.baseBranch,
      });
      navigate({
        to: "/$username/$repo/pulls/$number",
        params: {
          username: forkedFrom.owner.username,
          repo: forkedFrom.name,
          number: String(pr.number),
        },
      });
    } else {
      const pr = await createPR.mutateAsync({
        title: data.title,
        body: data.body || undefined,
        headBranch: data.headBranch,
        baseBranch: data.baseBranch,
      });
      navigate({
        to: "/$username/$repo/pulls/$number",
        params: { username, repo, number: String(pr.number) },
      });
    }
  };

  if (!session?.user) {
    return (
      <div className="container max-w-6xl px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">
            You need to be signed in to create a pull request.
          </p>
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingRepo || isLoadingBranches) {
    return (
      <div className="container max-w-6xl px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-secondary/50" />
          <div className="h-64 bg-secondary/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl px-4">
      <h1 className="text-xl font-bold mb-6">New pull request</h1>

      <div className="border border-border bg-card p-6">
        <PRForm
          branches={branches}
          upstreamBranches={upstreamBranches}
          defaultBranch={defaultBranch}
          forkedFrom={forkedFrom}
          currentRepoOwner={username}
          currentRepoName={repo}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/$username/$repo/pulls", params: { username, repo } })}
          submitLabel="Create pull request"
          isSubmitting={createPR.isPending}
        />
      </div>
    </div>
  );
}
