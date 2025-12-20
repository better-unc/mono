"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getPublicServerUrl } from "@/lib/utils";

export function CloneUrl({ username, repoName }: { username: string; repoName: string }) {
  const [copied, setCopied] = useState(false);
  const [protocol, setProtocol] = useState<"https" | "ssh">("https");

  const baseUrl = getPublicServerUrl();
  const httpsUrl = `${baseUrl}/api/git/${username}/${repoName}.git`;
  const sshUrl = `git@gitbruv.local:${username}/${repoName}.git`;

  const url = protocol === "https" ? httpsUrl : sshUrl;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            {protocol.toUpperCase()}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setProtocol("https")}>HTTPS</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setProtocol("ssh")}>SSH</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="relative flex-1 min-w-[280px]">
        <Input value={url} readOnly className="pr-10 font-mono text-xs bg-muted" />
        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={copyToClipboard}>
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
