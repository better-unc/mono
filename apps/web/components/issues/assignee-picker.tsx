import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Tick02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { IssueAuthor } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssigneePickerProps {
  availableUsers: IssueAuthor[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  isLoading?: boolean;
}

export function AssigneePicker({ availableUsers, selectedIds, onToggle, isLoading }: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedUsers = availableUsers.filter((u) => selectedIds.includes(u.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Assignees</span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          </Button>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                {availableUsers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No users available</p>
                ) : (
                  availableUsers.map((user) => {
                    const isSelected = selectedIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => onToggle(user.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px]">{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-left truncate">{user.username}</span>
                        {isSelected && (
                          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-primary" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{user.username}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No one assigned</p>
      )}
    </div>
  );
}
