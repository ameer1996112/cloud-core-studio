import { describe, expect, test } from "bun:test";
import React from "react";
import { DialogContent } from "../../src/components/ui/dialog.tsx";

describe("dialog accessibility", () => {
  test("the shared automatic close control has a 44px target", () => {
    const contentTree = DialogContent.render(
      { children: React.createElement("p", null, "Dialog body") },
      null,
    );
    const primitiveContent = contentTree.props.children[1];
    const automaticClose = primitiveContent.props.children[1];

    expect(automaticClose.props["aria-label"]).toBeTruthy();
    expect(automaticClose.props.className).toContain("h-11");
    expect(automaticClose.props.className).toContain("w-11");
  });
});
