export interface OnvifDeviceDescriptor {
  host: string;
  port: number;
  manufacturer: string | null;
  model: string | null;
}

export interface OnvifProfileDescriptor {
  token: string;
  name: string;
  streamUri: string | null;
}

/**
 * Boundary for a future ONVIF adapter. Network discovery stays outside the
 * gateway core so a later implementation can enforce LAN and credential rules.
 */
export interface OnvifAdapter {
  discover(): Promise<OnvifDeviceDescriptor[]>;
  getProfiles(device: OnvifDeviceDescriptor): Promise<OnvifProfileDescriptor[]>;
  resolveStreamUri(device: OnvifDeviceDescriptor, profile: OnvifProfileDescriptor): Promise<string>;
}
