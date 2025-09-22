import { ROUTES } from "@/lib/routes";
import {
  getSignInUrl,
  getSignUpUrl,
  withAuth,
} from "@workos-inc/authkit-nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { user } = await withAuth();

  if (user) {
    return redirect(ROUTES.PROTECTED.WORKSPACE);
  }

  const signInUrl = await getSignInUrl();
  const signUpUrl = await getSignUpUrl();

  return (
    <main className="min-h-dvh flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Drones AI</CardTitle>
          <CardDescription>
            Drones AI is a platform for managing your business.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild>
            <Link href={signInUrl}>Sign In</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={signUpUrl}>Sign Up</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
