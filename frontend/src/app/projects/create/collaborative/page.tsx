import { CollaborativeScopeBuilder } from '@/components/CollaborativeScopeBuilder';

export default async function CollaborativeScopePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; roomId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main-content" tabIndex={-1}>
      <CollaborativeScopeBuilder projectId={params.projectId} roomId={params.roomId} />
    </main>
  );
}
