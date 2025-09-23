import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  debug: process.env.NODE_ENV === "development",
  // Sign up paths - routes that should use the 'sign-up' screen hint
  signUpPaths: ["/sign-up"],
});

// Match against pages that require authentication
export const config = {
  matcher: [
    // Protect workspace routes
    "/workspace/:path*",
  ],
};
