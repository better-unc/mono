import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon, CheckmarkCircle02Icon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@gitbruv/hooks";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "./notification-item";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const { data: notificationsData, isLoading } = useNotifications({ limit: 10 });
  const { data: unreadData } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadData?.count || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
        <HugeiconsIcon icon={Notification01Icon} strokeWidth={2} className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="font-medium text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              {markAllRead.isPending ? (
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-3 animate-spin mr-1" />
              ) : (
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => {
                    if (!notification.read) {
                      markRead.mutate(notification.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
