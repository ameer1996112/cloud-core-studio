import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { notifyAdminMemberSignupServer } from "@/lib/adminPushSignup.server";

export const notifyAdminMemberSignup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(({ data }) => notifyAdminMemberSignupServer(data.memberId));
