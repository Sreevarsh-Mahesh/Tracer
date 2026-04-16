import { TracerLoginForm } from "@/components/tracer/TracerLoginForm";

export default async function TracerLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return <TracerLoginForm nextRoute={resolvedSearchParams.next ?? "/tracer"} />;
}
