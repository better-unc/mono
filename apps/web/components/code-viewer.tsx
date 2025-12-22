"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

export function CodeViewer({ content, language, showLineNumbers = false }: { content: string; language: string; showLineNumbers?: boolean }) {
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);

  useEffect(() => {
    if (language === "markdown" || language === "md") return;

    async function highlight() {
      try {
        const html = await codeToHtml(content, {
          lang: language === "text" ? "plaintext" : language,
          theme: "github-dark-default",
        });
        setHighlightedCode(html);
      } catch {
        setHighlightedCode(null);
      }
    }

    highlight();
  }, [content, language]);

  if (language === "markdown" || language === "md") {
    return (
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
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
            className="flex-1 pl-4 py-2 [&>pre]:!bg-transparent [&>pre]:!m-0 [&>pre]:!p-0 [&_code]:leading-6"
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
