import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { ProjectBody } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { projectSchema } from '../utils/validators.js';

// Get all projects for a user
export const getProjects = async (req: Request, res: Response) => {
  // Placeholder for Supabase logic
  res.json({ message: 'List of projects' });
};

// Create a new project (draft)
export const createProject = async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Validate payload using Zod
    const validationResult = projectSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.format() 
      });
    }

    const { title, description, category, custom_category, budget, deadline, visibility, client_address } = validationResult.data;

    // 2. Lookup the user UUID using the stellar address
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('stellar_address', client_address)
      .single();

    if (userError || !userData) {
      logger.error('Error finding user by stellar address:', userError);
      return res.status(400).json({ error: 'Client address is not registered or invalid' });
    }

    // 3. Insert into projects using the UUID
    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          title,
          description,
          category: category === 'Other' && custom_category ? custom_category : category,
          budget,
          deadline,
          visibility: visibility.toLowerCase(),
          client_id: userData.id,
          status: 'draft',
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error('Error inserting project to Supabase:', error);
      return res.status(500).json({ error: 'Failed to create project', details: error });
    }

    return res.status(201).json({ message: 'Project created successfully', project: data });
  } catch (err: any) {
    logger.error('Unexpected error creating project:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific project
export const getProjectById = async (req: Request, res: Response) => {
  res.json({ message: `Project ${req.params.id}` });
};
