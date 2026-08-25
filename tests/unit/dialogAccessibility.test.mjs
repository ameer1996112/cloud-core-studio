import { describe, expect, test } from "bun:test";

const decoder = new TextDecoder();

function inspectAutomaticDialogClose() {
  const script = `
import React from "react";
import { DialogContent } from "./src/components/ui/dialog.tsx";

const contentTree = DialogContent.render(
  { children: React.createElement("p", null, "Dialog body") },
  null,
);

const visit = (node) => {
  if (!React.isValidElement(node)) return null;
  if (node.props?.["aria-label"] && node.props?.className?.includes("end-4 top-4")) {
    return node;
  }
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = visit(child);
    if (found) return found;
  }
  return null;
};

const automaticClose = visit(contentTree);
process.stdout.write(JSON.stringify({
  ariaLabel: automaticClose?.props?.["aria-label"] ?? null,
  className: automaticClose?.props?.className ?? null,
}));
`;

  const result = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr).trim() || "dialog inspection failed");
  }

  return JSON.parse(decoder.decode(result.stdout));
}

describe("dialog accessibility", () => {
  test("the shared automatic close control has a 44px target", () => {
    const automaticClose = inspectAutomaticDialogClose();

    expect(automaticClose.ariaLabel).toBeTruthy();
    expect(automaticClose.className).toContain("h-11");
    expect(automaticClose.className).toContain("w-11");
  });
});
