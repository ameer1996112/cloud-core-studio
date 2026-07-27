import { createHash } from "node:crypto";
import { TRANSACTIONAL_EMAIL_SHELL_VERSION } from "@/lib/transactionalEmail";

export function hashTransactionalEmailShellArtifact(artifact: string) {
  return createHash("sha256")
    .update(`cloud-core-transactional-email-shell-v${TRANSACTIONAL_EMAIL_SHELL_VERSION}\u001f`)
    .update(artifact)
    .digest("hex");
}
