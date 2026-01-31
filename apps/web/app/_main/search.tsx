import { Search01Icon, Loading02Icon } from '@hugeicons-pro/core-stroke-standard';
import { createFileRoute } from '@tanstack/react-router';
import { SearchResultsList } from '@/components/search';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearch } from '@gitbruv/hooks';
import { useState } from 'react';

export const Route = createFileRoute('/_main/search')({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || '',
    type: (search.type as string) || 'all',
  }),
});

const SEARCH_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'repositories', label: 'Repositories' },
  { value: 'issues', label: 'Issues' },
  { value: 'pulls', label: 'Pull Requests' },
  { value: 'users', label: 'Users' },
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
            />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories, issues, pull requests, and users..."
              className="h-9 pl-10 text-lg"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" disabled={!query.trim()}>
            Search
          </Button>
        </div>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {SEARCH_TYPES.map((t) => (
          <Button
            key={t.value}
            variant={type === t.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleTypeChange(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {q.length < 2 ? (
        <div className="text-muted-foreground py-16 text-center">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="mx-auto mb-4 size-12 opacity-50"
          />
          <p>Enter at least 2 characters to search</p>
        </div>
      ) : isLoading || isFetching ? (
        <div className="py-16 text-center">
          <HugeiconsIcon
            icon={Loading02Icon}
            strokeWidth={2}
            className="text-muted-foreground mx-auto size-8 animate-spin"
          />
          <p className="text-muted-foreground mt-4">Searching...</p>
        </div>
      ) : data?.results ? (
        <>
          <div className="text-muted-foreground mb-4 text-sm">
            {data.results.length} result{data.results.length !== 1 ? 's' : ''} for "{q}"
          </div>
          <SearchResultsList results={data.results} />
        </>
      ) : null}
    </div>
  );
}
