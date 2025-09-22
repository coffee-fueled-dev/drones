import { handleAuth } from "@workos-inc/authkit-nextjs";
import { ROUTES } from "@/lib/routes";
import { env } from "@/lib/env";

export const GET = handleAuth({
  returnPathname: ROUTES.PROTECTED.WORKSPACE,
  // Force AuthKit to use the public domain rather than the server domain
  baseURL: env.NEXT_PUBLIC_APP_URL,
  onSuccess: async ({ user: { id: workosUserId }, accessToken }) => {
    // await createActorIfNotExists(workosUserId, accessToken);
  },
});
