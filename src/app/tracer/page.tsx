import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TracerDashboard } from "@/components/tracer/TracerDashboard";

const AUTH_COOKIE = "tracer_demo_auth";

export default async function TracerPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get(AUTH_COOKIE)?.value === "authorized";

  if (!isAuthenticated) {
    redirect("/tracer/login?next=/tracer");
  }

  // NEXT_PUBLIC_* env vars are only inlined at build time by Next.js.
  // On Cloud Run, they are NOT available on the client at runtime.
  // Read the value here (server component) and pass it down as a prop.
  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "tracer-demo";

  return <TracerDashboard projectId={projectId} />;
}
