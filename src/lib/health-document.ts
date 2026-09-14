import { HEALTH_DOCUMENT_MAX_BYTES } from "./health-real-form";
export function healthDocumentMime(bytes: Uint8Array): string | null {
  if (!bytes.length || bytes.length > HEALTH_DOCUMENT_MAX_BYTES) return null;
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "image/png";
  return null;
}
export function healthDocumentName(mime: string) {
  return `medical-certificate.${mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg"}`;
}
