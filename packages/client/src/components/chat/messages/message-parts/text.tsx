import { CopyButton } from "@/components/copy-button";
import { useSmoothText } from "@convex-dev/agent/react";
import MarkdownPreview from "@uiw/react-markdown-preview";

export const TextPart = ({
  text,
  startStreaming,
}: {
  text: string;
  startStreaming: boolean;
}) => {
  const [visibleText] = useSmoothText(text, {
    startStreaming,
  });
  return (
    <div className="space-y-2">
      <div className="bg-secondary p-6 border rounded-lg">
        <MarkdownPreview
          style={{
            backgroundColor: "transparent",
            color: "inherit",
          }}
          source={visibleText}
        />
      </div>
      <CopyButton value={text} />
    </div>
  );
};
