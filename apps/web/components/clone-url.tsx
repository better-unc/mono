"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircleIcon, Copy01Icon, ArrowDown01Icon } from "@hugeicons-pro/core-stroke-standard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getApiUrl } from "@/lib/utils";

export function CloneUrl({ username, repoName }: { username: string; repoName: string }) {
  const [copied, setCopied] = useState(false);
  const [protocol, setProtocol] = useState<"https" | "ssh">("https");

  const httpsUrl = `${getApiUrl()}/${username}/${repoName}.git`;
  const sshUrl = `git@gitbruv.local:${username}/${repoName}.git`;

  // const url = httpsUrl;
  const url = protocol === "https" ? httpsUrl : sshUrl;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "default" })}>
          {/* {protocol.toUpperCase()} */}
          HTTPS
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setProtocol("https")}>HTTPS</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setProtocol("ssh")}>SSH</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="relative flex-1 min-w-[280px]">
        <Input value={url} readOnly className="pr-10 font-mono text-xs bg-muted" />
        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={copyToClipboard}>
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircleIcon} strokeWidth={2} className="size-3.5 text-primary" />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
