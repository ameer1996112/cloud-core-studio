import { describe, expect, test } from "bun:test";
import { validateAuthFields } from "../../src/lib/authValidation";

describe("auth form validation", () => {
  test("identifies required signup fields and invalid email without calling the auth provider", () => {
    expect(
      validateAuthFields({
        mode: "signup",
        name: "",
        email: "not-an-email",
        password: "short",
      }),
    ).toEqual({
      name: "required",
      email: "invalidEmail",
      password: "passwordTooShort",
    });
  });

  test("requires only email in forgot-password mode", () => {
    expect(
      validateAuthFields({
        mode: "forgot",
        name: "",
        email: "",
        password: "",
      }),
    ).toEqual({ email: "required" });
  });

  test("accepts valid sign-in and signup values", () => {
    expect(
      validateAuthFields({
        mode: "signin",
        name: "",
        email: "member@example.com",
        password: "secret1",
      }),
    ).toEqual({});

    expect(
      validateAuthFields({
        mode: "signup",
        name: "Ameer Amer",
        email: "member@example.com",
        password: "secret1",
      }),
    ).toEqual({});
  });
});
