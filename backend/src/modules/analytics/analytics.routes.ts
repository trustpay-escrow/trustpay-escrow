import { Router } from 'express';
import { logger } from '../../shared/utils/logger.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

type CapitalRow = { token: string; locked: number; contracts: number };
type SettlementRow = { date: string; token: string; volume: number; transactions: number; averageBudget: number };

router.get('/', async (_req, res) => {
  try {
    const [capital, settlements] = await prisma.$transaction([
      prisma.$queryRaw<CapitalRow[]>`
        WITH balances AS (
          SELECT p.id, UPPER(COALESCE(p.token, 'USDC')) AS token,
                 CASE WHEN COUNT(m.id) = 0 THEN p.budget
                      ELSE COALESCE(SUM(m.amount) FILTER (WHERE m.status IS DISTINCT FROM 'approved'), 0)
                 END AS locked
          FROM projects p
          LEFT JOIN milestones m ON m.project_id = p.id
          WHERE p.visibility = 'public' AND p.project_id_onchain IS NOT NULL AND p.status IN ('in_progress', 'disputed')
          GROUP BY p.id
        )
        SELECT token, SUM(locked)::float8 AS locked, COUNT(*)::int AS contracts
        FROM balances
        WHERE locked > 0
        GROUP BY token
        ORDER BY token
      `,
      prisma.$queryRaw<SettlementRow[]>`
        WITH releases AS (
          SELECT DISTINCT ON (m.id)
                 (e.ledger_closed_at AT TIME ZONE 'UTC')::date AS day,
                 UPPER(COALESCE(p.token, 'USDC')) AS token, m.amount, p.budget,
                 p.id AS project_id, COALESCE(e.tx_hash, e.event_id) AS transaction_id
          FROM processed_events e
          JOIN projects p ON COALESCE(p.contract_id, ${env.escrowContractId}) = e.contract_id
            AND p.project_id_onchain::text = (e.data_json::jsonb ->> 0)
          JOIN milestones m ON m.project_id = p.id
            AND m.milestone_index::text = (e.data_json::jsonb ->> 1)
          WHERE e.topic IN ('milestone.approved', 'milestone.auto_rel')
            AND e.ledger_closed_at IS NOT NULL
            AND p.visibility = 'public'
          ORDER BY m.id, e.ledger_closed_at, e.event_id
        ), daily_projects AS (
          SELECT day, token, AVG(budget) AS average_budget
          FROM (SELECT DISTINCT day, token, project_id, budget FROM releases) projects_per_day
          GROUP BY day, token
        )
        SELECT to_char(r.day, 'YYYY-MM-DD') AS date, r.token,
               SUM(r.amount)::float8 AS volume, COUNT(DISTINCT r.transaction_id)::int AS transactions,
               d.average_budget::float8 AS "averageBudget"
        FROM releases r JOIN daily_projects d USING (day, token)
        GROUP BY r.day, r.token, d.average_budget
        ORDER BY r.day, r.token
      `,
    ]);
    res.json({ capital, settlements });
  } catch (error) {
    logger.error('Could not load escrow analytics:', error);
    res.status(500).json({ error: 'Could not load escrow analytics.' });
  }
});

export default router;
