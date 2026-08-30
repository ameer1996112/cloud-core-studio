import { Audit } from "lighthouse/core/audits/audit.js";
import BaseGatherer from "lighthouse/core/gather/base-gatherer.js";

function readRouteDom() {
  const mainClasses = Array.from(document.querySelectorAll("main")).flatMap((element) => [
    ...element.classList,
  ]);
  const mainContent = document.querySelector("main#main-content");
  return {
    finalPathname: window.location.pathname,
    mainClasses,
    rootErrorBoundaryVisible: Boolean(mainContent?.querySelector("h1.text-3xl")),
    documentLanguage: document.documentElement.lang,
    documentDirection: document.documentElement.dir,
  };
}

export class RouteDomGatherer extends BaseGatherer {
  meta = { supportedModes: ["navigation"] };

  async getArtifact(context) {
    return context.driver.executionContext.evaluate(readRouteDom, {
      args: [],
      useIsolation: true,
    });
  }
}

export class RouteDomAudit extends Audit {
  static get meta() {
    return {
      id: "route-dom-validity",
      title: "Captured the final route DOM",
      failureTitle: "Could not capture the final route DOM",
      description:
        "Captures route identity and localization from the navigation Lighthouse scores.",
      requiredArtifacts: ["RouteDom"],
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
    };
  }

  static audit(artifacts) {
    return { score: 1, value: artifacts.RouteDom.finalPathname };
  }
}
