import { withAuth } from "@workos-inc/authkit-nextjs";
import { SignOutButton } from "@/components/sign-out-button";

export default async function WorkspacePage() {
  await withAuth();

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Drone Policy Workspace</h1>
        <SignOutButton />
      </header>

      <div className="flex-1">Chat here</div>
    </div>
  );
}
