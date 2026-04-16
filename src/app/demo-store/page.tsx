import { DemoStoreClient } from "@/components/demo-store/DemoStoreClient";

export default async function DemoStorePage({
  searchParams
}: {
  searchParams: Promise<{ embedded?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return <DemoStoreClient embedded={resolvedSearchParams.embedded === "1"} />;
}
