import { Request } from 'express';

export interface UserConnectBody {
  stellar_address: string;
  role: 'client' | 'freelancer';
  email?: string;
}

export interface UserConnectRequest extends Request {
  body: UserConnectBody;
}

export interface ProjectBody {
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string;
  visibility: string;
  attachments?: string[];
  client_address: string;
}
