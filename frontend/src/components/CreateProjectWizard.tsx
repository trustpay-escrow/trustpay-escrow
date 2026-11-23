'use client';

import React, { useState } from 'react';
import { useCreateProjectForm } from '@/hooks/useCreateProjectForm';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { BalanceWarningBadge } from '@/components/BalanceWarningBadge';
import { useWalletStore } from '@/store/walletStore';
import { FiatOnRampModal } from '@/components/FiatOnRampModal';
import { PathPaymentSwapWidget } from '@/components/PathPaymentSwapWidget';

export function CreateProjectWizard() {
  const { address } = useWalletStore();
  const [showOnRamp, setShowOnRamp] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const {
    formData,
    loading,
    errors,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    draftSavedAt,
    clearDraft,
    handleChange,
    toggleYield,
    handleFileUploadMock,
    handleSubmit,
    walletBalance,
    balanceLoading,
    balanceShortfall,
    hasSufficientBalance,
    refreshBalance,
    handleFiatDepositDetected,
    handlePathSwapComplete,
  } = useCreateProjectForm();

  const steps = [
    { number: 1, title: 'Overview & Category', description: 'Title, scope & visibility' },
    { number: 2, title: 'Milestones & Deadlines', description: 'Budget & delivery timeline' },
    { number: 3, title: 'Token & Yield Selection', description: 'Stellar asset & Blend yield' },
    { number: 4, title: 'On-Chain Review & Deposit', description: 'Escrow summary & lock' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#121215] border border-[#27272a] rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
      {/* Top Bar with Auto-Save Badge & Draft Cleaner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-8 border-b border-[#27272a] gap-3">
        <div>
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            Escrow Wizard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Create Escrow Project
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
            4-step guided creation with smart contract validation and auto-save.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-center">
          {draftSavedAt && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Draft saved {draftSavedAt}</span>
            </div>
          )}
          <button
            type="button"
            onClick={clearDraft}
            className="text-[11px] text-[#71717a] hover:text-red-400 transition-colors underline"
          >
            Clear Draft
          </button>
        </div>
      </div>

      {/* Stepper Progress Indicator */}
      <div className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {steps.map((s) => {
            const isCompleted = currentStep > s.number;
            const isCurrent = currentStep === s.number;
            return (
              <div
                key={s.number}
                onClick={() => {
                  if (s.number < currentStep) {
                    setCurrentStep(s.number);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all duration-200 select-none ${
                  isCurrent
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500'
                    : isCompleted
                    ? 'bg-[#18181d] border-emerald-500/40 text-emerald-400 cursor-pointer hover:border-emerald-500'
                    : 'bg-[#141418] border-[#27272a] text-[#71717a]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold tracking-wider uppercase">
                    Step {s.number} of 4
                  </span>
                  {isCompleted ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center">
                      ✓
                    </span>
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  ) : null}
                </div>
                <div className="font-bold text-xs sm:text-sm text-white truncate">
                  {s.title}
                </div>
                <div className="text-[11px] text-[#a1a1aa] truncate mt-0.5">
                  {s.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content Steps */}
      <form onSubmit={(e) => e.preventDefault()}>
        {/* STEP 1: Overview & Category */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                Project Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Build Decentralized Stellar Escrow UI & Indexer"
                className={`w-full px-4 py-3 rounded-xl bg-[#18181c] border ${
                  errors.title ? 'border-red-500' : 'border-[#27272a]'
                } text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
              />
              {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                Detailed Description & Scope <span className="text-red-400">*</span>
              </label>
              <textarea
                name="description"
                rows={5}
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe deliverables, technical architecture, timeline expectations, and acceptance criteria in detail..."
                className={`w-full px-4 py-3 rounded-xl bg-[#18181c] border ${
                  errors.description ? 'border-red-500' : 'border-[#27272a]'
                } text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.description ? (
                  <p className="text-xs text-red-400">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-[11px] text-[#71717a]">
                  {formData.description.length}/2000 characters (min 20)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                  Project Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-[#18181c] border border-[#27272a] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Development">Development (Smart Contracts / Frontend)</option>
                  <option value="Design">UI/UX & Graphic Design</option>
                  <option value="Writing">Technical Writing & Research</option>
                  <option value="Marketing">Growth & Community Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                  Visibility
                </label>
                <select
                  name="visibility"
                  value={formData.visibility}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-[#18181c] border border-[#27272a] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Public">Public (Listed on TrustPay marketplace)</option>
                  <option value="Private">Private (Invite-only link)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                Mock Attachments & Specifications
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileUploadMock}
                className="w-full text-xs text-[#a1a1aa] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer"
              />
              {formData.attachments && formData.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.attachments.map((file: any, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-[#18181d] border border-[#333338] text-[11px] text-[#d4d4d8]"
                    >
                      📎 {file}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Milestones & Deadlines */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                  Total Budget Amount <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="budget"
                    min="1"
                    step="any"
                    value={formData.budget === 0 ? '' : formData.budget}
                    onChange={handleChange}
                    placeholder="e.g. 2500"
                    className={`w-full px-4 py-3 rounded-xl bg-[#18181c] border ${
                      errors.budget ? 'border-red-500' : 'border-[#27272a]'
                    } text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16`}
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-blue-400">
                    {formData.token}
                  </span>
                </div>
                {errors.budget && <p className="text-xs text-red-400 mt-1">{errors.budget}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-2">
                  Final Project Completion Deadline <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-xl bg-[#18181c] border ${
                    errors.deadline ? 'border-red-500' : 'border-[#27272a]'
                  } text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.deadline && <p className="text-xs text-red-400 mt-1">{errors.deadline}</p>}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/30 flex items-start space-x-3">
              <span className="text-xl">💡</span>
              <div className="text-xs text-[#a1a1aa] leading-relaxed">
                <span className="text-white font-bold block mb-1">
                  Milestone-Based Smart Contract Escrow
                </span>
                Upon project creation, you will define individual milestone release stages
                (e.g. Milestone 1: Prototype 30%, Milestone 2: Final Delivery 70%). Funds are safely
                held in Soroban contracts and disbursed when you approve deliverables.
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Token & Yield Selection */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider mb-3">
                Select Escrow Token
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.values(SUPPORTED_TOKENS).map((t) => {
                  const isSelected = formData.token === t.symbol;
                  return (
                    <div
                      key={t.symbol}
                      onClick={() =>
                        handleChange({
                          target: { name: 'token', value: t.symbol },
                        } as any)
                      }
                      className={`p-4 rounded-2xl border text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500'
                          : 'bg-[#18181c] border-[#27272a] hover:border-[#3f3f46]'
                      }`}
                    >
                      <div className="font-extrabold text-base text-white">{t.symbol}</div>
                      <div className="text-[11px] text-[#a1a1aa] mt-1">{t.name}</div>
                      {isSelected && (
                        <span className="inline-block mt-2 text-[10px] font-bold text-blue-400">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blend Yield Generation Feature */}
            <div className="p-5 rounded-2xl bg-[#18181d] border border-[#27272a] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base">⚡</span>
                    <h3 className="text-sm font-bold text-white">Blend Protocol Yield Accrual</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ~4.5% APY
                    </span>
                  </div>
                  <p className="text-xs text-[#a1a1aa] mt-1">
                    Supply 70% of locked escrow capital to the Stellar Blend liquidity pool while
                    awaiting milestone completion.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleYield(!formData.yield_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.yield_enabled ? 'bg-blue-600' : 'bg-[#27272a]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.yield_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formData.yield_enabled && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/30 flex items-center justify-between">
                  <div className="text-xs text-emerald-400">
                    <span className="font-bold">Estimated Yield During Project Duration:</span>
                  </div>
                  <div className="text-sm font-black text-emerald-300">
                    +${formData.estimated_yield} {formData.token}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: On-Chain Review & Deposit */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-[#18181d] border border-[#27272a] space-y-4">
              <h3 className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">
                Summary of Escrow Parameters
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[#71717a]">Project Title:</span>
                  <p className="font-bold text-white text-sm">{formData.title}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[#71717a]">Category / Visibility:</span>
                  <p className="font-bold text-white">
                    {formData.category} • {formData.visibility}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[#71717a]">Escrow Required Budget:</span>
                  <p className="font-bold text-blue-400 text-base">
                    {formData.budget.toLocaleString()} {formData.token}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[#71717a]">Target Completion:</span>
                  <p className="font-bold text-white">{formData.deadline || 'Flexible'}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-[#71717a]">Client Depositor Address:</span>
                  <p className="font-mono text-xs text-[#a1a1aa] truncate">
                    {address || 'Wallet not connected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Wallet Balance Verification */}
            <BalanceWarningBadge
              address={address}
              balance={walletBalance}
              isLoading={balanceLoading}
              budget={formData.budget}
              token={formData.token}
              onRefresh={refreshBalance}
            />

            {address && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnRamp(true)}
                  className="rounded-lg border border-[#27272a] px-3 py-2 text-xs font-semibold text-white hover:border-blue-500"
                >
                  Buy USDC with card or bank
                </button>
                {formData.token === 'USDC' && (
                  <button
                    type="button"
                    onClick={() => setShowSwap((v) => !v)}
                    aria-expanded={showSwap}
                    className="rounded-lg border border-[#27272a] px-3 py-2 text-xs font-semibold text-white hover:border-blue-500"
                  >
                    Pay with XLM or EURC
                  </button>
                )}
              </div>
            )}
            {showSwap && address && (
              <PathPaymentSwapWidget
                walletAddress={address}
                destinationToken={formData.token}
                requiredAmount={balanceShortfall > 0 ? balanceShortfall : formData.budget}
                onSwapComplete={handlePathSwapComplete}
              />
            )}
            <FiatOnRampModal
              isOpen={showOnRamp}
              onClose={() => setShowOnRamp(false)}
              walletAddress={address}
              suggestedAmount={balanceShortfall > 0 ? balanceShortfall : formData.budget}
              onDepositDetected={(result) => {
                setShowOnRamp(false);
                handleFiatDepositDetected(result);
              }}
            />

            {!address && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs">
                ⚠️ Please connect your Stellar wallet to deposit funds and initialize the contract.
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-[#27272a] flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-5 py-2.5 rounded-xl bg-[#18181c] hover:bg-[#27272a] border border-[#27272a] text-xs font-bold text-white transition-all"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-3">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-blue-600/20"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || !hasSufficientBalance || !address}
                onClick={() => handleSubmit()}
                className={`px-8 py-3 rounded-xl font-bold text-xs text-white transition-all shadow-xl ${
                  loading || !hasSufficientBalance || !address
                    ? 'bg-blue-600/40 cursor-not-allowed text-[#a1a1aa]'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25 hover:scale-[1.02]'
                }`}
              >
                {loading ? 'Initializing On-Chain Escrow...' : 'Confirm & Initialize Escrow 🚀'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreateProjectWizard;
