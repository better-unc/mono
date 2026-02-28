import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Tick02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { IssueAuthor, Owner } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssigneePickerProps {
  availableUsers?: IssueAuthor[];
  selectedIds?: string[];
  onToggle?: (userId: string) => void;
  availableAssignees?: Owner[];
  selectedAssignees?: Owner[];
  onAddAssignee?: (userId: string) => void;
  onRemoveAssignee?: (userId: string) => void;
  isLoading?: boolean;
  label?: string;
}

export function AssigneePicker({
  availableUsers,
  selectedIds,
  onToggle,
  availableAssignees,
  selectedAssignees,
  onAddAssignee,
  onRemoveAssignee,
  isLoading,
  label,
}: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const users = availableUsers || availableAssignees || [];
  const selectedUserIds = selectedIds || (selectedAssignees?.map((a) => a.id) ?? []);

  const handleToggle = (userId: string) => {
    if (onToggle) {
      onToggle(userId);
    } else if (selectedUserIds.includes(userId)) {
      onRemoveAssignee?.(userId);
    } else {
      onAddAssignee?.(userId);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5 mr-1" />
        {label || "Assign"}
      </Button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-1 min-w-[200px] max-h-[300px] overflow-y-auto">
            {users.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No users available</p>
            ) : (
              users.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggle(user.id)}
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
  );
}
