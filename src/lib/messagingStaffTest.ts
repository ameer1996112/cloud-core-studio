export function applyStaffTestVariables(
  baseVariables: Record<string, unknown>,
  payload: Record<string, unknown>,
) {
  const variables = { ...baseVariables };
  if (
    payload.staff_test !== true ||
    !payload.test_variables ||
    typeof payload.test_variables !== "object" ||
    Array.isArray(payload.test_variables)
  ) {
    return variables;
  }

  for (const [key, value] of Object.entries(payload.test_variables)) {
    // A Journey Lab payload can supply safe scenario facts, never a replacement identity.
    if (key === "member_name") continue;
    if (typeof value === "string") variables[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean") variables[key] = value;
  }
  return variables;
}

export function isStaffTestMessageContent(content: unknown): boolean {
  return (
    !!content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    (content as Record<string, unknown>).staff_test === true
  );
}
