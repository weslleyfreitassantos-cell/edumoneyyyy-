export interface CameraInputValues {
  name: string;
  host: string;
  port: number;
  deviceType: 'IP_CAMERA' | 'NVR';
  channel: number | null;
}

export function isSafeCameraHost(host: string): boolean {
  const value = host.trim();

  if (!value || value.length > 253) return false;
  if (/\s|[\\/?#@]/.test(value)) return false;

  const normalized = value.toLowerCase();
  if (
    ['localhost', '::1', '::', '0.0.0.0'].includes(normalized) ||
    /(^|\.)127\./.test(normalized) ||
    /(^|\.)169\.254\./.test(normalized)
  ) {
    return false;
  }

  return true;
}

export function validateCameraInput(
  values: CameraInputValues,
): string | null {
  if (!values.name.trim()) return 'Informe um nome para a câmera.';
  if (!isSafeCameraHost(values.host)) {
    return 'Informe um host válido. O gateway fará a conexão local.';
  }
  if (!Number.isInteger(values.port) || values.port < 1 || values.port > 65535) {
    return 'Informe uma porta entre 1 e 65535.';
  }
  if (values.deviceType === 'NVR' && values.channel === null) {
    return 'Informe o canal do NVR.';
  }
  if (
    values.channel !== null &&
    (!Number.isInteger(values.channel) || values.channel < 1 || values.channel > 9999)
  ) {
    return 'Informe um canal entre 1 e 9999.';
  }
  return null;
}
