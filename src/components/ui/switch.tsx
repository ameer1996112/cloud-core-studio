import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[var(--cc-target-min)] w-[calc(var(--cc-target-min)*1.6)] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors duration-[var(--cc-motion-fast)] focus-visible:outline-[var(--cc-focus-outline)] focus-visible:outline-offset-[var(--cc-focus-offset)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--cc-action-primary)] data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-[calc(var(--cc-target-min)-0.5rem)] rounded-full bg-background shadow-lg ring-0 transition-transform duration-[var(--cc-motion-fast)] data-[state=checked]:translate-x-[calc(var(--cc-target-min)*0.6)] data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
