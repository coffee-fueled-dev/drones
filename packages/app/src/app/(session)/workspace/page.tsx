import { withAuth } from "@workos-inc/authkit-nextjs";
import { ChatProvider } from "@/components/chat/chat-provider";
import { Chat } from "@/components/chat";
import { SignOutButton } from "@/components/sign-out-button";

export default async function WorkspacePage() {
  await withAuth();

  return (
    <div className="h-screen flex flex-col">
      {/* Header with sign out */}
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Drone Policy Workspace</h1>
        <SignOutButton />
      </header>

      {/* Main chat area */}
      <div className="flex-1">
        <ChatProvider chatContext="Welcome to the drone policy advisor. Ask questions about drone regulations and compliance requirements.">
          <Chat>
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Drone Policy Advisor</h1>
              <p className="text-muted-foreground mb-6">
                Ask questions about drone regulations, compliance requirements,
                and policy obligations.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Ask about FAA regulations</p>
                <p>• Get compliance guidance</p>
                <p>• Understand policy requirements</p>
              </div>
            </div>
          </Chat>
        </ChatProvider>
      </div>
    </div>
  );
}
