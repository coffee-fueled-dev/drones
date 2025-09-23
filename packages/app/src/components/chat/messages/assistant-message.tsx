import { UIMessage } from "@convex-dev/agent/react";
import { TextPart } from "./message-parts/text";
import { ToolInvocationPart } from "./message-parts/tool-invocation";

export const AssistantMessage = ({ message }: { message: UIMessage }) => {
  return (
    <div className="flex justify-start flex-1 w-full">
      <div className="flex-1 flex items-start flex-col gap-4">
        {message.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <TextPart
                  key={index}
                  text={part.text}
                  startStreaming={message.status === "streaming"}
                />
              );

            case "tool-invocation":
              return (
                <ToolInvocationPart
                  key={index}
                  args={part.toolInvocation.args}
                  toolName={part.toolInvocation.toolName}
                  result={part.toolInvocation.result || ""}
                  state={part.toolInvocation.state}
                  toolCallId={part.toolInvocation.toolCallId}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};
