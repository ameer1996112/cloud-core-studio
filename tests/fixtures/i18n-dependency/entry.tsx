import "./edge.functions";
import "./edge.client";

declare const t: (key: string) => string;

void import("./edge.server");

export const fixtureNode = <option value="">{t("admin.classes.selectRoom")}</option>;
