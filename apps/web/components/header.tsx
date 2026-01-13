import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";
import { useUserProfile } from "@gitbruv/hooks";
import { Link, useNavigate, useLocation, useParams } from "@tanstack/react-router";
import { Bell, Inbox, LogOut, Moon, Plus, Settings, Sun, User } from "lucide-react";
import { useTheme } from "tanstack-theme-kit";

export function Header() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const params = useParams({ strict: false });

  const { data: session } = useSession();
  // @ts-ignore
  const { data: user } = useUserProfile(session?.user?.username || "");

  const isRepoPage = location.pathname.match(/\/[^/]+\/[^/]+/);
  const username = params.username as string | undefined;
  const repoName = params.repo as string | undefined;

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="px-4 md:px-6 flex h-14 items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="h-8 w-8 bg-foreground flex items-center justify-center text-background font-bold text-lg" />
          </Link>

          {isRepoPage && username && repoName && (
            <div className="flex items-center gap-1.5 text-sm">
              <Link to="/$username" params={{ username }} className="text-primary hover:underline">
                {username}
              </Link>
              <span className="text-muted-foreground">/</span>
              <Link to="/$username/$repo" params={{ username, repo: repoName }} className="text-primary hover:underline font-semibold">
                {repoName}
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {session?.user ? (
              <>
                <Button variant="ghost" size="icon">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Inbox className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>

          {session?.user ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="p-0!">
                    <Link to="/new" className="gap-2 flex items-center grow p-2">
                      <BookIcon className="h-4 w-4" />
                      New repository
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="h-8 w-8">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Avatar className="h-8 w-8 border border-border rounded-none">
                      <AvatarImage src={user?.avatarUrl || undefined} className="rounded-none" />
                      <AvatarFallback className="bg-accent/10 text-accent text-xs font-semibold rounded-none">
                        {session.user.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="px-3 py-2 flex items-start flex-col gap-1">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">@{(session.user as { username?: string }).username}</p>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-0!">
                    <Link
                      to="/$username"
                      params={{
                        username: (session.user as { username?: string }).username || "",
                      }}
                      className="gap-2 flex items-center grow p-2"
                    >
                      <User className="h-4 w-4" />
                      Your profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0!">
                    <Link to="/settings" className="gap-2 flex items-center grow p-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-0!">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer gap-2 text-destructive flex items-center justify-start grow focus:text-destructive focus:bg-destructive/10 p-2"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z" />
    </svg>
  );
}
