import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { projectSchema } from '../utils/validators.js';

// Get all projects with milestones & files
export const getProjects = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: projects, error: pError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (pError) {
      logger.error('Error fetching projects from Supabase:', pError);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    // Fetch milestones for all projects
    const { data: milestones } = await supabase
      .from('milestones')
      .select('*');

    // Fetch project files for all projects
    const { data: projectFiles } = await supabase
      .from('project_files')
      .select('*');

    // Fetch proposals for all projects
    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    const milestonesList = milestones || [];
    const filesList = projectFiles || [];
    const proposalsList = proposals || [];

    const enrichedProjects = (projects || []).map((proj) => {
      const projMilestones = milestonesList.filter((m) => m.project_id === proj.id);
      const projFiles = filesList.filter((f) => f.project_id === proj.id);
      const projProposals = proposalsList.filter((p) => p.project_id === proj.id);

      // Map proposals to applicants format for UI compatibility
      const applicantsMapped = projProposals.map((p) => ({
        id: p.id,
        project_id: p.project_id,
        stellar_address: p.freelancer_address,
        freelancer_address: p.freelancer_address,
        name: `${p.freelancer_address.substring(0, 6)}...${p.freelancer_address.substring(p.freelancer_address.length - 4)}`,
        pitch: p.cover_note,
        cover_note: p.cover_note,
        portfolio_url: p.portfolio_url,
        status: p.status,
        created_at: p.created_at,
        granted: p.status === 'accepted',
      }));

      return {
        ...proj,
        milestones: projMilestones,
        files: projFiles,
        attachments: projFiles.map((f) => f.file_url || f.file_name),
        proposals: projProposals,
        applicants: applicantsMapped,
      };
    });

    return res.json({ projects: enrichedProjects });
  } catch (err: any) {
    logger.error('Unexpected error fetching projects:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new project (draft) with milestones & files
export const createProject = async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Validate payload using Zod
    const validationResult = projectSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map(i => `${i.path.join('.') || 'field'}: ${i.message}`)
        .join(' | ');
      logger.warn(`Project creation validation failed: ${errorMessages}`);
      return res.status(400).json({ 
        error: `Validation failed: ${errorMessages}`, 
        details: validationResult.error.issues 
      });
    }

    const { title, description, category, custom_category, budget, deadline, visibility, client_address } = validationResult.data;

    // 2. Lookup or auto-create the user UUID using the stellar address
    let userId: string | null = null;
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('stellar_address', client_address)
      .single();

    if (userData && userData.id) {
      userId = userData.id;
    } else {
      // Auto-upsert user for seamless project creation
      const { data: newUser } = await supabase
        .from('users')
        .insert([{ stellar_address: client_address, role: 'client' }])
        .select('id')
        .single();
      
      if (newUser) {
        userId = newUser.id;
      } else {
        const { data: fallbackUser } = await supabase.from('users').select('id').limit(1).single();
        userId = fallbackUser?.id || null;
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'Failed to resolve client user ID' });
    }

    // 3. Insert into projects table
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert([
        {
          title,
          description,
          category: category === 'Other' && custom_category ? custom_category : category,
          budget,
          deadline: deadline || null,
          visibility: visibility ? visibility.toLowerCase() : 'public',
          client_id: userId,
          status: 'draft',
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error('Error inserting project to Supabase:', error);
      return res.status(500).json({ error: 'Failed to create project', details: error });
    }

    // 4. Insert Milestones if provided
    const milestones = req.body.milestones;
    if (Array.isArray(milestones) && milestones.length > 0 && newProject) {
      const milestonesToInsert = milestones.map((m: any, idx: number) => ({
        project_id: newProject.id,
        milestone_index: m.milestone_index ?? idx,
        title: m.title,
        description: m.description || '',
        amount: Number(m.amount) || 0,
        due_date: m.due_date || deadline || null,
        deliverable_type: m.deliverable_type || 'Deliverable',
        revision_limit: Number(m.revision_limit) || 0,
        status: 'pending'
      }));

      await supabase.from('milestones').insert(milestonesToInsert);
    }

    // 5. Insert Project Files / Attachments if provided
    const attachments = req.body.attachments;
    if (Array.isArray(attachments) && attachments.length > 0 && newProject) {
      const filesToInsert = attachments.map((fileItem: any) => {
        const isObj = typeof fileItem === 'object' && fileItem !== null;
        const fileName = isObj ? fileItem.name || fileItem.file_name : String(fileItem);
        const fileUrl = isObj ? fileItem.url || fileItem.file_url : String(fileItem);
        const fileType = isObj ? fileItem.type || fileItem.file_type : (fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? 'image' : 'file');
        const fileSize = isObj && fileItem.size ? Number(fileItem.size) : null;
        return {
          project_id: newProject.id,
          file_name: fileName,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
          uploaded_by: userId
        };
      });
      const { error: filesError } = await supabase.from('project_files').insert(filesToInsert);
      if (filesError) {
        logger.error('Error inserting project_files to Supabase:', filesError);
        return res.status(500).json({
          error: `Failed to attach project files: ${filesError.message || JSON.stringify(filesError)}`,
          details: filesError
        });
      }
    }

    // Re-fetch created project with milestones & files
    const { data: createdMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', newProject.id);

    const { data: createdFiles } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', newProject.id);

    return res.status(201).json({
      message: 'Project created successfully',
      project: {
        ...newProject,
        milestones: createdMilestones || [],
        files: createdFiles || [],
        attachments: (createdFiles || []).map((f) => f.file_url || f.file_name)
      }
    });
  } catch (err: any) {
    logger.error('Unexpected error creating project:', err);
    return res.status(500).json({
      error: err.message || 'Failed to create project',
      details: err.details || err.stack || err
    });
  }
};

// Get a specific project with milestones & files
export const getProjectById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      logger.error(`Project not found for id ${id}:`, projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    const { data: milestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id);

    const { data: projectFiles } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', id);

    return res.json({
      project: {
        ...project,
        milestones: milestones || [],
        files: projectFiles || [],
        attachments: (projectFiles || []).map((f) => f.file_url || f.file_name)
      }
    });
  } catch (err: any) {
    logger.error('Unexpected error fetching project:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
