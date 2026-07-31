export interface Milestone {
  id: string;
  project_id?: string;
  milestone_index: number;
  title: string;
  description?: string;
  amount: number;
  status: 'pending' | 'submitted' | 'approved' | 'disputed';
  due_date?: string;
  revision_limit?: number;
  deliverable_type?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  category: string;
  budget: number;
  status: 'draft' | 'in_progress' | 'completed' | 'disputed' | 'open';
  deadline?: string;
  visibility?: string;
  client_id?: string;
  client_address?: string;
  freelancer_id?: string;
  arbiter_id?: string;
  created_at?: string;
  milestones?: Milestone[];
  applicants?: Applicant[];
  attachments?: string[];
  files?: any[];
}

export interface Applicant {
  id: string;
  project_id?: string;
  freelancer_id?: string;
  stellar_address?: string;
  freelancer_address?: string;
  name: string;
  pitch: string;
  cover_note?: string;
  portfolio_url?: string;
  status?: 'pending' | 'accepted' | 'denied' | 'granted' | 'rejected';
  granted?: boolean;
  created_at?: string;
}

export interface Proposal {
  id: string;
  project_id: string;
  project_title: string;
  stellar_address?: string;
  freelancer_address?: string;
  cover_note?: string;
  portfolio_url?: string;
  pitch: string;
  budget: number;
  status: 'pending' | 'accepted' | 'denied' | 'granted' | 'rejected';
  created_at: string;
}

export interface User {
  id: string;
  stellar_address: string;
  email?: string;
  role?: string;
  is_client: boolean;
  is_freelancer: boolean;
  created_at?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalProjects: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

