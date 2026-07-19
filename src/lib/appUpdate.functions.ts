import { createServerFn } from "@tanstack/react-start";
import { readPublicAppUpdatePolicy } from "@/lib/appUpdatePolicy";

export const getPublicAppUpdatePolicy = createServerFn({ method: "GET" }).handler(() =>
  readPublicAppUpdatePolicy(process.env),
);
