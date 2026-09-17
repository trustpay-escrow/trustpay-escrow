'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  project_id: string;
  sender_address: string;
  receiver_address: string;
  content: string;
  created_at: string;
}

interface ProjectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  senderAddress: string;
  receiverAddress: string;
  recipientRoleLabel?: string;
}

export function ProjectChatModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  senderAddress,
  receiverAddress,
  recipientRoleLabel = 'Counterparty',
}: ProjectChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newContent, setNewContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!projectId) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch (err) {
      // Quiet fail during interval poll
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchMessages();

    // Auto poll every 3 seconds while chat modal is open
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, projectId]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!newContent.trim()) return;
    if (!senderAddress || !receiverAddress) {
      toast.error('Wallet addresses missing for chat connection');
      return;
    }

    setSending(true);
    const tempText = newContent.trim();
    setNewContent('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_address: senderAddress,
          receiver_address: receiverAddress,
          content: tempText,
        }),
      });

      if (res.ok) {
        await fetchMessages();
      } else {
        toast.error('Failed to send message');
        setNewContent(tempText);
      }
    } catch (err) {
      toast.error('Error sending message');
      setNewContent(tempText);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const truncateAddr = (addr: string) =>
    addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-xl w-full flex flex-col h-[85vh] max-h-[650px] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#27272a] bg-[#1c1c20] flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Direct Contract Chat
              </span>
              <span className="text-xs text-[#71717a]">• {recipientRoleLabel}</span>
            </div>
            <h3 className="text-base font-bold text-white truncate max-w-sm sm:max-w-md">
              {projectTitle}
            </h3>
            <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1.5 font-mono">
              <span>To:</span>
              <span className="bg-[#232326] px-1.5 py-0.5 rounded border border-[#333338] text-[#e4e4e7]">
                {truncateAddr(receiverAddress)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#232326] hover:bg-[#27272a] border border-[#333338] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar bg-[#18181b]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs text-[#71717a] space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-[#1c1c20]/40 rounded-xl border border-[#27272a]">
              <span className="text-2xl mb-2">💬</span>
              <h4 className="text-sm font-bold text-white mb-1">Start the Conversation</h4>
              <p className="text-xs text-[#a1a1aa] max-w-xs leading-relaxed">
                Use this chat to align on deliverables, review project requirements, and share updates.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_address.toLowerCase() === senderAddress.toLowerCase();
              const timeStr = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center space-x-1.5 text-[10px] text-[#71717a] px-1">
                    <span>{isMe ? 'You' : recipientRoleLabel}</span>
                    <span>•</span>
                    <span>{timeStr}</span>
                  </div>

                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500/50'
                        : 'bg-[#232326] text-[#e4e4e7] rounded-tl-none border border-[#333338]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3.5 sm:p-4 bg-[#1c1c20] border-t border-[#27272a] flex items-center space-x-2.5">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={sending || !newContent.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <span>➔</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
