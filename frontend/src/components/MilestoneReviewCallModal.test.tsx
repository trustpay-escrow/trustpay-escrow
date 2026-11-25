import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MilestoneReviewCallModal } from './MilestoneReviewCallModal';
import { loadReviewSessions } from '@/lib/review-sessions';
import type { Project } from '@/types';

vi.mock('@/lib/webrtc-signaling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/webrtc-signaling')>();
  class MockSignalingTransport {
    static roomIdForProject = actual.EncryptedSignalingTransport.roomIdForProject;
    connect = vi.fn().mockResolvedValue(undefined);
    send = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    isReady = true;
  }
  return { ...actual, EncryptedSignalingTransport: MockSignalingTransport };
});

class MockMediaStream {
  constructor(private readonly tracks: Array<Record<string, unknown>> = []) {}
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }
}

class MockPeerConnection {
  static instances: MockPeerConnection[] = [];

  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;

  addTrack = vi.fn((track: unknown) => ({ track }));
  removeTrack = vi.fn();
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0\r\n' });
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'v=0\r\n' });
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.localDescription = description;
  });
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description;
  });
  getStats = vi.fn().mockResolvedValue(new Map());
  close = vi.fn();

  constructor() {
    MockPeerConnection.instances.push(this);
  }
}

const audioTrack = { kind: 'audio', enabled: true, stop: vi.fn(), onended: null };
const screenTrack = { kind: 'video', enabled: true, stop: vi.fn(), onended: null as null | (() => void) };
const audioStream = new MockMediaStream([audioTrack]);
const screenStream = new MockMediaStream([screenTrack]);

const getUserMedia = vi.fn().mockResolvedValue(audioStream);
const getDisplayMedia = vi.fn().mockResolvedValue(screenStream);

const project: Project = {
  id: 'project-304',
  title: 'Design deliverable review',
  description: '',
  category: 'Design',
  budget: 1200,
  token: 'USDC',
  status: 'in_progress',
  client_address: 'GCLIENT',
  freelancer_address: 'GFREELANCER',
  milestones: [],
};

const CLIENT = 'GCLIENT';

async function renderConnectedCall() {
  render(<MilestoneReviewCallModal isOpen onClose={() => {}} project={project} localAddress={CLIENT} />);
  fireEvent.click(screen.getByTestId('start-review-call'));

  await waitFor(() => expect(MockPeerConnection.instances).toHaveLength(1));
  const pc = MockPeerConnection.instances[0];

  act(() => {
    pc.connectionState = 'connected';
    pc.onconnectionstatechange?.();
  });

  await waitFor(() => expect(screen.getByTestId('toggle-audio')).toBeInTheDocument());
  return pc;
}

describe('MilestoneReviewCallModal (#304)', () => {
  beforeEach(() => {
    MockPeerConnection.instances = [];
    audioTrack.enabled = true;
    audioTrack.stop.mockClear();
    screenTrack.stop.mockClear();
    getUserMedia.mockClear();
    getDisplayMedia.mockClear();
    localStorage.clear();

    vi.stubGlobal('RTCPeerConnection', MockPeerConnection);
    vi.stubGlobal('MediaStream', MockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, getDisplayMedia },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('starts an encrypted audio call between the escrow participants', async () => {
    const pc = await renderConnectedCall();

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ echoCancellation: true }), video: false })
    );
    expect(pc.addTrack).toHaveBeenCalledWith(audioTrack, audioStream);
    expect(screen.getByTestId('call-local-address')).toHaveTextContent(CLIENT);
    expect(screen.getByTestId('call-peer-address')).toHaveTextContent('GFREELANCER');
    expect(screen.getByTestId('call-connection-status')).toHaveTextContent('connected');
    expect(screen.getByTestId('connection-rtt')).toHaveTextContent('—');
  });

  it('toggles the microphone track and reflects mute status', async () => {
    await renderConnectedCall();

    expect(screen.getByTestId('mute-status')).toHaveTextContent('Unmuted');
    fireEvent.click(screen.getByTestId('toggle-audio'));
    expect(audioTrack.enabled).toBe(false);
    expect(screen.getByTestId('mute-status')).toHaveTextContent('Muted');
    expect(screen.getByTestId('toggle-audio')).toHaveTextContent(/Unmute/i);

    fireEvent.click(screen.getByTestId('toggle-audio'));
    expect(audioTrack.enabled).toBe(true);
    expect(screen.getByTestId('mute-status')).toHaveTextContent('Unmuted');
  });

  it('captures a screen-share track and stops it when sharing ends', async () => {
    const pc = await renderConnectedCall();

    fireEvent.click(screen.getByTestId('toggle-screen-share'));
    await waitFor(() => expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false }));
    await waitFor(() => expect(screen.getByTestId('screen-share-preview')).toBeInTheDocument());
    expect(pc.addTrack).toHaveBeenCalledWith(screenTrack, screenStream);
    expect(screen.getByTestId('toggle-screen-share')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('toggle-screen-share'));
    await waitFor(() => expect(screenTrack.stop).toHaveBeenCalled());
    expect(screen.queryByTestId('screen-share-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('toggle-screen-share')).toHaveAttribute('aria-pressed', 'false');
  });

  it('logs call participants and duration to the project audit trail', async () => {
    await renderConnectedCall();

    await waitFor(() => expect(loadReviewSessions(project.id)).toHaveLength(1));
    expect(loadReviewSessions(project.id)[0].participants).toEqual([
      { address: CLIENT, role: 'client' },
      { address: 'GFREELANCER', role: 'freelancer' },
    ]);

    fireEvent.click(screen.getByTestId('end-review-call'));

    await waitFor(() => expect(screen.getByTestId('review-session-summary')).toBeInTheDocument());
    const [session] = loadReviewSessions(project.id);
    expect(session.endedAt).toBeDefined();
    expect(session.durationMs).toBeGreaterThanOrEqual(0);
    expect(screen.getByTestId('call-connection-status')).toHaveTextContent('ended');
  });

  it('blocks the call until both escrow wallets are known', async () => {
    render(
      <MilestoneReviewCallModal
        isOpen
        onClose={() => {}}
        project={{ ...project, freelancer_address: undefined }}
        localAddress={CLIENT}
      />
    );

    expect(screen.getByTestId('call-missing-wallet')).toBeInTheDocument();
    expect(screen.getByTestId('start-review-call')).toBeDisabled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('rejects a wallet that is not a participant', async () => {
    render(
      <MilestoneReviewCallModal isOpen onClose={() => {}} project={project} localAddress="GSTRANGER" />
    );

    expect(screen.getByTestId('call-missing-wallet')).toHaveTextContent(/not a participant/i);
    expect(screen.getByTestId('start-review-call')).toBeDisabled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
