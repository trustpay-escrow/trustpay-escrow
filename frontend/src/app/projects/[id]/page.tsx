'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { Milestone, Project } from '@/types';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/projects/${projectId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch project details');
        }

        setProject(data.project);
      } catch (err: any) {
        toast.error(err.message || 'Could not load project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">Loading project overview...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
        <p className="text-slate-400 max-w-md mb-6">
          We couldn't find details for project ID <code className="text-indigo-400">{projectId}</code>. It might have been deleted or the link is invalid.
        </p>
        <Button onClick={() => router.push('/')} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      {/* Top Banner Gradient */}
      <div className="h-64 bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-44 relative z-10">
        {/* Navigation / Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          
          <div className="flex gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
              project.status === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              project.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
              project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {project.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  {project.category || 'General'}
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-widest">
                  {project.visibility} Escrow
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{project.title}</h1>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl flex items-center gap-6 min-w-[200px] justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Total Budget</span>
                <span className="text-2xl font-black text-indigo-400">{project.budget} {project.token || 'USDC'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Overview</h3>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
          </div>

          {project.deadline && (
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800/60 w-fit">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Target Deadline: <span className="text-slate-200 font-medium">{new Date(project.deadline).toLocaleDateString()}</span>
            </div>
          )}

          {/* Attached Files & Images Section */}
          {((project.attachments && project.attachments.length > 0) || (project.files && project.files.length > 0)) && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Project Files & Attachments
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {(project.files || project.attachments || []).map((file: any, fIdx: number) => {
                  const fileUrl = typeof file === 'string' ? file : (file.file_url || file.url || file.file_name || file.name);
                  const fileName = typeof file === 'string' ? file : (file.file_name || file.name || 'Attachment');
                  const isImage = typeof fileUrl === 'string' && (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || fileUrl.startsWith('data:image'));

                  if (isImage) {
                    return (
                      <div
                        key={fIdx}
                        onClick={() => setLightboxImage({ url: fileUrl, name: fileName })}
                        className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-slate-800 hover:border-indigo-500 transition-all shadow-md bg-slate-900"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl}
                          alt={fileName}
                          className="w-20 h-20 object-cover transform group-hover/img:scale-110 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          🔍 View
                        </div>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={fIdx}
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-800 font-mono flex items-center gap-2 transition-colors"
                    >
                      <span>📄</span>
                      <span className="truncate max-w-[200px]">{fileName}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Milestones Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Milestones
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                {project.milestones?.length || 0}
              </span>
            </h2>

            <Button
              onClick={() => router.push(`/projects/${project.id}/milestones/create`)}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl"
            >
              + Add Milestone
            </Button>
          </div>

          {!project.milestones || project.milestones.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium">No milestones created yet.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Add structured milestones to release escrow funds in stages.
              </p>
              <Button
                onClick={() => router.push(`/projects/${project.id}/milestones/create`)}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs px-5 py-2.5"
              >
                Create First Milestone
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {project.milestones
                .sort((a, b) => a.milestone_index - b.milestone_index)
                .map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <h3 className="text-lg font-bold text-white">{m.title}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          m.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          m.status === 'submitted' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          m.status === 'disputed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {m.status}
                        </span>

                        {m.status === 'submitted' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <span>⏳</span>
                            {(() => {
                              const autoReleaseTime = m.auto_release_at
                                ? new Date(m.auto_release_at).getTime()
                                : (m.submitted_at ? new Date(m.submitted_at).getTime() + 7 * 24 * 60 * 60 * 1000 : null);
                              
                              if (!autoReleaseTime) return 'Auto-releases in 7 days';
                              const diffMs = autoReleaseTime - Date.now();
                              if (diffMs <= 0) return 'Eligible for Auto-Release';
                              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              return `Auto-releases in ${days}d ${hours}h`;
                            })()}
                          </span>
                        )}
                      </div>

                      {m.description && (
                        <p className="text-sm text-slate-400 pl-10">{m.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 pl-10 pt-1 text-xs text-slate-500 font-medium">
                        {m.deliverable_type && (
                          <span>Deliverable: <strong className="text-slate-300">{m.deliverable_type}</strong></span>
                        )}
                        {m.revision_limit !== undefined && (
                          <span>Revisions: <strong className="text-slate-300">{m.revision_limit} max</strong></span>
                        )}
                        {m.due_date && (
                          <span>Due: <strong className="text-slate-300">{new Date(m.due_date).toLocaleDateString()}</strong></span>
                        )}
                        {m.submitted_at && (
                          <span>Submitted: <strong className="text-slate-300">{new Date(m.submitted_at).toLocaleDateString()}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-center border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
                      <span className="text-xs text-slate-500 font-medium">Milestone Escrow</span>
                      <span className="text-xl font-bold text-indigo-400">{m.amount} XLM</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          imageAlt={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
