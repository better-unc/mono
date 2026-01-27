import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import { useSearch } from "@gitbruv/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchResultsList } from "@/components/search";

export const Route = createFileRoute("/_main/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
    type: (search.type as string) || "all",
  }),
});

const SEARCH_TYPES = [
  { value: "all", label: "All" },
  { value: "repositories", label: "Repositories" },
  { value: "issues", label: "Issues" },
  { value: "pulls", label: "Pull Requests" },
  { value: "users", label: "Users" },
];

function SearchPage() {
  const { q, type: initialType } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [query, setQuery] = useState(q);
  const [type, setType] = useState(initialType);

  const { data, isLoading, isFetching } = useSearch(q, {
    type: type as any,
    limit: 30,
    enabled: q.length >= 2,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate({ search: { q: query, type } });
    }
  }

  function handleTypeChange(newType: string) {
    setType(newType);
    if (q) {
      navigate({ search: { q, type: newType } });
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
            />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories, issues, pull requests, and users..."
              className="pl-10 h-9 text-lg"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" disabled={!query.trim()}>
            Search
          </Button>
        </div>
      </form>

      <div className="flex gap-2 mb-6 flex-wrap">
        {SEARCH_TYPES.map((t) => (
          <Button
            key={t.value}
            variant={type === t.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {q.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-12 mx-auto mb-4 opacity-50" />
          <p>Enter at least 2 characters to search</p>
        </div>
      ) : isLoading || isFetching ? (
        <div className="text-center py-16">
          <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Searching...</p>
        </div>
      ) : data?.results ? (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {data.results.length} result{data.results.length !== 1 ? "s" : ""} for "{q}"
          </div>
          <SearchResultsList results={data.results} />
        </>
      ) : null}
    </div>
  );
}
