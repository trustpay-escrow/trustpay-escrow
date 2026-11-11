import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { supabase } from '../config/supabase.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../shared/utils/logger.js';
import { invalidateCache } from '../shared/middleware/cache.js';
import { createNotification } from '../modules/notifications/notification.service.js';
import { realtimeService } from './realtime.service.js';

export interface ParsedEvent {
  id: string;
  type: string;
  ledger: number;
  ledgerClosedAt?: string;
  contractId: string;
  txHash?: string;
  topics: string[];
  topicString: string;
  data: any;
}

export interface IndexerStats {
  totalEventsProcessed: number;
  lastLedgerProcessed: number;
  lastPollTimestamp: number | null;
  isRunning: boolean;
}

// In-memory LRU / deduplication caches for fast sub-second idempotency checks
const MAX_CACHE_SIZE = 10000;
const processedTxHashes = new Set<string>();
const processedEventIds = new Set<string>();

function addToDeduplicationCache(eventId: string, txHash?: string): void {
  if (processedEventIds.size >= MAX_CACHE_SIZE) {
    const firstItem = processedEventIds.values().next().value;
    if (firstItem) processedEventIds.delete(firstItem);
  }
  processedEventIds.add(eventId);

  if (txHash) {
    if (processedTxHashes.size >= MAX_CACHE_SIZE) {
      const firstTx = processedTxHashes.values().next().value;
      if (firstTx) processedTxHashes.delete(firstTx);
    }
    processedTxHashes.add(txHash);
  }
}

/**
 * Checks whether an event or transaction has already been indexed and processed.
 */
export async function isEventAlreadyProcessed(eventId: string, txHash?: string): Promise<boolean> {
  if (processedEventIds.has(eventId)) {
    return true;
  }
  if (txHash && processedTxHashes.has(txHash)) {
    return true;
  }

  // Fast-path: In test environment or when database is offline, rely on memory cache to prevent network timeouts
  if (env.nodeEnv === 'test' || !env.databaseUrl) {
    return false;
  }

  try {
    const existing = await Promise.race([
      prisma.processedEvent.findFirst({
        where: {
          OR: [
            { eventId },
            ...(txHash ? [{ txHash }] : []),
          ],
        },
        select: { id: true },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000)),
    ]);

    if (existing) {
      addToDeduplicationCache(eventId, txHash);
      return true;
    }
  } catch {
    // Database check fallback: if database is unreachable or times out, rely on memory
  }

  return false;
}

/**
 * Persists processed event record for auditability and ledger sync idempotency.
 */
export async function recordProcessedEvent(event: ParsedEvent): Promise<void> {
  addToDeduplicationCache(event.id, event.txHash);

  // Skip remote database write in test environment if database is offline
  if (env.nodeEnv === 'test' || !env.databaseUrl) {
    return;
  }

  try {
    await Promise.race([
      prisma.processedEvent.create({
        data: {
          eventId: event.id,
          txHash: event.txHash || null,
          contractId: event.contractId,
          topic: event.topicString,
          ledger: BigInt(event.ledger),
          ledgerClosedAt: event.ledgerClosedAt ? new Date(event.ledgerClosedAt) : null,
          dataJson: JSON.stringify(event.data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
          status: 'processed',
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000)),
    ]);
  } catch (err) {
    logger.debug?.('Could not insert processedEvent in database (ignoring if offline):', err);
  }
}

/**
 * Safely parses a raw event from Soroban RPC into a typed, native JavaScript structure.
 */
export function parseSorobanEvent(rawEvent: any): ParsedEvent | null {
  if (!rawEvent) return null;
  try {
    const contractIdStr =
      typeof rawEvent.contractId === 'string'
        ? rawEvent.contractId
        : rawEvent.contractId?.contractId?.() ||
          rawEvent.contractId?.toString?.() ||
          '';

    let topics: string[] = [];
    if (Array.isArray(rawEvent.topic)) {
      topics = rawEvent.topic.map((t: any) => {
        try {
          if (t instanceof xdr.ScVal) {
            const native = scValToNative(t as any);
            return typeof native === 'symbol' ? native.description || String(native) : String(native);
          }
          return String(t);
        } catch {
          return String(t);
        }
      });
    }

    let data: any = null;
    if (rawEvent.value) {
      try {
        if (rawEvent.value instanceof xdr.ScVal) {
          data = scValToNative(rawEvent.value as any);
        } else {
          data = rawEvent.value;
        }
      } catch {
        data = rawEvent.value;
      }
    }

    return {
      id: String(rawEvent.id || `${rawEvent.ledger || 0}-${Date.now()}`),
      type: String(rawEvent.type || 'contract'),
      ledger: Number(rawEvent.ledger || 0),
      ledgerClosedAt: rawEvent.ledgerClosedAt ? String(rawEvent.ledgerClosedAt) : undefined,
      contractId: contractIdStr,
      txHash: rawEvent.txHash ? String(rawEvent.txHash) : undefined,
      topics,
      topicString: topics.join('.'),
      data,
    };
  } catch (err: any) {
    logger.error('Error parsing raw Soroban event:', err);
    return null;
  }
}

/**
 * Synchronizes project and milestone states in Supabase/Prisma based on on-chain events.
 */
export async function syncEventToDatabase(event: ParsedEvent): Promise<boolean> {
  const { topicString, data, txHash, ledger } = event;

  logger.info(`[Indexer] Processing on-chain event '${topicString}' (tx: ${txHash || 'N/A'}, ledger: ${ledger})`);

  try {
    // 1. Milestone Approved (by client or timelock)
    if (topicString === 'milestone.approved' || topicString === 'milestone.auto_rel') {
      const isAutoRelease = topicString === 'milestone.auto_rel';
      const [rawProjectId, rawMilestoneIndex] = Array.isArray(data) ? data : [data, 0];
      const projectIdOnChain = Number(rawProjectId);
      const milestoneIndex = Number(rawMilestoneIndex);

      const { data: project } = await supabase
        .from('projects')
        .select('id, title, client_id, freelancer_id')
        .eq('project_id_onchain', projectIdOnChain)
        .maybeSingle();

      if (project) {
        const { data: updatedMilestone } = await supabase
          .from('milestones')
          .update({
            status: 'approved',
            auto_release_at: null,
          })
          .eq('project_id', project.id)
          .eq('milestone_index', milestoneIndex)
          .select('*')
          .maybeSingle();

        // Check if all milestones are now approved
        const { data: allMilestones } = await supabase
          .from('milestones')
          .select('status')
          .eq('project_id', project.id);

        const allApproved =
          allMilestones &&
          allMilestones.length > 0 &&
          allMilestones.every((m) => m.status === 'approved');

        if (allApproved) {
          await supabase
            .from('projects')
            .update({ status: 'completed' })
            .eq('id', project.id);
        }

        // Cache invalidation & notification
        await invalidateCache(['cache:/api/projects*']);

        // Real-time broadcast to project SSE stream
        try {
          realtimeService.broadcastToProject(project.id, 'onchain_event', {
            topic: topicString,
            milestoneIndex,
            status: 'approved',
            allApproved: !!allApproved,
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${project.id}:`, rtErr);
        }

        if (updatedMilestone && project.freelancer_id) {
          const { data: freelancer } = await supabase
            .from('users')
            .select('stellar_address')
            .eq('id', project.freelancer_id)
            .maybeSingle();

          if (freelancer?.stellar_address) {
            await createNotification({
              recipient_address: freelancer.stellar_address,
              project_id: project.id,
              type: 'milestone_approved',
              title: isAutoRelease ? 'Milestone Auto-Released! ⚡💰' : 'Milestone Approved! 💰',
              message: `Milestone #${milestoneIndex + 1} for '${project.title}' was approved on-chain and funds released.`,
              link: `/projects?id=${project.id}`,
            });
          }
        }
      }
      return true;
    }

    // 2. Milestone Submitted
    if (topicString === 'milestone.submitted') {
      const [rawProjectId, rawMilestoneIndex, rawSubmittedAt] = Array.isArray(data) ? data : [data, 0, 0];
      const projectIdOnChain = Number(rawProjectId);
      const milestoneIndex = Number(rawMilestoneIndex);
      const submittedAtUnix = Number(rawSubmittedAt || Math.floor(Date.now() / 1000));
      const submittedAtDate = new Date(submittedAtUnix * 1000);
      const autoReleaseDate = new Date((submittedAtUnix + 7 * 24 * 60 * 60) * 1000);

      const { data: project } = await supabase
        .from('projects')
        .select('id, title, client_id')
        .eq('project_id_onchain', projectIdOnChain)
        .maybeSingle();

      if (project) {
        await supabase
          .from('milestones')
          .update({
            status: 'submitted',
            submitted_at: submittedAtDate.toISOString(),
            auto_release_at: autoReleaseDate.toISOString(),
          })
          .eq('project_id', project.id)
          .eq('milestone_index', milestoneIndex);

        await invalidateCache(['cache:/api/projects*']);

        try {
          realtimeService.broadcastToProject(project.id, 'onchain_event', {
            topic: topicString,
            milestoneIndex,
            status: 'submitted',
            autoReleaseAt: autoReleaseDate.toISOString(),
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${project.id}:`, rtErr);
        }
      }
      return true;
    }

    // 3. Milestone Revision Requested
    if (topicString === 'milestone.revision') {
      const [rawProjectId, rawMilestoneIndex, rawRevisionsRemaining] = Array.isArray(data)
        ? data
        : [data, 0, 0];
      const projectIdOnChain = Number(rawProjectId);
      const milestoneIndex = Number(rawMilestoneIndex);
      const revisionsRemaining = Number(rawRevisionsRemaining);

      const { data: project } = await supabase
        .from('projects')
        .select('id, title')
        .eq('project_id_onchain', projectIdOnChain)
        .maybeSingle();

      if (project) {
        await supabase
          .from('milestones')
          .update({
            status: 'in_revision',
            revisions_remaining: revisionsRemaining,
            submitted_at: null,
            auto_release_at: null,
          })
          .eq('project_id', project.id)
          .eq('milestone_index', milestoneIndex);

        await invalidateCache(['cache:/api/projects*']);

        try {
          realtimeService.broadcastToProject(project.id, 'onchain_event', {
            topic: topicString,
            milestoneIndex,
            status: 'in_revision',
            revisionsRemaining,
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${project.id}:`, rtErr);
        }
      }
      return true;
    }

    // 4. Project Created / Initialized on-chain
    if (topicString === 'project.created') {
      const [rawProjectId, clientAddress] = Array.isArray(data) ? data : [data, ''];
      const projectIdOnChain = Number(rawProjectId);

      // Match project by client address where onchain id is not yet linked or matches
      if (clientAddress) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stellar_address', String(clientAddress))
          .maybeSingle();

        if (user) {
          const { data: matchedProject } = await supabase
            .from('projects')
            .select('id, project_id_onchain')
            .eq('client_id', user.id)
            .or(`project_id_onchain.is.null,project_id_onchain.eq.${projectIdOnChain}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (matchedProject && !matchedProject.project_id_onchain) {
            await supabase
              .from('projects')
              .update({
                project_id_onchain: projectIdOnChain,
                status: 'in_progress',
              })
              .eq('id', matchedProject.id);

            await invalidateCache(['cache:/api/projects*']);

            try {
              realtimeService.broadcastToProject(matchedProject.id, 'onchain_event', {
                topic: topicString,
                projectIdOnChain,
                status: 'in_progress',
                ledger: event.ledger,
              });
            } catch (rtErr) {
              logger.warn(`Failed to broadcast onchain event to project ${matchedProject.id}:`, rtErr);
            }
          }
        }
      }
      return true;
    }

    // 5. Freelancer Assigned on-chain (Option B award)
    if (topicString === 'project.assigned') {
      const [rawProjectId, freelancerAddress] = Array.isArray(data) ? data : [data, ''];
      const projectIdOnChain = Number(rawProjectId);

      const { data: freelancer } = await supabase
        .from('users')
        .select('id')
        .eq('stellar_address', String(freelancerAddress))
        .maybeSingle();

      if (freelancer) {
        const { data: updatedProject } = await supabase
          .from('projects')
          .update({
            freelancer_id: freelancer.id,
            status: 'in_progress',
          })
          .eq('project_id_onchain', projectIdOnChain)
          .select('id')
          .maybeSingle();

        await invalidateCache(['cache:/api/projects*']);

        if (updatedProject) {
          try {
            realtimeService.broadcastToProject(updatedProject.id, 'onchain_event', {
              topic: topicString,
              freelancerAddress,
              status: 'in_progress',
              ledger: event.ledger,
            });
          } catch (rtErr) {
            logger.warn(`Failed to broadcast onchain event to project ${updatedProject.id}:`, rtErr);
          }
        }
      }
      return true;
    }

    // 6. Project Cancelled / Refunded (Option B cancellation)
    if (topicString === 'project.cancelled') {
      const [rawProjectId] = Array.isArray(data) ? data : [data];
      const projectIdOnChain = Number(rawProjectId);

      const { data: updatedProject } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('project_id_onchain', projectIdOnChain)
        .select('id')
        .maybeSingle();

      await invalidateCache(['cache:/api/projects*']);

      if (updatedProject) {
        try {
          realtimeService.broadcastToProject(updatedProject.id, 'onchain_event', {
            topic: topicString,
            status: 'completed',
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${updatedProject.id}:`, rtErr);
        }
      }
      return true;
    }

    // 7. Project Disputed
    if (topicString === 'project.disputed') {
      const [rawProjectId] = Array.isArray(data) ? data : [data];
      const projectIdOnChain = Number(rawProjectId);

      const { data: updatedProject } = await supabase
        .from('projects')
        .update({ status: 'disputed' })
        .eq('project_id_onchain', projectIdOnChain)
        .select('id')
        .maybeSingle();

      await invalidateCache(['cache:/api/projects*']);

      if (updatedProject) {
        try {
          realtimeService.broadcastToProject(updatedProject.id, 'onchain_event', {
            topic: topicString,
            status: 'disputed',
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${updatedProject.id}:`, rtErr);
        }
      }
      return true;
    }

    // 8. Project Dispute Resolved
    if (topicString === 'project.resolved') {
      const [rawProjectId] = Array.isArray(data) ? data : [data];
      const projectIdOnChain = Number(rawProjectId);

      const { data: updatedProject } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('project_id_onchain', projectIdOnChain)
        .select('id')
        .maybeSingle();

      await invalidateCache(['cache:/api/projects*']);

      if (updatedProject) {
        try {
          realtimeService.broadcastToProject(updatedProject.id, 'onchain_event', {
            topic: topicString,
            status: 'completed',
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${updatedProject.id}:`, rtErr);
        }
      }
      return true;
    }

    // 9. Dispute Inactivity Timeout Resolved (14-day auto-refund)
    if (topicString === 'dispute.timeout') {
      const [rawProjectId] = Array.isArray(data) ? data : [data];
      const projectIdOnChain = Number(rawProjectId);

      const { data: updatedProject } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('project_id_onchain', projectIdOnChain)
        .select('id')
        .maybeSingle();

      await invalidateCache(['cache:/api/projects*']);

      if (updatedProject) {
        try {
          realtimeService.broadcastToProject(updatedProject.id, 'onchain_event', {
            topic: topicString,
            status: 'completed',
            ledger: event.ledger,
          });
        } catch (rtErr) {
          logger.warn(`Failed to broadcast onchain event to project ${updatedProject.id}:`, rtErr);
        }
      }
      return true;
    }

    return true;
  } catch (err: any) {
    logger.error(`Error syncing event '${topicString}' to database:`, err);
    return false;
  }
}

/**
 * Main Indexer Service Class
 */
export class SorobanIndexerService {
  private rpcServer: rpc.Server;
  private contractId: string;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private currentLedger: number = 0;
  private stats: IndexerStats = {
    totalEventsProcessed: 0,
    lastLedgerProcessed: 0,
    lastPollTimestamp: null,
    isRunning: false,
  };

  constructor(options?: {
    rpcUrl?: string;
    contractId?: string;
    pollIntervalMs?: number;
  }) {
    const rpcUrl = options?.rpcUrl || env.sorobanRpcUrl || 'https://soroban-testnet.stellar.org';
    this.rpcServer = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });
    this.contractId = options?.contractId || env.escrowContractId;
    this.pollIntervalMs = options?.pollIntervalMs || env.indexerPollIntervalMs || 5000;
  }

  public getStats(): IndexerStats {
    return { ...this.stats };
  }

  /**
   * Initializes the starting ledger sequence.
   */
  public async initStartingLedger(): Promise<number> {
    try {
      const latestLedgerInfo = await this.rpcServer.getLatestLedger();
      const latestSequence = Number(latestLedgerInfo.sequence || 0);

      // Start from the latest ledger minus a small buffer of 50 ledgers (~4 minutes)
      this.currentLedger = Math.max(1, latestSequence - 50);
      logger.info(
        `[Indexer] Initialized starting ledger to ${this.currentLedger} (latest ledger: ${latestSequence})`
      );
      return this.currentLedger;
    } catch (err: any) {
      logger.warn(`[Indexer] Could not query latest ledger from RPC, defaulting to 1: ${err.message}`);
      this.currentLedger = 1;
      return 1;
    }
  }

  /**
   * Executes a single polling cycle: fetches unindexed events and updates database.
   */
  public async pollEventsOnce(): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }

    this.isProcessing = true;
    this.stats.lastPollTimestamp = Date.now();
    let eventsCount = 0;

    try {
      if (this.currentLedger === 0) {
        await this.initStartingLedger();
      }

      const response = await this.rpcServer.getEvents({
        startLedger: this.currentLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contractId],
          },
        ],
        limit: 100,
      });

      const rawEvents = response.events || [];

      for (const raw of rawEvents) {
        const parsed = parseSorobanEvent(raw);
        if (!parsed) continue;

        // Idempotency: skip if event or transaction has already been processed
        const alreadyDone = await isEventAlreadyProcessed(parsed.id, parsed.txHash);
        if (alreadyDone) {
          logger.debug?.(`[Indexer] Skipping already processed event ${parsed.id}`);
          continue;
        }

        // Apply ledger-to-database state synchronization
        await syncEventToDatabase(parsed);

        // Record event idempotency log
        await recordProcessedEvent(parsed);

        eventsCount++;
        this.stats.totalEventsProcessed++;
        if (parsed.ledger > this.stats.lastLedgerProcessed) {
          this.stats.lastLedgerProcessed = parsed.ledger;
        }
      }

      // Advance cursor based on latest ledger reported by RPC
      if (response.latestLedger && response.latestLedger >= this.currentLedger) {
        this.currentLedger = response.latestLedger + 1;
      }
    } catch (err: any) {
      logger.warn(`[Indexer] Poll cycle warning (RPC may be busy or offline): ${err.message || err}`);
    } finally {
      this.isProcessing = false;
    }

    return eventsCount;
  }

  /**
   * Starts the continuous background polling loop.
   */
  public start(): void {
    if (this.timer) {
      return;
    }

    this.stats.isRunning = true;
    logger.info(
      `[Indexer] Starting Soroban RPC Event Indexer for contract '${this.contractId}' (polling every ${this.pollIntervalMs}ms)...`
    );

    // Initial immediate poll
    this.pollEventsOnce();

    // Recurring background loop
    this.timer = setInterval(async () => {
      await this.pollEventsOnce();
    }, this.pollIntervalMs);
  }

  /**
   * Stops the background indexer loop.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stats.isRunning = false;
    logger.info('[Indexer] Stopped Soroban RPC Event Indexer.');
  }
}

// Global default singleton instance
export const defaultIndexer = new SorobanIndexerService();

export function startIndexerWorker(): SorobanIndexerService {
  if (env.indexerEnabled) {
    defaultIndexer.start();
  } else {
    logger.info('[Indexer] Soroban Event Indexer is disabled via INDEXER_ENABLED=false.');
  }
  return defaultIndexer;
}

export function stopIndexerWorker(): void {
  defaultIndexer.stop();
}
