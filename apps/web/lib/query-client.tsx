import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@gitbruv/hooks";
import { DEFAULT_QUERY_OPTIONS } from "@gitbruv/lib";
import { api } from "./api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: DEFAULT_QUERY_OPTIONS,
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}
