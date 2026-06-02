import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // api/cron is excluded — it uses CRON_SECRET auth, not a user session,
    // so an external scheduler can call it.
    "/((?!login|signup|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
