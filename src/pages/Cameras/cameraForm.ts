import type {
  CameraGateway,
  CameraMutationInput,
  DirectorCamera,
} from '../../services/cameraService';

const NEW_CAMERA_DRAFT_PREFIX = 'edumanager.camera-draft.new.';

function newCameraDraftKey(institutionId: string): string {
  return `${NEW_CAMERA_DRAFT_PREFIX}${institutionId}`;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function readNewCameraDraft(
  institutionId: string,
): CameraMutationInput | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const rawDraft = window.sessionStorage.getItem(
      newCameraDraftKey(institutionId),
    );

    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft) as Partial<CameraMutationInput>;

    if (
      typeof draft !== 'object' ||
      draft === null ||
      draft.institutionId !== institutionId ||
      typeof draft.name !== 'string' ||
      typeof draft.host !== 'string' ||
      typeof draft.port !== 'number'
    ) {
      return null;
    }

    return draft as CameraMutationInput;
  } catch {
    return null;
  }
}

export function hasNewCameraDraft(institutionId: string): boolean {
  return readNewCameraDraft(institutionId) !== null;
}

export function writeNewCameraDraft(
  institutionId: string,
  draft: CameraMutationInput,
): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      newCameraDraftKey(institutionId),
      JSON.stringify(draft),
    );
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function clearNewCameraDraft(institutionId: string): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(
      newCameraDraftKey(institutionId),
    );
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function initialCameraForm(
  camera: DirectorCamera | null,
  institutionId: string,
  gatewayIdOverride: string | null | undefined,
  gateways: CameraGateway[],
): CameraMutationInput {
  return {
    institutionId: camera?.institutionId ?? institutionId,
    name: camera?.name ?? '',
    location: camera?.location ?? '',
    manufacturer: camera?.manufacturer ?? '',
    model: camera?.model ?? '',
    deviceType: camera?.deviceType ?? 'IP_CAMERA',
    protocol: camera?.protocol ?? 'ONVIF',
    host: camera?.host ?? '',
    port: camera?.port ?? 554,
    channel: camera?.channel ?? null,
    streamProfile: camera?.streamProfile ?? 'SUB',
    gatewayId: camera?.gatewayId ?? gatewayIdOverride ?? gateways[0]?.id ?? null,
    active: camera?.active ?? true,
  };
}
