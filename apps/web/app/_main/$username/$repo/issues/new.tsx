import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCreateIssue } from "@gitbruv/hooks";
import { IssueForm } from "@/components/issues";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_main/$username/$repo/issues/new")({
  component: NewIssuePage,
});

function NewIssuePage() {
  const { username, repo } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

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
      <div className="container max-w-6xl px-4">
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
    <div className="container max-w-6xl px-4">
      <h1 className="text-xl font-bold mb-6">New issue</h1>

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
