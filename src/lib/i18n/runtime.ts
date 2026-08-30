import { coreCatalog } from "./catalogs/core";
import type {
  I18nParams,
  Lang,
  LocalizedCatalog,
  MessageNamespace,
  NamespaceLoader,
  RoleMessageNamespace,
} from "./types";

const namespaceLoaders = {
  member: () => import("./catalogs/member").then(({ memberCatalog }) => memberCatalog),
  instructor: () =>
    import("./catalogs/instructor").then(({ instructorCatalog }) => instructorCatalog),
  admin: () => import("./catalogs/admin").then(({ adminCatalog }) => adminCatalog),
} satisfies Record<RoleMessageNamespace, NamespaceLoader>;

type Catalogs = Partial<Record<MessageNamespace, LocalizedCatalog>>;

type ResolveMessageOptions = {
  language: Lang;
  key: string;
  catalogs: Catalogs;
  params?: I18nParams;
  onMissingKey?: (key: string, language: Lang) => void;
};

type CreateRuntimeOptions = {
  language: Lang;
  core?: LocalizedCatalog;
  loaders?: Partial<Record<RoleMessageNamespace, NamespaceLoader>>;
  onNamespaceLoaded?: (namespace: RoleMessageNamespace, catalog: LocalizedCatalog) => void;
  onMissingKey?: (key: string, language: Lang) => void;
};

function interpolate(template: string, params?: I18nParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
}

function defaultMissingKeyLogger(key: string, language: Lang): void {
  if (import.meta.env?.DEV) {
    console.warn(`[i18n] Missing message "${key}" for ${language}.`);
  }
}

/** Resolve from a loaded namespace, with Hebrew as the authoritative fallback. */
export function resolveMessage({
  language,
  key,
  catalogs,
  params,
  onMissingKey = defaultMissingKeyLogger,
}: ResolveMessageOptions): string {
  for (const catalog of Object.values(catalogs)) {
    const hebrew = catalog?.he[key];
    if (hebrew === undefined) continue;

    const localized = catalog?.[language][key];
    if (localized === undefined) onMissingKey(key, language);
    return interpolate(localized ?? hebrew, params);
  }

  onMissingKey(key, language);
  // Production must never expose internal message identifiers to members.
  return import.meta.env?.DEV ? key : "";
}

export function createI18nRuntime({
  language,
  core = coreCatalog,
  loaders,
  onNamespaceLoaded,
  onMissingKey,
}: CreateRuntimeOptions) {
  let activeLanguage = language;
  const catalogs: Catalogs = { core };
  const loadedOrder: MessageNamespace[] = ["core"];
  const inFlight = new Map<RoleMessageNamespace, Promise<void>>();
  const resolvedLoaders = { ...namespaceLoaders, ...loaders };

  async function ensureNamespace(namespace: RoleMessageNamespace): Promise<void> {
    if (catalogs[namespace]) return;
    const pending = inFlight.get(namespace);
    if (pending) return pending;

    const load = resolvedLoaders[namespace]()
      .then((catalog) => {
        catalogs[namespace] = catalog;
        loadedOrder.push(namespace);
        onNamespaceLoaded?.(namespace, catalog);
      })
      .finally(() => {
        inFlight.delete(namespace);
      });
    inFlight.set(namespace, load);
    return load;
  }

  return {
    async ensureNamespaces(namespaces: readonly RoleMessageNamespace[]): Promise<void> {
      for (const namespace of [...new Set(namespaces)]) {
        await ensureNamespace(namespace);
      }
    },
    hasNamespace(namespace: MessageNamespace): boolean {
      return Boolean(catalogs[namespace]);
    },
    loadedNamespaces(): MessageNamespace[] {
      return [...loadedOrder];
    },
    setLanguage(nextLanguage: Lang): void {
      activeLanguage = nextLanguage;
    },
    t(key: string, params?: I18nParams): string {
      return resolveMessage({
        language: activeLanguage,
        key,
        catalogs,
        params,
        onMissingKey,
      });
    },
    tForLanguage(targetLanguage: Lang, key: string, params?: I18nParams): string {
      return resolveMessage({
        language: targetLanguage,
        key,
        catalogs,
        params,
        onMissingKey,
      });
    },
  };
}
