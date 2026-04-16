import { TracerDashboard } from "@/components/tracer/TracerDashboard";

export default async function EmbeddedTracerPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const projectId = resolvedParams.projectId;

  if (!projectId || Array.isArray(projectId)) {
    return (
      <div style={{ padding: "40px", color: "white", fontFamily: "sans-serif" }}>
        <h2>Invalid Configuration</h2>
        <p>Missing or invalid projectId parameter.</p>
      </div>
    );
  }

  // Bypasses the cookie check. Relies on the frontend SDK to protect this route via a localized password.
  return <TracerDashboard projectId={projectId} />;
}
