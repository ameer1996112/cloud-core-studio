/**
 * DOM Patches to prevent external scripts/extensions (e.g. Bitwarden, Google Translate)
 * from crashing the React application by throwing DOM exceptions during DOM manipulation
 * (like insertBefore, removeChild, or replaceChild) on unmounted or modified elements.
 */

if (typeof window !== "undefined" && typeof Node !== "undefined") {
  const originalInsertBefore = Node.prototype.insertBefore;
  (Node.prototype as any).insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn(
        "DOM Patch [insertBefore]: referenceNode is not a child of this parent. Appending instead to prevent crash.",
        { parent: this, newNode, referenceNode },
      );
      return this.appendChild(newNode);
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  const originalRemoveChild = Node.prototype.removeChild;
  (Node.prototype as any).removeChild = function <T extends Node>(child: T): T {
    if (child && child.parentNode !== this) {
      console.warn(
        "DOM Patch [removeChild]: child is not a child of this parent. Skipping removal to prevent crash.",
        { parent: this, child },
      );
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  (Node.prototype as any).replaceChild = function <T extends Node>(newChild: Node, oldChild: T): T {
    if (oldChild && oldChild.parentNode !== this) {
      console.warn(
        "DOM Patch [replaceChild]: oldChild is not a child of this parent. Appending instead to prevent crash.",
        { parent: this, newChild, oldChild },
      );
      this.appendChild(newChild);
      return oldChild;
    }
    return originalReplaceChild.call(this, newChild, oldChild) as T;
  };
}

if (typeof window !== "undefined" && typeof Window !== "undefined") {
  const originalPostMessage = Window.prototype.postMessage;
  Window.prototype.postMessage = function (
    this: Window,
    message: any,
    targetOrigin: string,
    transfer?: any[],
  ): void {
    try {
      return (originalPostMessage as any).call(this, message, targetOrigin, transfer);
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("target origin") || e.message.includes("origin"))
      ) {
        console.warn(
          "DOM Patch [postMessage]: Suppressed origin mismatch error to prevent app crash.",
          e,
        );
        return;
      }
      throw e;
    }
  } as any;
}
