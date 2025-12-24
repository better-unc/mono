import { Link, useLocation } from "@tanstack/react-router"
import { User, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/account", label: "Account", icon: Shield },
]

export function SettingsNav() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
