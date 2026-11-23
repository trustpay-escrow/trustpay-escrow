import { CollaborativeScopeBuilder } from '@/components/CollaborativeScopeBuilder';

export default async function CollaborativeScopePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; roomId?: string }>;
}) {
  const params = await searchParams;
  return <CollaborativeScopeBuilder projectId={params.projectId} roomId={params.roomId} />;
}
