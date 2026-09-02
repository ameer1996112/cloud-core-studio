import { AsyncLocalStorage } from "node:async_hooks";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Supabase keeps AbortSignal on each query builder. Scope it to the current
// request so nested notification helpers share the budget without changing
// unrelated requests or mutating the singleton client.
export function createAbortableDatabaseScope<T extends object>(client: T) {
  const signals = new AsyncLocalStorage<AbortSignal>();
  const attach = (query: any, signal: AbortSignal) =>
    typeof query?.abortSignal === "function" ? query.abortSignal(signal) : query;
  const database = new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if ((property !== "from" && property !== "rpc") || typeof value !== "function") {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (...args: unknown[]) => {
        const signal = signals.getStore();
        signal?.throwIfAborted();
        const builder = value.apply(target, args);
        if (!signal) return builder;
        if (property === "rpc") return attach(builder, signal);
        return new Proxy(builder, {
          get(queryBuilder, method) {
            const operation = Reflect.get(queryBuilder, method);
            if (typeof operation !== "function") return operation;
            return (...operationArgs: unknown[]) => {
              signal.throwIfAborted();
              return attach(operation.apply(queryBuilder, operationArgs), signal);
            };
          },
        });
      };
    },
  });

  return {
    database,
    run<R>(signal: AbortSignal | undefined, work: () => Promise<R>): Promise<R> {
      return signal ? signals.run(signal, work) : work();
    },
  };
}

const notificationScope = createAbortableDatabaseScope(supabaseAdmin);
export const notificationDatabase = notificationScope.database;
export const withNotificationDatabaseSignal = notificationScope.run;
