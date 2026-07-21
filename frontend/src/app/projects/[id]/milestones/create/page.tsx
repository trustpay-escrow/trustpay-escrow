'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useMilestonesForm } from '@/hooks/useMilestonesForm';
import { useParams } from 'next/navigation';

export default function CreateMilestonesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const {
    milestones,
    loading,
    errors,
    handleMilestoneChange,
    addMilestone,
    removeMilestone,
    handleSubmit
  } = useMilestonesForm(projectId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-8 py-10 sm:px-12 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Define Project Milestones
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Break down your project into achievable milestones. Payments will be held in escrow and released upon completion of each milestone.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 sm:px-12 space-y-8">
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={index} className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-600 relative">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      Milestone {index + 1}
                    </h3>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Title */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Milestone Name</label>
                      <input
                        type="text"
                        name="title"
                        value={milestone.title}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        className={`w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow ${errors[index]?.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        placeholder="e.g. Initial Design Drafts"
                      />
                      {errors[index]?.title && <p className="mt-1 text-xs text-red-500">{errors[index].title}</p>}
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea
                        name="description"
                        rows={2}
                        value={milestone.description || ''}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow"
                        placeholder="Describe what needs to be delivered..."
                      />
                    </div>

                    {/* Amount & Due Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (XLM)</label>
                      <input
                        type="number"
                        name="amount"
                        min="0"
                        step="0.01"
                        value={milestone.amount || ''}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        className={`w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow ${errors[index]?.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      {errors[index]?.amount && <p className="mt-1 text-xs text-red-500">{errors[index].amount}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                      <input
                        type="date"
                        name="due_date"
                        min={new Date().toISOString().split('T')[0]}
                        value={milestone.due_date}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        className={`w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow ${errors[index]?.due_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      {errors[index]?.due_date && <p className="mt-1 text-xs text-red-500">{errors[index].due_date}</p>}
                    </div>

                    {/* Deliverable Type & Revision Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deliverable Type</label>
                      <input
                        type="text"
                        name="deliverable_type"
                        value={milestone.deliverable_type}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        placeholder="e.g. Source Code, PDF"
                        className={`w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow ${errors[index]?.deliverable_type ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      {errors[index]?.deliverable_type && <p className="mt-1 text-xs text-red-500">{errors[index].deliverable_type}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Revision Limit</label>
                      <input
                        type="number"
                        name="revision_limit"
                        min="0"
                        value={milestone.revision_limit}
                        onChange={(e) => handleMilestoneChange(index, e)}
                        className={`w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow ${errors[index]?.revision_limit ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      {errors[index]?.revision_limit && <p className="mt-1 text-xs text-red-500">{errors[index].revision_limit}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={addMilestone}
                className="px-6 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors w-full"
              >
                + Add Another Milestone
              </button>
            </div>

            <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-end space-x-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 transform hover:-translate-y-0.5 px-10"
                >
                  {loading ? 'Saving...' : 'Save Milestones'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
