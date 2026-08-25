export type AppRole = "admin" | "instructor" | "member";

export type RoleHome = "/admin" | "/member" | "/instructor";

export function roleHome(role: string | null | undefined): RoleHome {
  if (role === "admin") return "/admin";
  if (role === "instructor") return "/instructor";
  return "/member";
}
