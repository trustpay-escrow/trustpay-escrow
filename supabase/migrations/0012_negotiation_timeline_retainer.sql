-- Frontend feature persistence for #149, #150, #153, #154.

-- #154: Gantt chart start dates and dependency graph.
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb;

-- #153: structured revision checklist + annotated screenshots.
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS revision_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revision_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- #149: recurring retainer agreement metadata.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS retainer_config jsonb;

-- #150: two-way proposal negotiation.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS counter_offer jsonb,
  ADD COLUMN IF NOT EXISTS negotiation_status text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_proposals_negotiation_status
  ON public.proposals (negotiation_status);
