"use client";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { AuthKitProvider } from "@workos-inc/authkit-react";
import { env } from "@/lib/env";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider
      clientId={env.NEXT_PUBLIC_WORKOS_CLIENT_ID}
      redirectUri={env.NEXT_PUBLIC_WORKOS_REDIRECT_URI}
    >
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </AuthKitProvider>
  );
}
