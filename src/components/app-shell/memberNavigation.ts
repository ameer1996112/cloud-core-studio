import type { MouseEvent as ReactMouseEvent } from "react";

type NavigationClick = Pick<
  ReactMouseEvent<HTMLAnchorElement>,
  "altKey" | "button" | "ctrlKey" | "defaultPrevented" | "metaKey" | "shiftKey"
>;

export function isPlainPrimaryNavigationClick(event: NavigationClick) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function queueLatestDocumentNavigation(
  destination: string,
  sequence: { current: number },
  requestFrame: (callback: FrameRequestCallback) => number,
  assign: (destination: string) => void,
) {
  const navigationSequence = ++sequence.current;
  requestFrame(() => {
    requestFrame(() => {
      if (sequence.current === navigationSequence) assign(destination);
    });
  });
}

export function shouldClearPendingMobileNavigation({
  destination,
  isLoading,
  resolvedPathname,
  navigationStarted,
}: {
  destination: string | null;
  isLoading: boolean;
  resolvedPathname: string;
  navigationStarted: boolean;
}) {
  return Boolean(
    destination && !isLoading && (navigationStarted || resolvedPathname === destination),
  );
}
