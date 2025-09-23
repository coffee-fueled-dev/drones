import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function WorkspacePage() {
  await withAuth({ ensureSignedIn: true });

  return <div>Workspace</div>;
}
