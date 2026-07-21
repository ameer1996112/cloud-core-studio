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
    if (["string", "number", "boolean"].includes(typeof value)) {
      variables[key] = String(value).slice(0, 500);
    }
  }
  return variables;
}
