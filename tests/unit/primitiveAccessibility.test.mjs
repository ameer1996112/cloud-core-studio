import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import * as React from "react";

import { Button } from "../../src/components/ui/button";

const readSource = (file) =>
  readFileSync(new URL(`../../src/components/ui/${file}`, import.meta.url), "utf8");

function renderForwardRef(element) {
  if (typeof element.type === "object" && element.type !== null && "render" in element.type) {
    return renderForwardRef(element.type.render(element.props, null));
  }

  return element;
}

describe("interaction primitive accessibility contracts", () => {
  test("action primitives use the shared target and focus contracts", () => {
    const button = readSource("button.tsx");
    const iconButton = readSource("icon-button.tsx");

    expect(button).toMatch(/min-h-\[var\(--cc-target-min\)\]/);
    expect(button).toMatch(/focus-visible:outline-\[var\(--cc-focus-outline\)\]/);
    expect(iconButton).toMatch(/size-\[var\(--cc-target-min\)\]/);
    expect(iconButton).toMatch(/["']aria-label["']:\s*string/);
  });

  test("loading buttons retain labels, expose busy state, and block duplicate activation", () => {
    const button = readSource("button.tsx");

    expect(button).toMatch(/loading\?: boolean/);
    expect(button).toMatch(/loadingLabel\?: string/);
    expect(button).toMatch(/["']aria-busy["']:\s*loading \? true : ariaBusy/);
    expect(button).toMatch(/disabled:\s*disabled \|\| loading/);
    expect(button).toMatch(/\{children\}/);
  });

  test("loading asChild controls replace child activation and force the busy state", () => {
    let activations = 0;
    const child = React.createElement(
      "a",
      { href: "/submit", onClick: () => activations++ },
      "Submit booking",
    );
    const buttonElement = Button.render(
      { asChild: true, loading: true, "aria-busy": false, children: child },
      null,
    );
    expect(() => renderForwardRef(buttonElement)).not.toThrow();
    const rendered = renderForwardRef(buttonElement);
    const event = { preventDefault: () => undefined, stopPropagation: () => undefined };

    expect(rendered.type).toBe("a");
    expect(rendered.props["aria-busy"]).toBe(true);
    rendered.props.onClick(event);
    expect(activations).toBe(0);
  });

  test("error-capable fields preserve native accessibility props", () => {
    for (const file of ["input.tsx", "textarea.tsx", "select.tsx"]) {
      const source = readSource(file);

      expect(source).toMatch(/aria-invalid/);
      expect(source).toMatch(/aria-describedby/);
      expect(source).toMatch(/disabled/);
    }

    expect(readSource("input.tsx")).toMatch(/readOnly/);
    expect(readSource("textarea.tsx")).toMatch(/readOnly/);
    expect(readSource("field-message.tsx")).toMatch(
      /role=\{tone === "error" \? "alert" : undefined\}/,
    );
  });

  test("selection controls expose shared disabled, selected, and focus states", () => {
    for (const file of ["checkbox.tsx", "radio-group.tsx", "switch.tsx", "tabs.tsx"]) {
      const source = readSource(file);

      expect(source).toMatch(/disabled:/);
      expect(source).toMatch(/data-\[state=(checked|active)\]/);
      expect(source).toMatch(/focus-visible:outline-\[var\(--cc-focus-outline\)\]/);
    }
  });

  test("SelectItem uses the shared target, focus, and disabled contracts", () => {
    const source = readSource("select.tsx");
    const selectItem = source.slice(
      source.indexOf("const SelectItem"),
      source.indexOf("const SelectSeparator"),
    );

    expect(selectItem).toMatch(/min-h-\[var\(--cc-target-min\)\]/);
    expect(selectItem).toMatch(/focus-visible:outline-\[var\(--cc-focus-outline\)\]/);
    expect(selectItem).toMatch(/focus-visible:outline-offset-\[var\(--cc-focus-offset\)\]/);
    expect(selectItem).toMatch(/data-\[disabled\]:cursor-not-allowed/);
  });
});
