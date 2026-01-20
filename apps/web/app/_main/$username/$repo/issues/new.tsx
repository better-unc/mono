import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons-pro/core-stroke-standard";
import { useCreateIssue, useRepositoryInfo } from "@gitbruv/hooks";
import { IssueForm } from "@/components/issues";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_main/$username/$repo/issues/new")({
  component: NewIssuePage,
});

function NewIssuePage() {
  const { username, repo } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const { data: repoInfo } = useRepositoryInfo(username, repo);
  const createIssue = useCreateIssue(username, repo);

  const handleSubmit = async (data: { title: string; body: string }) => {
    const issue = await createIssue.mutateAsync({
      title: data.title,
      body: data.body || undefined,
    });
    navigate({
      to: "/$username/$repo/issues/$number",
      params: { username, repo, number: String(issue.number) },
    });
  };

  if (!session?.user) {
    return (
      <div className="container max-w-3xl px-4 py-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to create an issue.</p>
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/$username/$repo/issues"
          params={{ username, repo }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New issue</h1>
          <p className="text-sm text-muted-foreground">
            <Link to="/$username/$repo" params={{ username, repo }} className="hover:underline">
              {username}/{repo}
            </Link>
          </p>
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <IssueForm
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/$username/$repo/issues", params: { username, repo } })}
          submitLabel="Submit new issue"
          isSubmitting={createIssue.isPending}
        />
      </div>
    </div>
  );
}
