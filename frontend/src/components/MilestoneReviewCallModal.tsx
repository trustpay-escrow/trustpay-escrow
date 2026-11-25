'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  EncryptedSignalingTransport,
  computeConnectionQuality,
  getReviewCallRtcConfiguration,
  isIceCandidatePayload,
  isOfferPayload,
  readRtcStats,
  type ConnectionQuality,
  type RtcStatsSnapshot,
  type ReviewCallRole,
  type SignalingEnvelope,
} from '@/lib/webrtc-signaling';
import {
  beginReviewSession,
  finishReviewSession,
  formatReviewDuration,
  type ReviewSessionRecord,
} from '@/lib/review-sessions';

export interface MilestoneReviewCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  /** Connected wallet address; must be one of the project participants. */
  localAddress: string | null;
  /** Override the counterparty wallet. Defaults to the other project participant. */
  peerAddress?: string;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

const QUALITY_POLL_MS = 2_000;

function normalize(address?: string | null): string | undefined {
  return address ? address.trim().toUpperCase() : undefined;
}

function otherRole(role: ReviewCallRole): ReviewCallRole {
  return role === 'client' ? 'freelancer' : 'client';
}

function createStatsSnapshot(report: RTCStatsReport): RtcStatsSnapshot {
  return readRtcStats(report as unknown as { forEach?: (cb: (r: unknown) => void) => void });
}

export function MilestoneReviewCallModal({
  isOpen,
  onClose,
  project,
  localAddress,
  peerAddress,
}: MilestoneReviewCallModalProps) {
  const clientAddress = project.client_address || undefined;
  const freelancerAddress = project.freelancer_address || undefined;
  const normalizedLocal = normalize(localAddress);
  const normalizedClient = normalize(clientAddress);
  const normalizedFreelancer = normalize(freelancerAddress);

  const role: ReviewCallRole =
    normalizedLocal && normalizedFreelancer && normalizedLocal === normalizedFreelancer
      ? 'freelancer'
      : 'client';
  const resolvedPeer =
    peerAddress ||
    (role === 'freelancer' ? clientAddress : freelancerAddress) ||
    undefined;
  const isKnownParticipant = Boolean(
    normalizedLocal &&
      ((normalizedClient && normalizedLocal === normalizedClient) ||
        (normalizedFreelancer && normalizedLocal === normalizedFreelancer))
  );
  const participantsReady = Boolean(isKnownParticipant && resolvedPeer);

  const roomId = EncryptedSignalingTransport.roomIdForProject(project.id);

  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [quality, setQuality] = useState<ConnectionQuality | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastSession, setLastSession] = useState<ReviewSessionRecord | null>(null);
  const [peerJoined, setPeerJoined] = useState(false);

  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    onEscape: () => {
      if (status === 'connected') {
        void endCall();
      } else {
        onClose();
      }
    },
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const transportRef = useRef<EncryptedSignalingTransport | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const screenShareUsedRef = useRef(false);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStatsRef = useRef<RtcStatsSnapshot | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const isInitiator =
    Boolean(normalizedLocal && resolvedPeer) &&
    normalizedLocal! < normalize(resolvedPeer)!;

  const attachRemoteStream = useCallback((stream: MediaStream | null) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
  }, []);

  const stopTimers = useCallback(() => {
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    statsTimerRef.current = null;
    durationTimerRef.current = null;
  }, []);

  const recordSessionStart = useCallback(() => {
    if (sessionIdRef.current || !localAddress || !resolvedPeer) return;
    const startedAt = new Date();
    startedAtRef.current = startedAt.getTime();
    const session = beginReviewSession({
      projectId: project.id,
      roomId,
      startedAt,
      participants: [
        { address: localAddress, role },
        { address: resolvedPeer, role: otherRole(role) },
      ],
    });
    sessionIdRef.current = session.id;
    setLastSession(session);
  }, [localAddress, project.id, resolvedPeer, role, roomId]);

  const cleanup = useCallback(() => {
    stopTimers();
    transportRef.current?.close();
    transportRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    screenSenderRef.current = null;
    pendingIceRef.current = [];
    previousStatsRef.current = null;
  }, [stopTimers]);

  useEffect(() => {
    if (!isOpen) cleanup();
  }, [cleanup, isOpen]);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    const transport = transportRef.current;
    if (!pc || !transport) return;
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    await transport.send('offer', { type: 'offer', sdp: pc.localDescription?.sdp ?? offer.sdp });
  }, []);

  const handleSignalingMessage = useCallback(
    async (message: SignalingEnvelope) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (message.type === 'offer' && isOfferPayload(message.payload)) {
        await pc.setRemoteDescription({ type: 'offer', sdp: message.payload.sdp });
        for (const candidate of pendingIceRef.current.splice(0)) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await transportRef.current?.send('answer', {
          type: 'answer',
          sdp: pc.localDescription?.sdp ?? answer.sdp,
        });
        return;
      }

      if (message.type === 'answer' && isOfferPayload(message.payload)) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: message.payload.sdp });
          for (const candidate of pendingIceRef.current.splice(0)) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }
        }
        return;
      }

      if (message.type === 'ice-candidate' && isIceCandidatePayload(message.payload)) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(message.payload).catch(() => {});
        } else {
          pendingIceRef.current.push(message.payload);
        }
        return;
      }

      if (message.type === 'hangup') {
        await endCall(false);
      }
    },
    // endCall is declared below and stable through the ref it uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const startCall = async () => {
    if (!participantsReady) {
      setError(
        localAddress && !isKnownParticipant
          ? 'The connected wallet is not a participant in this escrow. Switch to the client or freelancer wallet.'
          : 'Connect the client or freelancer wallet for this project before starting the call.'
      );
      return;
    }
    if (typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'undefined') {
      setError('This browser does not support WebRTC calls.');
      return;
    }

    setError('');
    setLastSession(null);
    setElapsedMs(0);
    sessionIdRef.current = null;
    startedAtRef.current = null;
    screenShareUsedRef.current = false;
    setStatus('connecting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is unavailable in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      setMicEnabled(true);

      const pc = new RTCPeerConnection(getReviewCallRtcConfiguration());
      pcRef.current = pc;

      pc.ontrack = (event) => {
        const [incoming] = event.streams;
        attachRemoteStream(incoming ?? new MediaStream([event.track]));
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void transportRef.current?.send('ice-candidate', event.candidate.toJSON());
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('connected');
          recordSessionStart();
        } else if (pc.connectionState === 'failed') {
          setError('The peer connection failed. Check your network and try again.');
          setStatus('error');
        } else if (pc.connectionState === 'disconnected') {
          setPeerJoined(false);
        }
      };
      pc.onnegotiationneeded = () => {
        // Screen-share tracks trigger a renegotiation; only the initiator offers.
        if (isInitiator && pc.signalingState === 'stable') {
          void sendOffer();
        }
      };

      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      const transport = new EncryptedSignalingTransport({
        roomId,
        role,
        localAddress: localAddress as string,
        peerAddress: resolvedPeer,
        onPeerReady: () => {
          setPeerJoined(true);
          if (isInitiator) void sendOffer();
        },
        onMessage: (message) => void handleSignalingMessage(message),
        onError: (signalingError) => setError(signalingError.message),
      });
      transportRef.current = transport;
      await transport.connect();

      statsTimerRef.current = setInterval(async () => {
        const activePc = pcRef.current;
        if (!activePc) return;
        try {
          const snapshot = createStatsSnapshot(await activePc.getStats());
          setQuality(computeConnectionQuality(snapshot, previousStatsRef.current));
          previousStatsRef.current = snapshot;
        } catch {
          /* stats are best-effort */
        }
      }, QUALITY_POLL_MS);

      durationTimerRef.current = setInterval(() => {
        if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
      }, 1_000);
    } catch (err) {
      cleanup();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not start the review call.');
    }
  };

  async function endCall(notifyPeer: boolean = true) {
    if (notifyPeer) await transportRef.current?.send('hangup', {});
    if (sessionIdRef.current) {
      const ended = finishReviewSession(sessionIdRef.current, {
        hadScreenShare: screenShareUsedRef.current,
        durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : 0,
      });
      if (ended) setLastSession(ended);
    }
    sessionIdRef.current = null;
    cleanup();
    attachRemoteStream(null);
    setStatus('ended');
    setMicEnabled(true);
    setScreenSharing(false);
    setFullScreen(false);
    setPeerJoined(false);
  }

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicEnabled(next);
  };

  const stopScreenShare = () => {
    const pc = pcRef.current;
    const sender = screenSenderRef.current;
    if (pc && sender) {
      try {
        pc.removeTrack(sender);
      } catch {
        /* sender may already be detached */
      }
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    screenSenderRef.current = null;
    setLocalScreenStream(null);
    setScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }
    const pc = pcRef.current;
    if (!pc || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [track] = stream.getVideoTracks();
      if (!track) throw new Error('No screen track was captured.');
      const sender = pc.addTrack(track, stream);
      screenStreamRef.current = stream;
      screenSenderRef.current = sender;
      screenShareUsedRef.current = true;
      setLocalScreenStream(stream);
      setScreenSharing(true);
      track.onended = () => stopScreenShare();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screen sharing was cancelled.');
    }
  };

  const handleClose = async () => {
    if (status === 'connected' || status === 'connecting') {
      await endCall();
    }
    onClose();
  };

  if (!isOpen) return null;

  const micLabel = micEnabled ? 'Mute microphone' : 'Unmute microphone';

  const modal = (
    <div
      className={`fixed inset-0 z-[9999] flex justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6 ${
        fullScreen ? 'items-stretch' : 'items-center'
      }`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-call-title"
        tabIndex={-1}
        data-testid="milestone-review-call-modal"
        className={`relative flex max-h-[94vh] w-full flex-col overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-5 shadow-2xl sm:p-7 ${
          fullScreen ? 'max-w-none' : 'max-w-3xl'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 id="review-call-title" className="text-xl font-extrabold tracking-tight text-white">
              Milestone Live Review
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Encrypted peer-to-peer audio & screen sharing for <span className="font-semibold text-slate-200">{project.title}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="call-connection-status"
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                status === 'connected'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : status === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : status === 'connecting'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400'
              }`}
            >
              {status}
            </span>
            <button
              type="button"
              onClick={() => void handleClose()}
              aria-label="Close review call"
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Your wallet</p>
            <p data-testid="call-local-address" className="mt-1 break-all font-mono text-[11px] text-slate-200">
              {localAddress || 'Not connected'}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-indigo-300">{role}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Counterparty</p>
            <p data-testid="call-peer-address" className="mt-1 break-all font-mono text-[11px] text-slate-200">
              {resolvedPeer || 'Waiting for wallet'}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
              {peerJoined ? 'peer joined' : 'encrypted handshake pending'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Room</p>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-200" title={roomId}>
              {roomId}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">ECDH P-256 · AES-GCM</p>
          </div>
        </div>

        {error && (
          <p role="alert" data-testid="call-error" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        )}

        {!participantsReady && (
          <p data-testid="call-missing-wallet" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {localAddress && !isKnownParticipant
              ? 'The connected wallet is not a participant in this escrow. Switch to the client or freelancer wallet to join the review call.'
              : 'Both wallets must be assigned to this escrow before a review call can start. Connect the client or freelancer wallet, or assign a freelancer first.'}
          </p>
        )}

        <div
          data-testid="call-stage"
          className={`relative mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 ${
            fullScreen ? 'flex-1' : 'aspect-video'
          }`}
        >
          <video
            ref={remoteVideoRef}
            data-testid="call-remote-video"
            autoPlay
            playsInline
            className="h-full w-full bg-slate-950 object-contain"
          />
          <audio ref={remoteAudioRef} data-testid="call-remote-audio" autoPlay playsInline className="hidden" />

          {!remoteStream && status !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-4xl" aria-hidden="true">🎧</span>
              <p className="text-sm font-semibold text-white">Encrypted review room ready</p>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                Start the call to open a WebRTC connection between the escrow participants. Audio, SDP and ICE
                payloads are encrypted with an ephemeral ECDH key; screen sharing is peer-to-peer.
              </p>
              <button
                type="button"
                data-testid="start-review-call"
                onClick={() => void startCall()}
                disabled={!participantsReady || status === 'connecting'}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
              >
                {status === 'connecting' ? 'Connecting…' : 'Start encrypted call'}
              </button>
            </div>
          )}

          {screenSharing && localScreenStream && (
            <div className="absolute bottom-3 right-3 w-36 overflow-hidden rounded-xl border border-emerald-500/40 bg-black/80 shadow-xl">
              <video
                data-testid="screen-share-preview"
                autoPlay
                muted
                playsInline
                ref={(element) => {
                  if (element) element.srcObject = localScreenStream;
                }}
                className="h-auto w-full"
              />
              <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                Sharing screen
              </p>
            </div>
          )}
        </div>

        {status === 'connected' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="toggle-audio"
                aria-pressed={!micEnabled}
                aria-label={micLabel}
                onClick={toggleAudio}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  micEnabled
                    ? 'border-slate-700 bg-slate-800 text-slate-200 hover:text-white'
                    : 'border-red-500/40 bg-red-500/15 text-red-300'
                }`}
              >
                {micEnabled ? '🎙️ Mute' : '🔇 Unmute'}
              </button>
              <button
                type="button"
                data-testid="toggle-screen-share"
                aria-pressed={screenSharing}
                onClick={() => void toggleScreenShare()}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  screenSharing
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:text-white'
                }`}
              >
                {screenSharing ? '🛑 Stop sharing' : '🖥️ Share screen'}
              </button>
              <button
                type="button"
                data-testid="toggle-fullscreen"
                aria-pressed={fullScreen}
                onClick={() => setFullScreen((value) => !value)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors hover:text-white"
              >
                {fullScreen ? '🗗 Exit full screen' : '⛶ Full screen'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span data-testid="call-duration" className="font-mono text-xs text-slate-300">
                {formatReviewDuration(elapsedMs || (startedAtRef.current ? Date.now() - startedAtRef.current : 0))}
              </span>
              <button
                type="button"
                data-testid="end-review-call"
                onClick={() => void endCall()}
                className="rounded-xl border border-red-500/40 bg-red-600/90 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-red-500"
              >
                End call
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">RTT</p>
            <p data-testid="connection-rtt" className="mt-0.5 text-sm font-bold text-slate-100">
              {quality?.rttMs !== null && quality?.rttMs !== undefined ? `${quality.rttMs} ms` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Packet loss</p>
            <p data-testid="connection-packet-loss" className="mt-0.5 text-sm font-bold text-slate-100">
              {quality?.packetLossPercent !== null && quality?.packetLossPercent !== undefined
                ? `${quality.packetLossPercent.toFixed(1)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Bandwidth</p>
            <p data-testid="connection-bandwidth" className="mt-0.5 text-sm font-bold text-slate-100">
              {quality?.inboundKbps !== null && quality?.inboundKbps !== undefined
                ? `${Math.round(quality.inboundKbps)} kbps ↓`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Mic status</p>
            <p data-testid="mute-status" className="mt-0.5 text-sm font-bold text-slate-100">
              {micEnabled ? 'Unmuted' : 'Muted'}
            </p>
          </div>
        </div>

        {lastSession && status === 'ended' && (
          <div data-testid="review-session-summary" className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200">
            <p className="font-bold">Review session logged to the project audit trail.</p>
            <p className="mt-1">
              Duration {formatReviewDuration(lastSession.durationMs)} · {lastSession.participants.length} participants
              {lastSession.hadScreenShare ? ' · screen share used' : ''}
            </p>
          </div>
        )}

        {status === 'ended' && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white"
            >
              Close
            </button>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
          Session start, participants, screen-share usage and duration are written to the project audit log.
          Signaling is encrypted end-to-end between the two configured wallet identities.
        </p>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}

export default MilestoneReviewCallModal;
