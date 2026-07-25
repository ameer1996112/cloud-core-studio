import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminPage,
  AdminPageHeader,
  AdminPageShell,
  AdminSection,
} from "@/components/admin-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConciergeCenter,
  setConciergeAutomationMode,
  setConciergeChannelEnabled,
  simulateConciergeDecision,
} from "@/lib/conciergeAdmin.functions";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getConciergeCenter);
  const setMode = useServerFn(setConciergeAutomationMode);
  const setChannel = useServerFn(setConciergeChannelEnabled);
  const simulate = useServerFn(simulateConciergeDecision);
  const [recipientId, setRecipientId] = useState("preview-recipient");
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const center = useQuery({ queryKey: ["concierge-center"], queryFn: () => getCenter() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["concierge-center"] });
  const modeMutation = useMutation({
    mutationFn: (input: { automationId: string; mode: "paused" | "shadow" | "test_only" }) =>
      setMode({ data: input }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });
  const channelMutation = useMutation({
    mutationFn: (input: { channel: "push" | "email" | "whatsapp"; enabled: boolean }) =>
      setChannel({ data: input }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });

  return (
    <AdminPageShell>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Concierge"
          title="Automations"
          description="Business controls, health, suppressions, and a safe decision simulator. No journey is live by default."
        />

        <AdminSection title="Global channel controls" eyebrow="Kill switches">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(center.data?.channels ?? []).map((channel: any) => (
              <div
                className="editorial-panel flex items-center justify-between p-4"
                key={channel.channel}
              >
                <div>
                  <p className="font-medium capitalize">{channel.channel.replace("_", " ")}</p>
                  <p className="text-sm text-slate">{channel.enabled ? "Enabled" : "Disabled"}</p>
                </div>
                {channel.channel === "in_app" ? (
                  <Badge>Durable</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={channel.enabled ? "destructive" : "outline"}
                    disabled={channelMutation.isPending}
                    onClick={() =>
                      channelMutation.mutate({
                        channel: channel.channel,
                        enabled: !channel.enabled,
                      })
                    }
                  >
                    {channel.enabled ? "Disable" : "Enable"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="Journey controls" eyebrow="Paused, shadow, or test-only">
          <div className="grid gap-4 lg:grid-cols-2">
            {(center.data?.automations ?? []).map((automation: any) => (
              <article className="editorial-panel space-y-4 p-5" key={automation.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl capitalize">
                      {automation.journey_type.replaceAll("_", " ")}
                    </h3>
                    <p className="text-sm text-slate">Policy v{automation.version}</p>
                  </div>
                  <Badge>{automation.mode.replace("_", " ")}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["paused", "shadow", "test_only"] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={automation.mode === mode ? "default" : "outline"}
                      disabled={modeMutation.isPending}
                      onClick={() => modeMutation.mutate({ automationId: automation.id, mode })}
                    >
                      {mode.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="Runtime health" eyebrow="Outbox and shadow evaluation">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Pending events" value={center.data?.queueHealth.pending ?? 0} />
            <MetricCard label="Dead-lettered" value={center.data?.queueHealth.deadLettered ?? 0} />
            <MetricCard
              label="Shadow evaluations"
              value={center.data?.shadowSummary.evaluated ?? 0}
            />
            <MetricCard
              label="Suppressions"
              value={Object.values(center.data?.shadowSummary.suppressions ?? {}).reduce(
                (total, value) => total + Number(value),
                0,
              )}
            />
          </div>
          {center.data?.queueHealth.oldestPendingAt && (
            <p className="text-sm text-slate">
              Oldest pending event:{" "}
              {new Date(center.data.queueHealth.oldestPendingAt).toLocaleString()}
            </p>
          )}
        </AdminSection>

        <AdminSection title="Decision simulator" eyebrow="No delivery or reservation">
          <div className="editorial-panel grid gap-4 p-5 md:grid-cols-[1fr_auto]">
            <Input
              aria-label="Recipient identifier"
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
            />
            <Button
              onClick={async () => {
                const result = await simulate({
                  data: {
                    recipientId,
                    locale: "ar",
                    hasPush: true,
                    event: "booking_confirmed",
                    purpose: "transactional",
                    priority: 3,
                    simulatedAt: new Date().toISOString(),
                  },
                });
                setSimulation(result as Record<string, unknown>);
              }}
            >
              Simulate booking
            </Button>
            {simulation && (
              <pre className="overflow-auto rounded-lg bg-navy p-4 text-xs text-ivory md:col-span-2">
                {JSON.stringify(simulation, null, 2)}
              </pre>
            )}
          </div>
        </AdminSection>

        <AdminSection title="Admin attention queue" eyebrow="Requires review">
          <div className="space-y-2">
            {(center.data?.attention ?? []).map((item: any) => (
              <div className="editorial-panel flex items-center justify-between p-4" key={item.id}>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate">{item.item_type.replaceAll("_", " ")}</p>
                </div>
                <Badge variant={item.severity === "urgent" ? "destructive" : "secondary"}>
                  {item.severity}
                </Badge>
              </div>
            ))}
            {center.data && center.data.attention.length === 0 && (
              <p className="editorial-panel p-5 text-slate">No open attention items.</p>
            )}
          </div>
        </AdminSection>
      </AdminPage>
    </AdminPageShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="editorial-panel p-4">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-1 font-serif text-3xl text-navy">{value}</p>
    </div>
  );
}
