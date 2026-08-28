import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { upsertClass, listInstructors, getSettings, listProgramTypes } from "@/lib/admin.functions";
import { listRooms } from "@/lib/rooms.functions";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SessionForm, serializeClass, type SessionFormState } from "@/components/admin/SessionForm";

export const Route = createFileRoute("/_authenticated/admin/classes/new")({
  component: NewClass,
});

function NewClass() {
  const { t } = useI18n();
  useDocumentTitle("page.newClass.title");
  const navigate = useNavigate();
  const upsertFn = useServerFn(upsertClass);
  const instructorsFn = useServerFn(listInstructors);
  const settingsFn = useServerFn(getSettings);
  const programsFn = useServerFn(listProgramTypes);
  const roomsFn = useServerFn(listRooms);
  const { data: instructors } = useQuery({
    queryKey: ["admin-instructors"],
    queryFn: () => instructorsFn(),
  });
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => settingsFn(),
  });
  const { data: programs } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: () => programsFn(),
  });
  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: () => roomsFn(),
  });

  const [form, setForm] = useState<SessionFormState>(() => ({
    title: "",
    starts_at: "",
    duration_minutes: 60,
    capacity: 10,
    room: "",
    room_id: "",
    energy: "calm",
    cancellation_window_hours: 24,
    credit_cost: 1,
    instructor_id: "",
    program_type_id: "",
    member_visible: true,
  }));

  useEffect(() => {
    if (settings) {
      setForm((f) => ({
        ...f,
        capacity: f.program_type_id ? f.capacity : settings.default_capacity,
        energy: settings.energy_labels?.[0] ?? f.energy,
        cancellation_window_hours: settings.default_cancellation_window_hours,
        credit_cost: f.program_type_id ? f.credit_cost : settings.default_credit_cost,
      }));
    }
  }, [settings]);

  useEffect(() => {
    const activeInstructors = (instructors ?? []).filter((instructor: any) => instructor.active);
    const yareen = activeInstructors.find((instructor: any) =>
      String(instructor.name ?? "")
        .toLowerCase()
        .includes("yareen shobash"),
    );
    const defaultInstructor =
      yareen ?? (activeInstructors.length === 1 ? activeInstructors[0] : null);
    if (!defaultInstructor) return;
    setForm((current) =>
      current.instructor_id ? current : { ...current, instructor_id: defaultInstructor.id },
    );
  }, [instructors]);

  const mutation = useMutation({
    mutationFn: (next: SessionFormState) =>
      upsertFn({
        data: serializeClass(next),
      }),
    onSuccess: () => {
      toast.success(t("admin.classes.created"));
      navigate({ to: "/admin/classes" });
    },
    onError: (e: any) => toast.error(e.message ?? t("admin.classes.failed")),
  });

  return (
    <SessionForm
      mode="create"
      form={form}
      setForm={setForm}
      data={{ instructors, settings, programs, rooms }}
      isPending={mutation.isPending}
      onCancel={() => navigate({ to: "/admin/classes" })}
      onSubmit={() => mutation.mutate(form)}
    />
  );
}
