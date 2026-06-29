export function isTestRecord(value?: string | null) {
  const text = (value ?? "").trim();
  return /^(E2E|QA_TEST|QA_PRE_RELEASE|QA_PRE_RELEASE_RERUN|QA_PRE_RELEASE_FINAL)(?:\b|_)/i.test(
    text,
  );
}

export function hasTestRecordFields(record: any, fields: string[] = ["title", "name"]) {
  return fields.some((field) => isTestRecord(record?.[field]));
}

export function hasTestPlanRecord(record: any) {
  return (
    isTestRecord(record?.name) ||
    isTestRecord(record?.description) ||
    isTestRecord(record?.plan?.name) ||
    isTestRecord(record?.plan?.description)
  );
}

export function hasTestClassRecord(record: any) {
  return (
    isTestRecord(record?.title) ||
    isTestRecord(record?.class?.title) ||
    isTestRecord(record?.instructor?.name) ||
    isTestRecord(record?.room_ref?.name) ||
    isTestRecord(record?.room_obj?.name) ||
    isTestRecord(record?.room) ||
    isTestRecord(record?.program_type?.name_en) ||
    isTestRecord(record?.program_type?.name_he) ||
    isTestRecord(record?.program_type?.name_ar) ||
    isTestRecord(record?.class?.instructor?.name) ||
    isTestRecord(record?.class?.room_ref?.name) ||
    isTestRecord(record?.class?.room) ||
    isTestRecord(record?.class?.program_type?.name_en) ||
    isTestRecord(record?.class?.program_type?.name_he) ||
    isTestRecord(record?.class?.program_type?.name_ar)
  );
}
