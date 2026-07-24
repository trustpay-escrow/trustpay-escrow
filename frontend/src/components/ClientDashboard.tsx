'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

import { Milestone, Project, Applicant } from '@/types';
import { ImageLightboxModal } from './ImageLightboxModal';

export interface ClientDashboardProps {
  defaultTab?: 'projects' | 'create' | 'applicants';
}

export function ClientDashboard({ defaultTab = 'projects' }: ClientDashboardProps) {
  const router = useRouter();
  const { address } = useWalletStore();
  const [activeTab, setActiveTab] = useState<'projects' | 'create' | 'applicants'>(defaultTab);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  // Projects state initialized from backend
  const [projects, setProjects] = useState<Project[]>([]);

  // Selected project for Applicants view
  const [selectedProjectForApplicants, setSelectedProjectForApplicants] = useState<Project | null>(null);

  // Create Project Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Development');
  const [customCategory, setCustomCategory] = useState('');
  const [formProjectType, setFormProjectType] = useState('Fixed price');
  const [formBudget, setFormBudget] = useState<number | ''>('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formVisibility, setFormVisibility] = useState<'Public' | 'Invite-only'>('Public');
  const [formAttachments, setFormAttachments] = useState<string[]>([]);
  
  // Today's date string for restricting date pickers to current or future dates
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Milestones list for form (initialized as empty)
  const [formMilestones, setFormMilestones] = useState<Milestone[]>([]);

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState<number | ''>('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [newMilestoneRevisionLimit, setNewMilestoneRevisionLimit] = useState<number>(0);
  const [newMilestoneDeliverableType, setNewMilestoneDeliverableType] = useState('GitHub Repository');
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to fetch real projects from backend
  const fetchBackendProjects = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        if (data.projects && Array.isArray(data.projects)) {
          const mapped: Project[] = data.projects.map((p: any) => {
            const rawStatus = (p.status || 'draft').toLowerCase();
            let statusLabel: 'in_progress' | 'open' | 'completed' | 'draft' = 'open';
            if (rawStatus === 'in_progress' || rawStatus === 'in progress') statusLabel = 'in_progress';
            else if (rawStatus === 'completed') statusLabel = 'completed';
            else statusLabel = 'open';

            const msList: Milestone[] = (p.milestones || []).map((m: any, idx: number) => ({
              id: m.id || String(m.milestone_index),
              milestone_index: m.milestone_index ?? idx,
              title: m.title || `Milestone ${idx + 1}`,
              description: m.description,
              amount: Number(m.amount) || 0,
              status: m.status || 'pending',
              due_date: m.due_date,
              revision_limit: m.revision_limit ?? 0,
              deliverable_type: m.deliverable_type
            }));

            // Applicants if open
            const realApplicants: Applicant[] = p.applicants || [];

            return {
              id: p.id,
              title: p.title,
              description: p.description || '',
              subtitle: `${p.budget} USDC - ${msList.length > 0 ? `${msList.length} milestone(s)` : 'awaiting applicants'}`,
              status: statusLabel,
              category: p.category || 'Development',
              budget: Number(p.budget) || 0,
              deadline: p.deadline || '',
              visibility: p.visibility || 'public',
              milestones: msList,
              applicants: realApplicants,
              created_at: p.created_at
            };
          });

          setProjects(mapped);
          if (mapped.length > 0 && !selectedProjectForApplicants) {
            const projectWithApplicants = mapped.find(p => p.applicants && p.applicants.length > 0) || mapped[0];
            setSelectedProjectForApplicants(projectWithApplicants);
          }
        }
      }
    } catch (err: any) {
      toast.error('Could not fetch projects from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendProjects();
  }, []);

  // Add Milestone to Form
  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) {
      toast.error('Please enter a milestone title');
      return;
    }
    if (!newMilestoneAmount || Number(newMilestoneAmount) <= 0) {
      toast.error('Please enter a valid milestone amount');
      return;
    }

    const newItem: Milestone = {
      id: Date.now().toString(),
      milestone_index: formMilestones.length,
      title: newMilestoneTitle.trim(),
      description: newMilestoneDescription.trim() || undefined,
      amount: Number(newMilestoneAmount),
      status: 'pending',
      due_date: newMilestoneDueDate || undefined,
      revision_limit: Number(newMilestoneRevisionLimit) || 0,
      deliverable_type: newMilestoneDeliverableType || 'GitHub Repository'
    };

    setFormMilestones(prev => [...prev, newItem]);
    setNewMilestoneTitle('');
    setNewMilestoneDescription('');
    setNewMilestoneAmount('');
    setNewMilestoneDueDate('');
    setNewMilestoneRevisionLimit(0);
    setNewMilestoneDeliverableType('GitHub Repository');
    setShowAddMilestoneModal(false);
    toast.success('Milestone added!');
  };

  // Remove Milestone
  const handleRemoveMilestone = (id: string) => {
    setFormMilestones(prev => prev.filter(m => m.id !== id));
    toast.info('Milestone removed');
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const names = Array.from(e.target.files).map(f => f.name);
      setFormAttachments(prev => [...prev, ...names]);
      toast.success(`${names.length} file(s) attached!`);
    }
  };

  // Submit Project Form to Backend
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    if (!formBudget || Number(formBudget) <= 0) {
      toast.error('Please enter a valid project budget');
      return;
    }

    if (!address) {
      toast.error('Please connect your Freighter wallet first');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const clientAddr = address;

      const finalCategory = formCategory === 'Other' 
        ? (customCategory.trim() || 'Other')
        : (formCategory === 'Web development' ? 'Development' : formCategory);

      const body = {
        title: formTitle,
        description: formDescription,
        category: finalCategory,
        budget: Number(formBudget),
        deadline: formDeadline || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        visibility: formVisibility,
        client_address: clientAddr,
        milestones: formMilestones
      };

      const res = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        let errorMsg = data.error || data.message || 'Failed to save project';
        if (data.details && Array.isArray(data.details)) {
          const detailMsgs = data.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(' | ');
          errorMsg = `Validation failed: ${detailMsgs}`;
        }
        toast.error(errorMsg, { duration: 6000 });
        setIsSubmitting(false);
        return;
      }

      toast.success('Project saved successfully to backend!');
      await fetchBackendProjects();
      setActiveTab('projects');
    } catch (err: any) {
      toast.error(err.message || 'Error saving project', { duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grant applicant handler
  const handleGrantApplicant = (applicant: Applicant) => {
    toast.success(`Project granted to ${applicant.name}! Escrow initialized on-chain.`, {
      duration: 4000
    });
    if (selectedProjectForApplicants) {
      setSelectedProjectForApplicants(prev => prev ? ({
        ...prev,
        applicants: prev.applicants?.map(a => a.id === applicant.id ? { ...a, granted: true } : a)
      }) : null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#121212] text-[#f4f4f5] font-sans p-4 sm:p-6 md:p-10 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Bar / Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-medium text-[#a1a1aa]">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#27272a] text-[#f4f4f5]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <span className="text-[#e4e4e7] font-semibold">Client</span>
            <span>—</span>
            <span className="text-white capitalize">
              {activeTab === 'projects' && 'my projects'}
              {activeTab === 'create' && 'create project'}
              {activeTab === 'applicants' && 'applicants'}
            </span>
          </div>

          <div className="flex items-center space-x-1 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'projects'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              My Projects
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              Create Project
            </button>
            <button
              onClick={() => setActiveTab('applicants')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'applicants'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              Applicants ({selectedProjectForApplicants?.applicants?.length || 0})
            </button>
          </div>
        </div>

        {/* VIEW 1: MY PROJECTS */}
        {activeTab === 'projects' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </h2>
              <button
                onClick={() => setActiveTab('create')}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-transparent hover:bg-[#27272a] text-white font-medium text-sm rounded-xl border border-[#3f3f46] transition-all hover:border-[#52525b] shadow-sm active:scale-95"
              >
                <span className="text-lg leading-none">+</span>
                <span>Create project</span>
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa]">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs">Loading real projects from database...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12 bg-[#1c1c20]/50 border border-[#27272a] rounded-xl">
                <p className="text-[#a1a1aa] text-sm mb-4">No projects created yet in the database.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-[#27272a] text-white font-semibold text-xs rounded-xl border border-[#3f3f46]"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      if (proj.applicants && proj.applicants.length > 0) {
                        setSelectedProjectForApplicants(proj);
                        setActiveTab('applicants');
                      } else {
                        router.push(`/projects/${proj.id}`);
                      }
                    }}
                    className="group bg-[#1c1c20]/80 hover:bg-[#222227] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-200"
                  >
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                        {proj.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#a1a1aa]">
                        {proj.subtitle}
                      </p>

                      {/* Attached Files & Image Thumbnails */}
                      {((proj.attachments && proj.attachments.length > 0) || (proj.files && proj.files.length > 0)) && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          {(proj.files || proj.attachments || []).map((file: any, fIdx: number) => {
                            const fileUrl = typeof file === 'string' ? file : (file.file_url || file.file_name);
                            const fileName = typeof file === 'string' ? file : (file.file_name || 'Attachment');
                            const isImage = typeof fileUrl === 'string' && (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || fileUrl.startsWith('data:image'));

                            if (isImage) {
                              return (
                                <div
                                  key={fIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({ url: fileUrl, name: fileName });
                                  }}
                                  className="relative group/img cursor-pointer overflow-hidden rounded-lg border border-[#333338] hover:border-blue-500 transition-all shadow-sm"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={fileUrl}
                                    alt={fileName}
                                    className="w-12 h-12 object-cover transform group-hover/img:scale-110 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                                    🔍 Zoom
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <span key={fIdx} className="text-[11px] bg-[#232326] text-[#e4e4e7] px-2 py-0.5 rounded border border-[#333338] font-mono">
                                📄 {fileName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="self-start sm:self-center">
                      {(proj.status === 'in_progress' || (proj.status as string) === 'In progress') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#052e16] text-[#22c55e] border border-[#14532d]">
                          In progress
                        </span>
                      )}
                      {(proj.status === 'open' || proj.status === 'draft' || (proj.status as string) === 'Open') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#451a03] text-[#f97316] border border-[#78350f]">
                          Open
                        </span>
                      )}
                      {(proj.status === 'completed' || (proj.status as string) === 'Completed') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CREATE PROJECT */}
        {activeTab === 'create' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-300">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-6">
              Create project
            </h2>

            <form onSubmit={handleSaveProject} className="space-y-5">
              {/* Project Title */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Project title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Landing page redesign"
                  className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Scope, requirements, and expectations"
                  className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Grid: Category & Project Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full appearance-none px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="Development">Development</option>
                      <option value="Web development">Web development</option>
                      <option value="Mobile app">Mobile app</option>
                      <option value="Design">Design</option>
                      <option value="Writing">Writing</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#a1a1aa]">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>

                  {formCategory === 'Other' && (
                    <div className="pt-1.5 animate-fadeIn">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Please specify category (e.g. Smart Contracts, Audit)..."
                        className="w-full px-4 py-2.5 bg-[#232326] border border-blue-500/50 rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500 font-medium"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Project type
                  </label>
                  <div className="relative">
                    <select
                      value={formProjectType}
                      onChange={(e) => setFormProjectType(e.target.value)}
                      className="w-full appearance-none px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="Fixed price">Fixed price</option>
                      <option value="Milestone-based">Milestone-based</option>
                      <option value="Hourly rate">Hourly rate</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#a1a1aa]">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Total Budget & Overall Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Total budget (USDC)
                  </label>
                  <input
                    type="number"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="900"
                    className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Overall deadline
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      min={todayStr}
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Visibility Radio Buttons */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Visibility
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="Public"
                      checked={formVisibility === 'Public'}
                      onChange={() => setFormVisibility('Public')}
                      className="w-4 h-4 text-blue-600 bg-[#232326] border-[#3f3f46] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-white">Public</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="Invite-only"
                      checked={formVisibility === 'Invite-only'}
                      onChange={() => setFormVisibility('Invite-only')}
                      className="w-4 h-4 text-blue-600 bg-[#232326] border-[#3f3f46] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-[#a1a1aa]">Invite-only</span>
                  </label>
                </div>
              </div>

              {/* Attachments Dropzone */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Attachments
                </label>
                <label className="relative border-2 border-dashed border-[#3f3f46] hover:border-[#52525b] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#1c1c20]/50 hover:bg-[#232326]/50">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-8 h-8 mb-2 flex items-center justify-center text-[#a1a1aa]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-[#a1a1aa]">
                    Drop files or click to upload
                  </span>
                </label>
                {formAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {formAttachments.map((f, idx) => (
                      <span key={idx} className="text-xs bg-[#27272a] text-[#e4e4e7] px-2.5 py-1 rounded-md font-mono border border-[#3f3f46]">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Milestones Builder Section */}
              <div className="pt-4 border-t border-[#27272a] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Milestones ({formMilestones.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddMilestoneModal(true)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-transparent hover:bg-[#27272a] text-white font-semibold text-xs rounded-lg border border-[#3f3f46] transition-all"
                  >
                    <span>+ Add milestone</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formMilestones.length === 0 ? (
                    <div className="text-center py-6 bg-[#1c1c20]/50 border border-dashed border-[#333338] rounded-xl">
                      <p className="text-xs text-[#a1a1aa]">No milestones added yet. Click &quot;+ Add milestone&quot; to define project milestones.</p>
                    </div>
                  ) : (
                    formMilestones.map((m, idx) => (
                      <div
                        key={m.id}
                        className="bg-[#1c1c20] border border-[#27272a] rounded-xl p-4 space-y-2 group transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">
                              {m.title}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-extrabold text-[#22c55e]">
                              {m.amount} USDC
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMilestone(m.id)}
                              className="text-[#71717a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              title="Remove milestone"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {m.description && (
                          <p className="text-xs text-[#a1a1aa] line-clamp-2">
                            {m.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#71717a]">
                          {m.deliverable_type && (
                            <span className="bg-[#232326] px-2 py-0.5 rounded border border-[#333338] text-[#e4e4e7]">
                              📦 {m.deliverable_type}
                            </span>
                          )}
                          <span>• Revisions: {m.revision_limit ?? 0}</span>
                          {m.due_date && (
                            <span>• Due: {new Date(m.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Save Project Button */}
              <div className="pt-6 border-t border-[#27272a] flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Project...' : 'Save & Publish Escrow Project 🚀'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 3: APPLICANTS FOR SELECTED PROJECT */}
        {activeTab === 'applicants' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272a]">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Applicants
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                  Review proposals from freelancers and grant milestone escrows.
                </p>
              </div>

              {projects.length > 0 && (
                <select
                  value={selectedProjectForApplicants?.id || ''}
                  onChange={(e) => {
                    const p = projects.find(proj => proj.id === e.target.value);
                    if (p) setSelectedProjectForApplicants(p);
                  }}
                  className="px-3.5 py-2 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.applicants?.length || 0} applicants)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-4">
              {selectedProjectForApplicants?.applicants && selectedProjectForApplicants.applicants.length > 0 ? (
                selectedProjectForApplicants.applicants.map((applicant) => (
                  <div
                    key={applicant.id}
                    className="bg-[#1c1c20]/80 border border-[#27272a] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#3f3f46]"
                  >
                    <div className="space-y-2 max-w-xl">
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        {applicant.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed italic">
                        &quot;{applicant.pitch}&quot;
                      </p>
                    </div>

                    <div className="self-start sm:self-center">
                      <button
                        onClick={() => handleGrantApplicant(applicant)}
                        disabled={applicant.granted}
                        className={`inline-flex items-center space-x-1.5 px-4 py-2 font-bold text-xs sm:text-sm rounded-xl border transition-all ${
                          applicant.granted
                            ? 'bg-[#14532d] text-[#22c55e] border-[#15803d] cursor-default'
                            : 'bg-transparent hover:bg-[#27272a] text-white border-[#3f3f46] hover:border-[#52525b] active:scale-95'
                        }`}
                      >
                        <span>{applicant.granted ? 'Granted ✓' : 'Grant'}</span>
                        {!applicant.granted && <span className="text-sm font-normal">↗</span>}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-[#1c1c20]/40 rounded-xl border border-[#27272a]">
                  <p className="text-sm text-[#a1a1aa]">No applicants submitted yet for this project.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal for adding a new milestone with all backend fields */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181b] border border-[#3f3f46] rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <h3 className="text-lg font-bold text-white">Add New Milestone</h3>
              <button
                onClick={() => setShowAddMilestoneModal(false)}
                className="text-[#a1a1aa] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#e4e4e7]">
                  Milestone Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="e.g. Initial Design Drafts"
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#e4e4e7]">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newMilestoneDescription}
                  onChange={(e) => setNewMilestoneDescription(e.target.value)}
                  placeholder="Describe scope and deliverables for this milestone..."
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Amount (USDC) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={newMilestoneAmount}
                    onChange={(e) => setNewMilestoneAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="300"
                    className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Due Date
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={newMilestoneDueDate}
                    onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Deliverable Type
                  </label>
                  <select
                    value={newMilestoneDeliverableType}
                    onChange={(e) => setNewMilestoneDeliverableType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="GitHub Repository">GitHub Repository</option>
                    <option value="Figma Design Link">Figma Design Link</option>
                    <option value="PDF Document">PDF Document</option>
                    <option value="Design Asset">Design Asset</option>
                    <option value="Deployed Link">Deployed Link</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Revision Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMilestoneRevisionLimit}
                    onChange={(e) => setNewMilestoneRevisionLimit(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setShowAddMilestoneModal(false)}
                className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Add Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        imageUrl={lightboxImage?.url || null}
        imageAlt={lightboxImage?.name}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
