export type AuthFormMode = "signin" | "signup" | "forgot" | "check-email";
export type AuthFieldName = "name" | "email" | "password";
export type AuthValidationIssue = "required" | "invalidEmail" | "passwordTooShort";
export type AuthValidationErrors = Partial<Record<AuthFieldName, AuthValidationIssue>>;

type AuthValidationInput = {
  mode: AuthFormMode;
  name: string;
  email: string;
  password: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export function validateAuthFields({
  mode,
  name,
  email,
  password,
}: AuthValidationInput): AuthValidationErrors {
  if (mode === "check-email") return {};

  const errors: AuthValidationErrors = {};

  if (mode === "signup" && !name.trim()) errors.name = "required";

  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    errors.email = "required";
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = "invalidEmail";
  }

  if (mode === "signin" || mode === "signup") {
    if (!password) {
      errors.password = "required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = "passwordTooShort";
    }
  }

  return errors;
}
