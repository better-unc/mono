import { useQuery } from "@tanstack/react-query";
import { useApi } from "./context";


export function useSearch(
  query: string,
  options?: {
    type?: "all" | "repositories" | "repos" | "issues" | "pulls" | "prs" | "users";
    limit?: number;
    offset?: number;
    enabled?: boolean;
  }
) {
  const api = useApi();
  const { type = "all", limit = 20, offset = 0, enabled = true } = options || {};

  return useQuery({
    queryKey: ["search", query, type, limit, offset],
    queryFn: () => api.search.query(query, { type, limit, offset }),
    enabled: enabled && query.length >= 2,
    staleTime: 30000,
  });
}
