export type Lang = "en" | "he" | "ar";

export type MessageNamespace = "core" | "member" | "instructor" | "admin";
export type RoleMessageNamespace = Exclude<MessageNamespace, "core">;

export type I18nParams = Record<string, string | number | null | undefined>;
export type MessageDictionary = Readonly<Record<string, string>>;

/**
 * Every namespace carries the complete Hebrew source-of-truth plus its English
 * and Arabic translations. Runtime lookup always falls back to the Hebrew map.
 */
export type LocalizedCatalog = Readonly<Record<Lang, MessageDictionary>>;

export type NamespaceModule = Readonly<{
  catalog: LocalizedCatalog;
}>;

export type NamespaceLoader = () => Promise<LocalizedCatalog>;
