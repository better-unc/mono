import { useState, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  api,
  fetcher,
  type RepoPageData,
  type RepositoryWithOwner,
  type RepositoryWithStars,
  type FileEntry,
  type Commit,
  type PullRequest,
  type PullRequestWithAuthor
} from "@/lib/api/client";

export function useRepoPageData(owner: string, name: string) {
  return useSWR<RepoPageData>(owner && name ? `/api/repositories/${owner}/${name}/page-data` : null, fetcher);
}

export function useRepositoryWithStars(owner: string, name: string) {
  return useSWR<RepositoryWithOwner>(owner && name ? `/api/repositories/${owner}/${name}/with-stars` : null, fetcher);
}

export function useUserRepositories(username: string) {
  return useSWR<{ repos: RepositoryWithStars[] }>(username ? `/api/repositories/user/${username}` : null, fetcher);
}

export function usePublicRepositories(sortBy: "stars" | "updated" | "created" = "updated", limit = 20, offset = 0) {
  return useSWR<{ repos: RepositoryWithStars[]; hasMore: boolean }>(`/api/repositories/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`, fetcher);
}

export function useRepoTree(owner: string, name: string, branch: string, path = "") {
  return useSWR<{ files: FileEntry[]; isEmpty: boolean }>(
    owner && name && branch ? `/api/repositories/${owner}/${name}/tree?branch=${branch}&path=${encodeURIComponent(path)}` : null,
    fetcher
  );
}

export function useRepoFile(owner: string, name: string, branch: string, path: string) {
  return useSWR<{ content: string; oid: string; path: string }>(
    owner && name && branch && path ? `/api/repositories/${owner}/${name}/file?branch=${branch}&path=${encodeURIComponent(path)}` : null,
    fetcher
  );
}

export function useRepoBranches(owner: string, name: string) {
  return useSWR<{ branches: string[] }>(owner && name ? `/api/repositories/${owner}/${name}/branches` : null, fetcher);
}

export function useRepoCommits(owner: string, name: string, branch: string, limit = 30, skip = 0) {
  return useSWR<{ commits: Commit[]; hasMore: boolean }>(
    owner && name && branch ? `/api/repositories/${owner}/${name}/commits?branch=${branch}&limit=${limit}&skip=${skip}` : null,
    fetcher
  );
}

export function useRepoCommitCount(owner: string, name: string, branch: string) {
  return useSWR<{ count: number }>(owner && name && branch ? `/api/repositories/${owner}/${name}/commits/count?branch=${branch}` : null, fetcher);
}

export function useRepoReadme(owner: string, name: string, oid: string | null) {
  return useSWR<{ content: string }>(owner && name && oid ? `/api/repositories/${owner}/${name}/readme?oid=${oid}` : null, fetcher);
}

export function useCreateRepository() {
  return useSWRMutation("/api/repositories", (_, { arg }: { arg: { name: string; description?: string; visibility: "public" | "private" } }) =>
    api.repositories.create(arg)
  );
}

export function useUpdateRepository(id: string) {
  return useSWRMutation(`/api/repositories/${id}`, (_: any, { arg }: { arg: { name?: string; description?: string; visibility?: "public" | "private" } }) =>
    api.repositories.update(id, arg)
  );
}

export function useDeleteRepository(id: string) {
  return useSWRMutation(`/api/repositories/${id}`, () => api.repositories.delete(id));
}

export function useIsStarredByUser(repoId: string) {
  return useSWR<{ starred: boolean }>(repoId ? `/api/repositories/${repoId}/is-starred` : null, fetcher);
}

export function useStarRepository(repoId: string, initialStarCount?: number) {
  const { data, mutate, isLoading } = useIsStarredByUser(repoId);
  const [starCount, setStarCount] = useState(initialStarCount);
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    setStarCount(initialStarCount);
  }, [initialStarCount]);

  useEffect(() => {
    if (data !== undefined) {
      setIsStarred(data.starred);
    }
  }, [data]);

  const { trigger, isMutating } = useSWRMutation(`/api/repositories/${repoId}/star`, async () => {
    const currentStarred = isStarred;
    const newStarred = !currentStarred;
    setIsStarred(newStarred);
    mutate({ starred: newStarred }, false);
    setStarCount((prev) => (newStarred ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1)));
    try {
      const result = await api.repositories.toggleStar(repoId);
      setIsStarred(result.starred);
      mutate({ starred: result.starred }, false);
      return result;
    } catch (error) {
      setIsStarred(currentStarred);
      mutate({ starred: currentStarred }, false);
      setStarCount(initialStarCount);
      throw error;
    }
  });

  return {
    isStarred,
    isLoading,
    starCount,
    toggleStar: trigger,
    isMutating,
  };
}

export function useToggleStar(repoId: string) {
  const { mutate } = useSWRConfig();
  return useSWRMutation(`/api/repositories/${repoId}/star`, () => api.repositories.toggleStar(repoId), {
    onSuccess: () => {
      mutate(`/api/repositories/${repoId}/is-starred`);
    },
  });
}

export function useRepoPullRequests(owner: string, name: string, status?: string) {
  return useSWR<PullRequestWithAuthor[]>(
    owner && name ? `/api/repositories/${owner}/${name}/pulls${status ? `?status=${status}` : ""}` : null,
    fetcher
  );
}

export function usePullRequest(owner: string, name: string, number: number) {
  return useSWR<PullRequestWithAuthor>(
    owner && name && number ? `/api/repositories/${owner}/${name}/pulls/${number}` : null,
    fetcher
  );
}

export function usePullRequestCommits(owner: string, name: string, number: number) {
  return useSWR<Commit[]>(
    owner && name && number ? `/api/repositories/${owner}/${name}/pulls/${number}/commits` : null,
    fetcher
  );
}

export type PullRequestEvent = {
  id: string;
  pullRequestId: string;
  type: "commit" | "branch_update" | "comment" | "merged" | "closed" | "reopened";
  actorId: string | null;
  actor: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  data: {
    commits?: Array<{
      oid: string;
      message: string;
      author: { name: string; email: string };
      timestamp: number;
    }>;
    mergeCommitOid?: string;
    baseBranch?: string;
    commitCount?: number;
    body?: string;
  } | null;
  createdAt: string;
};

export function usePullRequestEvents(owner: string, name: string, number: number) {
  return useSWR<PullRequestEvent[]>(
    owner && name && number ? `/api/repositories/${owner}/${name}/pulls/${number}/events` : null,
    fetcher
  );
}

export type SyncStatus = {
  isOutOfSync: boolean;
  behindBy: number;
  hasConflicts: boolean;
  conflictingFiles: string[];
  baseBranch: string;
  mergeBaseOid?: string;
};

export type DiffResponse = {
  diffs: any[];
  syncStatus?: SyncStatus;
};

export function usePullRequestDiff(owner: string, name: string, number: number) {
  return useSWR<DiffResponse>(
    owner && name && number ? `/api/repositories/${owner}/${name}/pulls/${number}/diff` : null,
    fetcher
  );
}

export function useCreatePullRequest(owner: string, name: string) {
  return useSWRMutation(
    `/api/repositories/${owner}/${name}/pulls`,
    (_, { arg }: { arg: { title: string; description?: string; base: string; head: string; headOwner?: string; headRepo?: string } }) =>
      api.repositories.createPullRequest(owner, name, arg)
  );
}

export function useMergePullRequest(owner: string, name: string, number: number) {
  return useSWRMutation(
    `/api/repositories/${owner}/${name}/pulls/${number}/merge`,
    () => api.repositories.mergePullRequest(owner, name, number)
  );
}

export function useUpdatePullRequestBranch(owner: string, name: string, number: number) {
  return useSWRMutation(
    `/api/repositories/${owner}/${name}/pulls/${number}/update-branch`,
    () => api.repositories.updatePullRequestBranch(owner, name, number)
  );
}
