FROM oven/bun:1.3.12 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.12 AS build
WORKDIR /app
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_APNS_ENV
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_APNS_ENV=$VITE_APNS_ENV
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/serve-production.mjs ./scripts/serve-production.mjs
COPY --from=build /app/scripts/member-notification-cron.mjs ./scripts/member-notification-cron.mjs
COPY --from=build /app/scripts/unified-messaging-cron.mjs ./scripts/unified-messaging-cron.mjs
EXPOSE 8080
CMD ["node", "scripts/serve-production.mjs"]
