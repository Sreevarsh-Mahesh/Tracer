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

  return <TracerDashboard />;
}
