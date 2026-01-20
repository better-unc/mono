import { getLanguage } from "@gitbruv/lib";
import { ScrollView, Text, View } from "react-native";
import { MonoText } from "./StyledText";

export { getLanguage };

interface CodeViewerProps {
  content: string;
  language: string;
  filename?: string;
}

const KEYWORDS_SET = new Set([
  "const",
  "let",
  "var",
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "export",
  "import",
  "from",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "this",
  "super",
  "extends",
  "implements",
  "static",
  "async",
  "await",
  "public",
  "private",
  "protected",
  "abstract",
  "readonly",
  "namespace",
  "module",
  "declare",
  "as",
  "of",
  "in",
  "typeof",
  "instanceof",
  "void",
  "null",
  "undefined",
  "true",
  "false",
  "boolean",
  "number",
  "string",
  "object",
  "any",
  "never",
]);

function tokenizeLine(line: string): Array<{ text: string; color: string }> {
  const tokens: Array<{ text: string; color: string }> = [];
  let i = 0;

  while (i < line.length) {
    if (line.substring(i).startsWith("//")) {
      tokens.push({ text: line.substring(i), color: "#6b7280" });
      break;
    }

    if (line.substring(i).startsWith("/*")) {
      const end = line.indexOf("*/", i);
      if (end !== -1) {
        tokens.push({ text: line.substring(i, end + 2), color: "#6b7280" });
        i = end + 2;
        continue;
      }
    }

    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === quote && line[j - 1] !== "\\") {
          tokens.push({ text: line.substring(i, j + 1), color: "#86efac" });
          i = j + 1;
          break;
        }
        j++;
      }
      if (j >= line.length) {
        tokens.push({ text: line.substring(i), color: "#86efac" });
        break;
      }
      continue;
    }

    if (/^\d/.test(line.substring(i))) {
      const match = line.substring(i).match(/^\d+\.?\d*/);
      if (match) {
        tokens.push({ text: match[0], color: "#fbbf24" });
        i += match[0].length;
        continue;
      }
    }

    const wordMatch = line.substring(i).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const color = KEYWORDS_SET.has(word) ? "#60a5fa" : "#e5e7eb";
      tokens.push({ text: word, color });
      i += word.length;
      continue;
    }

    tokens.push({ text: line[i], color: "#e5e7eb" });
    i++;
  }

  return tokens;
}

function highlightCode(content: string, language: string): React.ReactElement[] {
  if (language === "markdown" || language === "md" || language === "plaintext") {
    return [
      <MonoText key="text" className="text-white/90 text-xs leading-5" style={{ fontFamily: "GeistMono" }}>
        {content}
      </MonoText>,
    ];
  }

  const lines = content.split("\n");
  return lines.map((line, lineIndex) => {
    const tokens = tokenizeLine(line);
    const lineElements = tokens.map((token, tokenIndex) => (
      <MonoText key={`token-${tokenIndex}`} style={{ fontFamily: "GeistMono", color: token.color, fontSize: 12 }}>
        {token.text}
      </MonoText>
    ));

    return (
      <View key={`line-${lineIndex}`} style={{ flexDirection: "row", flexWrap: "wrap", minHeight: 18 }}>
        {lineElements.length > 0 ? lineElements : <Text style={{ height: 18 }}> </Text>}
      </View>
    );
  });
}

export function CodeViewer({ content, language, filename }: CodeViewerProps) {
  const detectedLanguage = filename ? getLanguage(filename) : language;
  const highlightedElements = highlightCode(content.trim(), detectedLanguage);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ padding: 2 }} nestedScrollEnabled={true}>
      <View style={{ flexDirection: "column" }}>{highlightedElements}</View>
    </ScrollView>
  );
}
