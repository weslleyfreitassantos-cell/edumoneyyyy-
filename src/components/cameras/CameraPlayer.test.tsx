// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CameraPlayer } from './CameraPlayer';

const camera = {
  id: 'camera-1', institutionId: 'institution-1', gatewayId: 'gateway-1', gatewayName: 'Gateway',
  gatewayStatus: 'ONLINE' as const, gatewayLastSeenAt: null, name: 'Entrada', location: null,
  manufacturer: null, model: null, deviceType: 'IP_CAMERA' as const, protocol: 'ONVIF' as const,
  host: '192.168.1.50', port: 554, channel: null, streamProfile: 'SUB' as const, active: true,
  directorAccess: true, guardianAccess: false as const, createdAt: '', updatedAt: '',
};

describe('CameraPlayer', () => {
  it('não usa RTSP nem oferece áudio/gravação/download', () => {
    render(<CameraPlayer camera={camera} streamUrl="rtsp://192.168.1.50/live" onClose={vi.fn()} />);
    expect(screen.queryByRole('video')).toBeNull();
    expect(screen.getByText(/sem áudio, gravação ou download/i)).toBeTruthy();
    expect(screen.getByText(/stream ainda não disponível/i)).toBeTruthy();
  });
});
