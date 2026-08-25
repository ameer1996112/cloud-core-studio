import { describe, expect, test } from "bun:test";
import React from "react";
import { DialogContent } from "../../src/components/ui/dialog.tsx";

describe("dialog accessibility", () => {
  test("the shared automatic close control has a 44px target", () => {
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

    expect(automaticClose).not.toBeNull();
    expect(automaticClose.props["aria-label"]).toBeTruthy();
    expect(automaticClose.props.className).toContain("h-11");
    expect(automaticClose.props.className).toContain("w-11");
  });
});
