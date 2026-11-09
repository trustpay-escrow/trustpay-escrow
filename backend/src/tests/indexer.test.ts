import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSorobanEvent,
  syncEventToDatabase,
  isEventAlreadyProcessed,
  recordProcessedEvent,
  SorobanIndexerService,
} from '../services/indexer.service.js';
import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { supabase } from '../config/supabase.js';

vi.mock('../config/supabase.js', () => {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'mock-proj-uuid-1',
        title: 'Decentralized Escrow DApp',
        client_id: 'client-uuid-1',
        freelancer_id: 'freelancer-uuid-1',
        project_id_onchain: 1,
      },
      error: null,
    }),
  };

  return {
    supabase: {
      from: vi.fn(() => queryBuilder),
    },
  };
});

describe('Soroban RPC Event Indexer & Ledger-to-Database Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseSorobanEvent', () => {
    it('correctly parses raw milestone.approved contract event with ScVal topics & data', () => {
      const topic1 = nativeToScVal('milestone');
      const topic2 = nativeToScVal('approved');
      const dataVal = nativeToScVal([101n, 0]);

      const rawEvent = {
        id: '0000000001-0000000001',
        type: 'contract',
        ledger: 1234567,
        ledgerClosedAt: '2026-11-08T18:00:00Z',
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        topic: [topic1, topic2],
        value: dataVal,
      };

      const parsed = parseSorobanEvent(rawEvent);
      expect(parsed).not.toBeNull();
      if (parsed) {
        expect(parsed.topicString).toBe('milestone.approved');
        expect(parsed.contractId).toBe('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
        expect(parsed.ledger).toBe(1234567);
        expect(parsed.txHash).toBe('a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0');
        expect(Array.isArray(parsed.data)).toBe(true);
        expect(parsed.data[0]).toBe(101n);
        expect(Number(parsed.data[1])).toBe(0);
      }
    });

    it('correctly parses milestone.submitted event with submitted_at timestamp', () => {
      const topic1 = nativeToScVal('milestone');
      const topic2 = nativeToScVal('submitted');
      const submittedAtUnix = 1731000000n;
      const dataVal = nativeToScVal([101n, 1, submittedAtUnix]);

      const rawEvent = {
        id: '0000000001-0000000002',
        type: 'contract',
        ledger: 1234570,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
        topic: [topic1, topic2],
        value: dataVal,
      };

      const parsed = parseSorobanEvent(rawEvent);
      expect(parsed).not.toBeNull();
      if (parsed) {
        expect(parsed.topicString).toBe('milestone.submitted');
        expect(parsed.data[0]).toBe(101n);
        expect(Number(parsed.data[1])).toBe(1);
        expect(parsed.data[2]).toBe(1731000000n);
      }
    });

    it('safely handles empty or malformed events without throwing', () => {
      const parsedNull = parseSorobanEvent(null);
      expect(parsedNull).toBeNull();

      const parsedEmpty = parseSorobanEvent({});
      expect(parsedEmpty).not.toBeNull();
      if (parsedEmpty) {
        expect(parsedEmpty.topicString).toBe('');
      }
    });
  });

  describe('Idempotency & Deduplication Guard', () => {
    it('deduplicates events so duplicate transactions are never processed twice', async () => {
      const uniqueEventId = `evt-test-${Date.now()}`;
      const uniqueTxHash = `tx-hash-${Date.now()}`;

      const firstCheck = await isEventAlreadyProcessed(uniqueEventId, uniqueTxHash);
      expect(firstCheck).toBe(false);

      await recordProcessedEvent({
        id: uniqueEventId,
        type: 'contract',
        ledger: 12345,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: uniqueTxHash,
        topics: ['milestone', 'approved'],
        topicString: 'milestone.approved',
        data: [1, 0],
      });

      const secondCheckWithEventId = await isEventAlreadyProcessed(uniqueEventId, undefined);
      expect(secondCheckWithEventId).toBe(true);

      const secondCheckWithTxHash = await isEventAlreadyProcessed(`other-evt-${Date.now()}`, uniqueTxHash);
      expect(secondCheckWithTxHash).toBe(true);
    });
  });

  describe('syncEventToDatabase State Machine Updates', () => {
    it('processes milestone.approved event and updates database state', async () => {
      const event = {
        id: 'evt-approved-1',
        type: 'contract',
        ledger: 100,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: '0xmocktxapproved',
        topics: ['milestone', 'approved'],
        topicString: 'milestone.approved',
        data: [1, 0],
      };

      const success = await syncEventToDatabase(event);
      expect(success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(supabase.from).toHaveBeenCalledWith('milestones');
    });

    it('processes milestone.submitted event and calculates auto_release_at timelock', async () => {
      const event = {
        id: 'evt-submitted-1',
        type: 'contract',
        ledger: 101,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: '0xmocktxsubmitted',
        topics: ['milestone', 'submitted'],
        topicString: 'milestone.submitted',
        data: [1, 0, 1731000000],
      };

      const success = await syncEventToDatabase(event);
      expect(success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('milestones');
    });

    it('processes milestone.revision event and resets submitted timelock', async () => {
      const event = {
        id: 'evt-revision-1',
        type: 'contract',
        ledger: 102,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: '0xmocktxrevision',
        topics: ['milestone', 'revision'],
        topicString: 'milestone.revision',
        data: [1, 0, 1], // project 1, milestone 0, 1 revision remaining
      };

      const success = await syncEventToDatabase(event);
      expect(success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('milestones');
    });

    it('processes project.created event and links onchain project id', async () => {
      const event = {
        id: 'evt-created-1',
        type: 'contract',
        ledger: 103,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: '0xmocktxcreated',
        topics: ['project', 'created'],
        topicString: 'project.created',
        data: [2, 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGOF2W2GOGC25NC47WG', 1000],
      };

      const success = await syncEventToDatabase(event);
      expect(success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    it('processes project.assigned event and transitions project status', async () => {
      const event = {
        id: 'evt-assigned-1',
        type: 'contract',
        ledger: 104,
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        txHash: '0xmocktxassigned',
        topics: ['project', 'assigned'],
        topicString: 'project.assigned',
        data: [1, 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7'],
      };

      const success = await syncEventToDatabase(event);
      expect(success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('SorobanIndexerService Lifecycle', () => {
    it('initializes with default or custom configuration', () => {
      const service = new SorobanIndexerService({
        rpcUrl: 'https://soroban-testnet.stellar.org',
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        pollIntervalMs: 2000,
      });

      const stats = service.getStats();
      expect(stats.isRunning).toBe(false);
      expect(stats.totalEventsProcessed).toBe(0);
    });

    it('starts and stops background polling loop safely', () => {
      const service = new SorobanIndexerService({
        pollIntervalMs: 10000,
      });

      service.start();
      expect(service.getStats().isRunning).toBe(true);

      service.stop();
      expect(service.getStats().isRunning).toBe(false);
    });

    it('handles poll cycle gracefully when Soroban RPC is unreachable or throws', async () => {
      const service = new SorobanIndexerService({
        pollIntervalMs: 1000,
      });
      (service as any).currentLedger = 100;

      vi.spyOn((service as any).rpcServer, 'getEvents').mockRejectedValueOnce(
        new Error('Network connection refused')
      );

      // Does not throw an unhandled exception
      const count = await service.pollEventsOnce();
      expect(count).toBe(0);
    });
  });
});
