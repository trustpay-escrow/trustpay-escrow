import { Request, Response } from 'express';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { projectSchema } from '../../shared/utils/validators.js';

export const getProjects = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 6));
    const offset = (page - 1) * limit;
    const clientAddress = req.query.client_address as string;

    let query = supabase
      .from('projects')
      .select('*, client:client_id(stellar_address), freelancer:freelancer_id(stellar_address)', { count: 'exact' });

    if (clientAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stellar_address', clientAddress)
        .single();

      if (user && user.id) {
        query = query.eq('client_id', user.id);
      } else {
        return res.json({
          projects: [],
          pagination: {
            page,
            limit,
            totalProjects: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
    }

    const { data: projects, count, error: pError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (pError) {
      logger.error('Error fetching projects from Supabase:', pError);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    const projectIds = (projects || []).map((p) => p.id);

    let milestonesList: any[] = [];
    let filesList: any[] = [];
    let proposalsList: any[] = [];

    if (projectIds.length > 0) {
      const { data: milestones } = await supabase
        .from('milestones')
        .select('*')
        .in('project_id', projectIds);
      milestonesList = milestones || [];

      const { data: projectFiles } = await supabase
        .from('project_files')
        .select('*')
        .in('project_id', projectIds);
      filesList = projectFiles || [];

      const { data: proposals } = await supabase
        .from('proposals')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      proposalsList = proposals || [];
    }

    const enrichedProjects = (projects || []).map((proj) => {
      const projMilestones = milestonesList.filter((m) => m.project_id === proj.id);
      const projFiles = filesList.filter((f) => f.project_id === proj.id);
      const projProposals = proposalsList.filter((p) => p.project_id === proj.id);

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
        client_address: proj.client?.stellar_address || null,
        freelancer_address: proj.freelancer?.stellar_address || null,
        milestones: projMilestones,
        files: projFiles,
        attachments: projFiles.map((f) => f.file_url || f.file_name),
        proposals: projProposals,
        applicants: applicantsMapped,
      };
    });

    const totalProjects = count || 0;
    const totalPages = Math.ceil(totalProjects / limit) || 1;

    return res.json({
      projects: enrichedProjects,
      pagination: {
        page,
        limit,
        totalProjects,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err: any) {
    logger.error('Unexpected error fetching projects:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: Request, res: Response): Promise<any> => {
  try {
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

    const {
      title,
      description,
      category,
      custom_category,
      budget,
      deadline,
      visibility,
      client_address,
      freelancer_address,
      status,
      contract_id,
      project_id_onchain,
      token,
      token_address,
      yield_enabled,
      estimated_yield,
      blend_pool_address
    } = validationResult.data;

    let userId: string | null = null;
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('stellar_address', client_address)
      .single();

    if (userData && userData.id) {
      userId = userData.id;
    } else {
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

    let freelancerUserId: string | null = null;
    if (freelancer_address) {
      const { data: fUser } = await supabase
        .from('users')
        .select('id')
        .eq('stellar_address', freelancer_address)
        .maybeSingle();

      if (fUser?.id) {
        freelancerUserId = fUser.id;
      } else {
        const { data: newFUser } = await supabase
          .from('users')
          .insert([{ stellar_address: freelancer_address, role: 'freelancer' }])
          .select('id')
          .single();
        freelancerUserId = newFUser?.id || null;
      }
    }

    // 3. Insert into projects table
    const projectPayload: Record<string, any> = {
      title,
      description,
      category: category === 'Other' && custom_category ? custom_category : category,
      budget,
      deadline: deadline || null,
      visibility: visibility ? visibility.toLowerCase() : 'public',
      client_id: userId,
      status: status || (project_id_onchain !== undefined ? 'in_progress' : 'draft'),
      token: token || 'USDC',
      token_address: token_address || null,
    };

    if (freelancerUserId) projectPayload.freelancer_id = freelancerUserId;
    if (contract_id) projectPayload.contract_id = contract_id;
    if (project_id_onchain !== undefined) projectPayload.project_id_onchain = project_id_onchain;
    if (yield_enabled !== undefined) projectPayload.yield_enabled = yield_enabled;
    if (estimated_yield !== undefined && estimated_yield > 0) projectPayload.estimated_yield = estimated_yield;
    if (blend_pool_address) projectPayload.blend_pool_address = blend_pool_address;

    let newProject: any = null;
    let { data: insertedProject, error } = await supabase
      .from('projects')
      .insert([projectPayload])
      .select()
      .single();

    if (error && (error.message?.includes('schema cache') || error.message?.includes('column') || error.details?.includes('column'))) {
      logger.warn('Supabase DB missing optional columns, falling back to basic project insert:', error.message);
      delete projectPayload.yield_enabled;
      delete projectPayload.estimated_yield;
      delete projectPayload.blend_pool_address;
      delete projectPayload.token;
      delete projectPayload.token_address;
      delete projectPayload.contract_id;
      delete projectPayload.project_id_onchain;

      const fallbackResult = await supabase
        .from('projects')
        .insert([projectPayload])
        .select()
        .single();

      insertedProject = fallbackResult.data;
      error = fallbackResult.error;
    }

    newProject = insertedProject;

    if (error || !newProject) {
      logger.error('Error inserting project to Supabase:', error);
      return res.status(500).json({ error: 'Failed to create project', details: error });
    }

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
        client_address,
        freelancer_address: freelancer_address || null,
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

    const userIds = [project.client_id, project.freelancer_id, project.arbiter_id].filter(Boolean);
    let usersMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, stellar_address')
        .in('id', userIds);
      if (users) {
        for (const u of users) {
          usersMap[u.id] = u.stellar_address;
        }
      }
    }

    return res.json({
      project: {
        ...project,
        client_address: project.client_id ? usersMap[project.client_id] : null,
        freelancer_address: project.freelancer_id ? usersMap[project.freelancer_id] : null,
        arbiter_address: project.arbiter_id ? usersMap[project.arbiter_id] : null,
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

export const updateProject = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, contract_id, project_id_onchain, freelancer_address, arbiter_address } = req.body;

    const updatePayload: Record<string, any> = {};
    if (status) updatePayload.status = status;
    if (contract_id) updatePayload.contract_id = contract_id;
    if (project_id_onchain !== undefined) updatePayload.project_id_onchain = project_id_onchain;

    if (freelancer_address) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stellar_address', freelancer_address)
        .maybeSingle();

      if (user?.id) {
        updatePayload.freelancer_id = user.id;
      } else {
        const { data: newUser } = await supabase
          .from('users')
          .insert([{ stellar_address: freelancer_address, role: 'freelancer' }])
          .select('id')
          .single();
        if (newUser?.id) updatePayload.freelancer_id = newUser.id;
      }
    }

    if (arbiter_address) {
      const { data: arbiterUser } = await supabase
        .from('users')
        .select('id')
        .eq('stellar_address', arbiter_address)
        .maybeSingle();

      if (arbiterUser?.id) {
        updatePayload.arbiter_id = arbiterUser.id;
      }
    }

    const { data: updated, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error(`Error updating project ${id}:`, error);
      return res.status(500).json({ error: 'Failed to update project' });
    }

    return res.json({ message: 'Project updated successfully', project: updated });
  } catch (err: any) {
    logger.error('Unexpected error updating project:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
