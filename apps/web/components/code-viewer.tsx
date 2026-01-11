"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState, useCallback } from "react";
import { codeToHtml } from "shiki";
import { useTheme } from "tanstack-theme-kit";
import { Check, Copy } from "lucide-react";

export function CodeViewer({ content, language, showLineNumbers = false }: { content: string; language: string; showLineNumbers?: boolean }) {
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const { theme } = useTheme();

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
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }) {
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
    return (
      <div className="overflow-x-auto">
        <div className="flex font-mono text-sm">
          {showLineNumbers && (
            <div className="text-right text-muted-foreground select-none pr-4 pl-4 py-2 border-r border-border bg-muted/30 shrink-0">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <div
            className="flex-1 pl-4 py-2 [&>pre]:bg-transparent! [&>pre]:m-0! [&>pre]:p-0! [&_code]:leading-6"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </div>
      </div>
    );
  }

  const lines = content.split("\n");

  return (
    <div className="font-mono text-sm overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {showLineNumbers && (
                <td className="text-right text-muted-foreground select-none pr-4 pl-4 py-0.5 w-12 align-top border-r border-border">{i + 1}</td>
              )}
              <td className="pl-4 py-0.5 whitespace-pre">{line || " "}</td>
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
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        {html ? (
          <div
            className="p-4 text-sm [&>pre]:bg-transparent! [&>pre]:m-0! [&>pre]:p-0! [&_code]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-4 text-sm">
            <code>{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
