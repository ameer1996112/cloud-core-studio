export type AdminClassFormValidationInput = {
  mode: "create" | "edit";
  form: {
    title: string;
    starts_at: string;
    room: string;
    room_id: string;
    instructor_id: string;
    program_type_id: string;
  };
  activeRooms: unknown[];
  activePrograms: unknown[];
  activeInstructors: unknown[];
  t: (key: AdminClassValidationKey) => string;
};

type AdminClassValidationKey =
  | "admin.classes.needLessonDateTime"
  | "admin.classes.needDateTime"
  | "admin.classes.needRoomSelection"
  | "admin.classes.needMainStudio"
  | "admin.classes.needProgram"
  | "admin.classes.needInstructor"
  | "admin.classes.needInstructorSelection";

export function getClassFormDisabledReason({
  mode,
  form,
  activeRooms,
  activePrograms,
  activeInstructors,
  t,
}: AdminClassFormValidationInput) {
  if (!form.title.trim()) return t("admin.classes.needLessonDateTime");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.starts_at))
    return t("admin.classes.needDateTime");
  if (!form.room_id && !form.room.trim()) return t("admin.classes.needRoomSelection");

  // Existing classes predate templates, rooms, and instructor assignments.
  // Operational edits must remain possible without forcing a data migration.
  if (mode === "edit") return null;

  if (activeRooms.length === 0) return t("admin.classes.needMainStudio");
  if (activePrograms.length === 0) return t("admin.classes.needProgram");
  if (activeInstructors.length === 0) return t("admin.classes.needInstructor");
  if (!form.program_type_id) return t("admin.classes.needLessonDateTime");
  if (!form.instructor_id) return t("admin.classes.needInstructorSelection");
  return null;
}
