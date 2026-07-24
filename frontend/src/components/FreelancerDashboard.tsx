'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

import { Milestone, Project, Proposal } from '@/types';
import { ImageLightboxModal } from './ImageLightboxModal';

export function FreelancerDashboard() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [activeTab, setActiveTab] = useState<'explore' | 'proposals' | 'jobs'>('explore');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  // Selected project for proposal modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [proposalPitch, setProposalPitch] = useState('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Search and Category filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Fetch real projects from backend
  const fetchBackendProjects = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        if (data.projects && Array.isArray(data.projects)) {
          const mapped: Project[] = data.projects.map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            category: p.category || 'Development',
            budget: Number(p.budget) || 0,
            deadline: p.deadline || '',
            client_address: p.client_id || 'GAUBK...NLSGV',
            status: p.status || 'open',
            milestones: (p.milestones || []).map((m: any) => ({
              id: m.id || String(m.milestone_index),
              title: m.title,
              amount: Number(m.amount) || 0
            }))
          }));

          setProjects(mapped);
        }
      }
    } catch (err) {
      toast.error('Could not load projects from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendProjects();
  }, []);

  // Filtered projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle Proposal Submission
  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalPitch.trim()) {
      toast.error('Please enter a proposal pitch');
      return;
    }

    if (!selectedProject) return;

    setIsSubmittingProposal(true);

    setTimeout(() => {
      const newProp: Proposal = {
        id: `prop-${Date.now()}`,
        project_id: selectedProject.id,
        project_title: selectedProject.title,
        pitch: proposalPitch,
        budget: selectedProject.budget,
        status: 'pending',
        created_at: new Date().toISOString().split('T')[0]
      };

      setProposals(prev => [newProp, ...prev]);

      // Mark project as applied
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, applicants: [...(p.applicants || []), { id: `app-${Date.now()}`, name: 'You', pitch: proposalPitch }] } : p));

      toast.success('Proposal submitted successfully to client!');
      setSelectedProject(null);
      setProposalPitch('');
      setIsSubmittingProposal(false);
      setActiveTab('proposals');
    }, 600);
  };

  return (
    <div className="w-full min-h-screen bg-[#121212] text-[#f4f4f5] font-sans p-4 sm:p-6 md:p-10 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Bar / Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-medium text-[#a1a1aa]">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1e1b4b] text-[#818cf8]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <span className="text-[#818cf8] font-bold">Freelancer</span>
            <span>—</span>
            <span className="text-white capitalize">
              {activeTab === 'explore' && 'explore projects'}
              {activeTab === 'proposals' && 'my proposals'}
              {activeTab === 'jobs' && 'active jobs'}
            </span>
          </div>

          <div className="flex items-center space-x-1 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'explore'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              Explore Projects
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'proposals'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              My Proposals ({proposals.length})
            </button>
          </div>
        </div>

        {/* VIEW 1: EXPLORE PROJECTS */}
        {activeTab === 'explore' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Available Projects
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                  Apply for open escrows and submit your milestones.
                </p>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3.5 py-1.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  <option value="Development">Development</option>
                  <option value="Design">Design</option>
                  <option value="Writing">Writing</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
            </div>

            {/* Project List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa]">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs">Fetching open projects...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12 bg-[#1c1c20]/50 border border-[#27272a] rounded-xl">
                <p className="text-[#a1a1aa] text-sm">No open projects found matching criteria.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#1c1c20]/80 border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-5 space-y-4 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md uppercase tracking-wider">
                            {proj.category}
                          </span>
                          {proj.deadline && (
                            <span className="text-xs text-[#71717a]">
                              Deadline: {new Date(proj.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white">
                          {proj.title}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-base font-extrabold text-[#22c55e]">
                          {proj.budget} USDC
                        </span>
                        <button
                          onClick={() => setSelectedProject(proj)}
                          className="px-4 py-2 text-xs font-bold rounded-xl border bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md active:scale-95 transition-all"
                        >
                          Apply Now ↗
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#a1a1aa] line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>

                    {/* Milestones list preview */}
                    {proj.milestones && proj.milestones.length > 0 && (
                      <div className="pt-3 border-t border-[#27272a]/60 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#71717a]">Milestones:</span>
                        {proj.milestones.map((m, idx) => (
                          <span
                            key={m.id}
                            className="text-[11px] bg-[#232326] text-[#e4e4e7] px-2.5 py-0.5 rounded-md border border-[#333338]"
                          >
                            {idx + 1}. {m.title} ({m.amount} USDC)
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Files & Image Attachments */}
                    {((proj.attachments && proj.attachments.length > 0) || (proj.files && proj.files.length > 0)) && (
                      <div className="pt-3 border-t border-[#27272a]/60 space-y-2">
                        <span className="text-[11px] font-semibold text-[#71717a] block">Project Files & Attachments:</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {(proj.files || proj.attachments || []).map((file: any, fIdx: number) => {
                            const fileUrl = typeof file === 'string' ? file : (file.file_url || file.file_name);
                            const fileName = typeof file === 'string' ? file : (file.file_name || 'File Attachment');
                            const isImage = typeof fileUrl === 'string' && (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || fileUrl.startsWith('data:image'));

                            if (isImage) {
                              return (
                                <div
                                  key={fIdx}
                                  onClick={() => setLightboxImage({ url: fileUrl, name: fileName })}
                                  className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-[#333338] hover:border-indigo-500 transition-all shadow-md"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={fileUrl}
                                    alt={fileName}
                                    className="w-16 h-16 object-cover transform group-hover/img:scale-110 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                    🔍 Zoom
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <a
                                key={fIdx}
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#232326] hover:bg-[#27272a] text-[#e4e4e7] text-xs rounded-xl border border-[#333338] transition-colors"
                              >
                                <span>📄</span>
                                <span className="truncate max-w-[140px]">{fileName}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: MY PROPOSALS */}
        {activeTab === 'proposals' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              My Submitted Proposals
            </h2>

            {proposals.length === 0 ? (
              <div className="text-center py-12 bg-[#1c1c20]/40 rounded-xl border border-[#27272a]">
                <p className="text-sm text-[#a1a1aa]">You haven&apos;t submitted any proposals yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {proposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="bg-[#1c1c20]/80 border border-[#27272a] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white">
                          {prop.project_title}
                        </h3>
                        <span className="text-xs text-[#71717a]">({prop.budget} USDC)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#a1a1aa] italic">
                        &quot;{prop.pitch}&quot;
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 self-start sm:self-center">
                      <span className="text-xs text-[#71717a]">{prop.created_at}</span>
                      {prop.status === 'pending' && (
                        <span className="px-3 py-1 bg-[#451a03] text-[#f97316] border border-[#78350f] text-xs font-semibold rounded-full">
                          Pending Review
                        </span>
                      )}
                      {prop.status === 'granted' && (
                        <span className="px-3 py-1 bg-[#052e16] text-[#22c55e] border border-[#14532d] text-xs font-semibold rounded-full">
                          Granted ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Proposal Submission Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <div>
                <h3 className="text-lg font-bold text-white">Submit Proposal</h3>
                <p className="text-xs text-[#a1a1aa] mt-0.5">{selectedProject.title} ({selectedProject.budget} USDC)</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-[#a1a1aa] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#e4e4e7]">
                  Your Proposal Pitch
                </label>
                <textarea
                  rows={4}
                  value={proposalPitch}
                  onChange={(e) => setProposalPitch(e.target.value)}
                  placeholder="Explain why you are the best fit for this project, relevant portfolio links, and estimated completion timeline..."
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 bg-transparent text-[#a1a1aa] hover:text-white text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProposal}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingProposal ? 'Submitting...' : 'Submit Proposal ↗'}
                </button>
              </div>
            </form>
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
