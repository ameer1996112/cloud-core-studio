import * as Sonner from "sonner";

import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner.Toaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner.Toaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

interface PersistentAnnouncementProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "aria-live" | "role"
> {
  tone: "success" | "error";
  title: string;
}

function PersistentAnnouncement({
  tone,
  title,
  children,
  className,
  ...props
}: PersistentAnnouncementProps) {
  return (
    <div
      {...props}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-[var(--cc-radius-card)] border p-4 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-emerald-600/30 bg-emerald-50 text-emerald-950",
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
    </div>
  );
}

export { PersistentAnnouncement, Toaster };
