import type {
  CameraGateway,
  CameraMutationInput,
  DirectorCamera,
} from '../../services/cameraService';

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
