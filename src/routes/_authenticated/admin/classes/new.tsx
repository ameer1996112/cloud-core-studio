import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { upsertClass, listInstructors, getSettings, listProgramTypes } from "@/lib/admin.functions";
import { listRooms } from "@/lib/rooms.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  localizedInstructorName,
  localizedProgramDescription,
  localizedProgramName,
  localizedRoomName,
} from "@/lib/localized-content";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  DoorOpen,
  Info,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";

type SessionFormState = {
  id?: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  room: string;
  room_id: string;
  energy: string;
  cancellation_window_hours: number;
  credit_cost: number;
  instructor_id: string;
  program_type_id: string;
  status?: "scheduled" | "cancelled" | "archived";
};

type SessionFormData = {
  instructors?: any[];
  settings?: any;
  programs?: any[];
  rooms?: any[];
};

const LAUNCH_CALENDAR_FALLBACK = "2026-07-01T10:00";

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

export function SessionForm({
  mode,
  form,
  setForm,
  data,
  isPending,
  onCancel,
  onSubmit,
  hasBookings = false,
}: {
  mode: "create" | "edit";
  form: SessionFormState;
  setForm: (value: SessionFormState | ((current: SessionFormState) => SessionFormState)) => void;
  data: SessionFormData;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  hasBookings?: boolean;
}) {
  const { t, lang } = useI18n();
  const [notes, setNotes] = useState("");
  const activeRooms = (data.rooms ?? []).filter((r: any) => r.active);
  const activePrograms = (data.programs ?? []).filter((p: any) => p.active);
  const activeInstructors = (data.instructors ?? []).filter((i: any) => i.active);
  const hasSelectedTime = form.starts_at.trim().length > 0;
  const selectedRoom = activeRooms.find(
    (room: any) => room.id === form.room_id || room.name === form.room,
  );
  const selectedProgram = activePrograms.find(
    (program: any) => program.id === form.program_type_id,
  );
  const selectedInstructor = activeInstructors.find(
    (instructor: any) => instructor.id === form.instructor_id,
  );
  const startDate = parseLocalInputValue(form.starts_at);
  const roomDisplay =
    localizedRoomName(selectedRoom, form.room, lang) ?? t("admin.classes.mainStudio");
  const instructorDisplay = selectedInstructor
    ? localizedInstructorName(selectedInstructor.name, lang)
    : t("admin.classes.selectInstructor");
  const disabledReason = getDisabledReason({
    activeRooms,
    activePrograms,
    activeInstructors,
    form,
    hasSelectedTime,
    t,
  });
  const canSubmit = !disabledReason;

  useEffect(() => {
    if (activeRooms.length !== 1) return;
    const [onlyRoom] = activeRooms;
    setForm((current) =>
      current.room_id === onlyRoom.id && current.room === onlyRoom.name
        ? current
        : { ...current, room_id: onlyRoom.id, room: onlyRoom.name },
    );
  }, [activeRooms, setForm]);

  useEffect(() => {
    if (activeInstructors.length !== 1) return;
    const [onlyInstructor] = activeInstructors;
    setForm((current) =>
      current.instructor_id ? current : { ...current, instructor_id: onlyInstructor.id },
    );
  }, [activeInstructors, setForm]);

  function submit() {
    if (!canSubmit) return;
    if (mode === "edit" && hasBookings && !confirm(t("admin.classes.saveBookedConfirm"))) return;
    onSubmit();
  }

  return (
    <form
      className="session-form-shell"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <header className="session-hero">
        <div>
          <p className="session-eyebrow">{t("admin.classes.sessionPlanner")}</p>
          <h2>{mode === "create" ? t("admin.classes.create") : t("admin.classes.edit")}</h2>
          <p>{t("admin.classes.plannerIntro")}</p>
        </div>
        <div className="session-summary" aria-label={t("admin.classes.summary")}>
          {hasSelectedTime ? (
            <>
              <span>{formatSessionDate(startDate, lang)}</span>
              <strong>{formatSessionTime(startDate, lang)}</strong>
            </>
          ) : (
            <>
              <span>{t("admin.classes.launchOpening")}</span>
              <strong>{t("admin.classes.timePending")}</strong>
            </>
          )}
        </div>
      </header>

      {disabledReason && (
        <div className="session-alert">
          <Info className="h-4 w-4" />
          <span>{disabledReason}</span>
        </div>
      )}

      <div className="session-layout">
        <div className="session-main">
          <SessionPanel
            icon={<Sparkles className="h-4 w-4" />}
            title={t("admin.classes.sectionLesson")}
            description={t("admin.classes.sectionLessonHelp")}
          >
            <PremiumField
              label={t("admin.classes.lessonTemplate")}
              helper={t("admin.classes.programHelp")}
            >
              <PremiumSelect
                required
                value={form.program_type_id}
                onChange={(value) => {
                  const program = data.programs?.find((item: any) => item.id === value);
                  setForm((current) => ({
                    ...current,
                    program_type_id: value,
                    title: program ? programName(program, lang) : current.title,
                    duration_minutes: program?.default_duration_minutes ?? current.duration_minutes,
                    capacity: program?.default_capacity ?? current.capacity,
                    credit_cost: program?.default_credit_cost ?? current.credit_cost,
                  }));
                }}
              >
                <option value="">{t("admin.classes.selectProgram")}</option>
                {activePrograms.map((program: any) => (
                  <option key={program.id} value={program.id}>
                    {programName(program, lang)}
                  </option>
                ))}
              </PremiumSelect>
            </PremiumField>
            {selectedProgram && (
              <div className="session-template-summary">
                <span>{programName(selectedProgram, lang)}</span>
                <p>
                  {localizedProgramDescription(selectedProgram, lang) ??
                    t("admin.classes.templateReady")}
                </p>
              </div>
            )}
            <PremiumField label={t("admin.classes.title")} helper={t("admin.classes.titleHelp")}>
              <input
                className="session-input"
                required
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              />
            </PremiumField>
          </SessionPanel>

          <SessionPanel
            icon={<CalendarDays className="h-4 w-4" />}
            title={t("admin.classes.sectionSchedule")}
            description={t("admin.classes.sectionScheduleHelp")}
          >
            <PremiumCalendar
              value={form.starts_at}
              onChange={(value) => setForm((current) => ({ ...current, starts_at: value }))}
              lang={lang}
            />
            <div className="session-grid two">
              <PremiumField label={t("admin.classes.durationMin")}>
                <NumberInput
                  value={form.duration_minutes}
                  min={1}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, duration_minutes: value }))
                  }
                />
              </PremiumField>
            </div>
          </SessionPanel>

          <SessionPanel
            icon={<Users className="h-4 w-4" />}
            title={t("admin.classes.sectionBooking")}
            description={t("admin.classes.sectionBookingHelp")}
          >
            <div className="session-grid two">
              <PremiumField label={t("admin.classes.capacityPlaces")}>
                <NumberInput
                  value={form.capacity}
                  min={1}
                  onChange={(value) => setForm((current) => ({ ...current, capacity: value }))}
                />
              </PremiumField>
              <PremiumField label={t("admin.classes.creditCost")}>
                <NumberInput
                  value={form.credit_cost}
                  min={0}
                  onChange={(value) => setForm((current) => ({ ...current, credit_cost: value }))}
                />
              </PremiumField>
            </div>
            <PremiumField label={t("admin.classes.cancelWindow")}>
              <NumberInput
                value={form.cancellation_window_hours}
                min={0}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    cancellation_window_hours: value,
                  }))
                }
              />
            </PremiumField>
            <div className="session-rule-card">
              <span>{t("admin.classes.ruleWindow")}</span>
              <strong>
                {t("admin.classes.ruleWindowValue", {
                  count: form.cancellation_window_hours,
                })}
              </strong>
            </div>
          </SessionPanel>

          <SessionPanel
            icon={<DoorOpen className="h-4 w-4" />}
            title={t("admin.classes.sectionStaffLocation")}
            description={t("admin.classes.sectionStaffLocationHelp")}
          >
            <div className="session-chip-grid">
              {activeInstructors.length === 1 ? (
                <ReadOnlyChip label={t("admin.classes.instructor")} value={instructorDisplay} />
              ) : (
                <PremiumField label={t("admin.classes.instructor")}>
                  <PremiumSelect
                    required
                    value={form.instructor_id}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, instructor_id: value }))
                    }
                  >
                    <option value="">{t("admin.classes.selectInstructor")}</option>
                    {activeInstructors.map((instructor: any) => (
                      <option key={instructor.id} value={instructor.id}>
                        {localizedInstructorName(instructor.name, lang)}
                      </option>
                    ))}
                  </PremiumSelect>
                </PremiumField>
              )}
              {activeRooms.length === 1 ? (
                <ReadOnlyChip label={t("admin.classes.location")} value={roomDisplay} />
              ) : activeRooms.length > 1 ? (
                <PremiumField label={t("admin.classes.location")}>
                  <PremiumSelect
                    required
                    value={form.room_id}
                    onChange={(value) => {
                      const room = activeRooms.find((item: any) => item.id === value);
                      setForm((current) => ({
                        ...current,
                        room_id: value,
                        room: room?.name ?? "",
                      }));
                    }}
                  >
                    <option value="">{t("admin.classes.selectRoom")}</option>
                    {activeRooms.map((room: any) => (
                      <option key={room.id} value={room.id}>
                        {localizedRoomName(room, room.name, lang)}
                      </option>
                    ))}
                  </PremiumSelect>
                </PremiumField>
              ) : (
                <div className="session-setup-warning">{t("admin.classes.needMainStudio")}</div>
              )}
            </div>
            <PremiumField label={t("member.filter.energy")}>
              <PremiumSelect
                value={form.energy}
                onChange={(value) => setForm((current) => ({ ...current, energy: value }))}
              >
                {(
                  data.settings?.energy_labels ?? ["calm", "grounding", "uplifting", "restorative"]
                ).map((energy: string) => (
                  <option key={energy} value={energy}>
                    {energyLabel(energy, t)}
                  </option>
                ))}
              </PremiumSelect>
            </PremiumField>
          </SessionPanel>
        </div>

        <aside className="session-side">
          <SessionPanel
            icon={<CircleDollarSign className="h-4 w-4" />}
            title={t("admin.classes.sectionPricing")}
            description={t("admin.classes.sectionPricingHelp")}
          >
            <div className="session-rule-card">
              <span>{t("admin.classes.capacityPlaces")}</span>
              <strong>{form.capacity}</strong>
            </div>
            <div className="session-rule-card powder">
              <span>{t("admin.classes.memberCharge")}</span>
              <strong>{t("admin.classes.creditValue", { count: form.credit_cost })}</strong>
            </div>
          </SessionPanel>

          <SessionPanel
            icon={<StickyNote className="h-4 w-4" />}
            title={t("admin.classes.sectionNotes")}
            description={t("admin.classes.sectionNotesHelp")}
          >
            <textarea
              className="session-input session-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("admin.classes.notesPlaceholder")}
            />
            <p className="session-helper">{t("admin.classes.notesNotSaved")}</p>
          </SessionPanel>
        </aside>
      </div>

      <div className="session-preview" aria-label={t("admin.classes.summary")}>
        <span>
          {selectedProgram ? programName(selectedProgram, lang) : t("admin.classes.lessonTemplate")}
        </span>
        <span>{roomDisplay}</span>
        <span>{instructorDisplay}</span>
      </div>

      {disabledReason && <p className="session-action-hint">{disabledReason}</p>}

      <div className="session-actions">
        <button type="button" onClick={onCancel} className="session-button secondary">
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={isPending || !canSubmit} className="session-button primary">
          {isPending
            ? t("common.saving")
            : mode === "create"
              ? t("admin.classes.createAction")
              : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function ReadOnlyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="session-readonly-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SessionPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="session-panel">
      <div className="session-panel-header">
        <div className="session-panel-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="session-panel-body">{children}</div>
    </section>
  );
}

function PremiumField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="session-field">
      <span>{label}</span>
      {children}
      {helper && <small>{helper}</small>}
    </label>
  );
}
function PremiumSelect({
  value,
  onChange,
  required,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="session-select-wrap">
      <select
        className="session-input session-select"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function NumberInput({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="session-input"
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function PremiumCalendar({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (value: string) => void;
  lang: Lang;
}) {
  const { t } = useI18n();
  const hasValue = value.trim().length > 0;
  const selected = parseLocalInputValue(value);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected));

  useEffect(() => {
    setVisibleMonth(startOfMonth(selected));
  }, [selected.getFullYear(), selected.getMonth()]);

  const locale = localeForLang(lang);
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const weekdayLabels = useMemo(() => {
    const base = new Date(2026, 5, 21);
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
        new Date(base.getFullYear(), base.getMonth(), base.getDate() + index),
      ),
    );
  }, [locale]);

  const selectedHour = String(selected.getHours()).padStart(2, "0");
  const selectedMinute = String(selected.getMinutes()).padStart(2, "0");
  const hours = Array.from({ length: 18 }, (_, index) => String(index + 5).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="premium-calendar" dir={lang === "en" ? "ltr" : "rtl"}>
      <div className="premium-calendar-top">
        <button
          type="button"
          onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
          aria-label={t("admin.classes.previousMonth")}
        >
          {lang === "en" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <strong>
          {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visibleMonth)}
        </strong>
        <button
          type="button"
          onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          aria-label={t("admin.classes.nextMonth")}
        >
          {lang === "en" ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="premium-calendar-grid labels">
        {weekdayLabels.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="premium-calendar-grid">
        {days.map((day) => {
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const selectedDay = hasValue && sameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={selectedDay ? "selected" : inMonth ? "" : "outside"}
              onClick={() => onChange(withDate(value, day))}
            >
              {new Intl.DateTimeFormat(locale, { day: "numeric" }).format(day)}
            </button>
          );
        })}
      </div>
      <label className="premium-time">
        <Clock3 className="h-4 w-4" />
        <span>{t("admin.classes.time")}</span>
        <div className="premium-time-selects">
          <select
            aria-label={t("admin.classes.hour")}
            value={selectedHour}
            disabled={!hasValue}
            onChange={(e) => onChange(withTime(value, `${e.target.value}:${selectedMinute}`))}
          >
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <span aria-hidden="true">:</span>
          <select
            aria-label={t("admin.classes.minute")}
            value={minutes.includes(selectedMinute) ? selectedMinute : "00"}
            disabled={!hasValue}
            onChange={(e) => onChange(withTime(value, `${selectedHour}:${e.target.value}`))}
          >
            {minutes.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  );
}

export function serializeClass(form: SessionFormState) {
  return {
    ...form,
    starts_at: parseLocalInputValue(form.starts_at).toISOString(),
    room_id: form.room_id || null,
    instructor_id: form.instructor_id || null,
    program_type_id: form.program_type_id || null,
  };
}

function programName(program: any, lang: Lang) {
  return localizedProgramName(program, lang) ?? program.name_en ?? program.name ?? "";
}

function getDisabledReason({
  activeRooms,
  activePrograms,
  activeInstructors,
  form,
  hasSelectedTime,
  t,
}: {
  activeRooms: any[];
  activePrograms: any[];
  activeInstructors: any[];
  form: SessionFormState;
  hasSelectedTime: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (activeRooms.length === 0) return t("admin.classes.needMainStudio");
  if (activePrograms.length === 0) return t("admin.classes.needProgram");
  if (activeInstructors.length === 0) return t("admin.classes.needInstructor");
  if (!form.program_type_id) return t("admin.classes.needLessonDateTime");
  if (!form.title.trim()) return t("admin.classes.needLessonDateTime");
  if (!hasSelectedTime) return t("admin.classes.needDateTime");
  if (!form.room_id && !form.room.trim()) return t("admin.classes.needRoomSelection");
  if (!form.instructor_id) return t("admin.classes.needInstructorSelection");
  return null;
}

function energyLabel(value: string, t: ReturnType<typeof useI18n>["t"]) {
  switch (value.toLowerCase().trim()) {
    case "calm":
      return t("energy.calm");
    case "grounding":
      return t("energy.grounding");
    case "uplifting":
      return t("energy.uplifting");
    case "restorative":
      return t("energy.restorative");
    default:
      return value;
  }
}

function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function parseLocalInputValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(LAUNCH_CALENDAR_FALLBACK) : parsed;
}

function withDate(value: string, date: Date) {
  const current = parseLocalInputValue(value);
  return toLocalInputValue(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      current.getHours(),
      current.getMinutes(),
    ),
  );
}

function withTime(value: string, time: string) {
  if (!value.trim()) return "";
  const current = parseLocalInputValue(value);
  const [hours = "0", minutes = "0"] = time.split(":");
  return toLocalInputValue(
    new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      Number(hours),
      Number(minutes),
    ),
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function calendarDays(month: Date) {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localeForLang(lang: Lang) {
  if (lang === "he") return "he-IL";
  if (lang === "ar") return "ar";
  return "en-US";
}

function formatSessionDate(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(localeForLang(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatSessionTime(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(localeForLang(lang), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <PremiumField label={label}>{children}</PremiumField>;
}
