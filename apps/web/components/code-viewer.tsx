"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState, useCallback } from "react";
import { codeToHtml } from "shiki";
import { useTheme } from "tanstack-theme-kit";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircleIcon, Copy01Icon } from "@hugeicons-pro/core-stroke-standard";
import { cn } from "@/lib/utils";

export function CodeViewer({
  content,
  language,
  showLineNumbers = false,
  wordWrap = true,
  className,
}: {
  content: string;
  language: string;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
  className?: string;
}) {
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const { theme } = useTheme();
  const displayLineNumbers = showLineNumbers && !wordWrap;

  useEffect(() => {
    if (language === "markdown" || language === "md") return;

    async function highlight() {
      try {
        const html = await codeToHtml(content, {
          lang: language === "text" ? "plaintext" : language,
          theme: theme === "dark" ? "github-dark-default" : "github-light-default",
        });
        setHighlightedCode(html);
      } catch {
        setHighlightedCode(null);
      }
    }

    highlight();
  }, [content, language, theme]);

  if (language === "markdown" || language === "md") {
    return (
      <div className={cn("p-6 md:p-8 markdown-body", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ _node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const lang = match ? match[1] : "";
              const codeString = String(children).replace(/\n$/, "");
              const hasNewlines = codeString.includes("\n");
              const isInline = !match && !hasNewlines;

              if (isInline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <CodeBlock language={lang} theme={theme}>
                  {codeString}
                </CodeBlock>
              );
            },
            pre({ children }) {
              return <>{children}</>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  if (highlightedCode) {
    const lines = content.split("\n");
    const overflowClassName = wordWrap ? "overflow-x-hidden" : "overflow-x-auto";
    const codeClassName = wordWrap
      ? "p-4 [&>pre]:whitespace-pre-wrap! [&>pre]:break-words! [&_code]:leading-6 [&_code]:whitespace-pre-wrap! [&_code]:break-words!"
      : "[&>pre]:bg-transparent! [&_code]:leading-6";
    return (
      <div className={overflowClassName}>
        <div className="flex font-mono text-sm">
          {displayLineNumbers && (
            <div className="text-right text-muted-foreground select-none pr-4 pl-4 py-2 border-r border-border bg-muted/30 shrink-0 wrap-normal">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <div className={cn("flex-1 min-w-0 pl-4 py-2 [&>pre]:bg-transparent!", codeClassName)} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </div>
      </div>
    );
  }

  const lines = content.split("\n");
  const plainContainerClassName = wordWrap ? "font-mono text-sm overflow-x-hidden" : "font-mono text-sm overflow-x-auto";
  const plainLineClassName = wordWrap ? "pl-4 py-0.5 whitespace-pre-wrap break-words" : "pl-4 py-0.5 whitespace-pre";

  return (
    <div className={plainContainerClassName}>
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {displayLineNumbers && (
                <td className="text-right text-muted-foreground select-none pr-4 pl-4 py-0.5 w-12 align-top border-r border-border">{i + 1}</td>
              )}
              <td className={plainLineClassName}>{line || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children, language, theme }: { children: string; language: string; theme: string | undefined }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function highlight() {
      try {
        const result = await codeToHtml(children, {
          lang: language || "text",
          theme: theme === "dark" ? "github-dark-default" : "github-light-default",
        });
        setHtml(result);
      } catch {
        setHtml(null);
      }
    }
    highlight();
  }, [children, language, theme]);

  const copyCode = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="code-block group relative my-4 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{language || "text"}</span>
        <button onClick={copyCode} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copied ? (
            <>
              <HugeiconsIcon icon={CheckmarkCircleIcon} strokeWidth={2} className="size-3.5 text-green-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        {html ? (
          <div className="p-4 text-sm [&>pre]:bg-transparent! [&>pre]:m-0! [&>pre]:p-0! [&_code]:leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="p-4 text-sm">
            <code>{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
