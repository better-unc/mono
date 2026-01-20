export const DEFAULT_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  retry: 2,
  refetchOnWindowFocus: false,
} as const;
