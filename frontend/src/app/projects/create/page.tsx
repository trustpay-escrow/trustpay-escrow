'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useCreateProjectForm } from '@/hooks/useCreateProjectForm';

export default function CreateProject() {
  const {
    formData,
    loading,
    errors,
    handleChange,
    handleFileUploadMock,
    handleSubmit
  } = useCreateProjectForm();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-8 py-10 sm:px-12 sm:py-12 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Create a New Project
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Set up your escrow project securely on the blockchain. Funds won't move until you're ready.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 sm:px-12 space-y-8">
            <div className="space-y-6">
              
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Project Title
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={formData.title}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.title ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                    placeholder="e.g. Build a decentralized voting app"
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <div className="mt-1">
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.description ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                    placeholder="Detail the scope of work..."
                  />
                  {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <div className="mt-1">
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className={`block w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.category ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                    >
                      <option>Development</option>
                      <option>Design</option>
                      <option>Writing</option>
                      <option>Marketing</option>
                      <option>Other</option>
                    </select>
                    {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}

                    {formData.category === 'Other' && (
                      <input
                        type="text"
                        name="custom_category"
                        value={formData.custom_category || ''}
                        onChange={handleChange}
                        placeholder="Please specify category..."
                        className={`mt-3 appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.custom_category ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                      />
                    )}
                    {formData.category === 'Other' && errors.custom_category && <p className="mt-1 text-sm text-red-500">{errors.custom_category}</p>}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Budget (XLM)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">XLM</span>
                    </div>
                    <input
                      type="number"
                      name="budget"
                      id="budget"
                      min="0"
                      step="0.01"
                      value={formData.budget === 0 ? '' : formData.budget}
                      onChange={handleChange}
                      className={`appearance-none block w-full pl-12 pr-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.budget ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.budget && <p className="mt-1 text-sm text-red-500">{errors.budget}</p>}
                </div>

                {/* Deadline */}
                <div>
                  <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Deadline
                  </label>
                  <div className="mt-1">
                    <input
                      type="date"
                      name="deadline"
                      id="deadline"
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.deadline}
                      onChange={handleChange}
                      className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.deadline ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                    />
                    {errors.deadline && <p className="mt-1 text-sm text-red-500">{errors.deadline}</p>}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Visibility
                  </label>
                  <div className="mt-1">
                    <select
                      id="visibility"
                      name="visibility"
                      value={formData.visibility}
                      onChange={handleChange}
                      className={`block w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-shadow duration-200 ${errors.visibility ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
                    >
                      <option>Public</option>
                      <option>Private</option>
                    </select>
                    {errors.visibility && <p className="mt-1 text-sm text-red-500">{errors.visibility}</p>}
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Attachments
                </label>
                <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors duration-200 cursor-pointer bg-gray-50 dark:bg-gray-700/50">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-transparent rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={handleFileUploadMock} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      PNG, JPG, PDF up to 10MB
                    </p>
                  </div>
                </div>
                {formData.attachments && formData.attachments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {formData.attachments.map((file, idx) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 py-1 px-2 rounded-md font-mono text-xs mr-2">{file}</span>
                        Attached
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => window.history.back()}
                  className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  {loading ? 'Creating...' : 'Create Draft Project'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
