import { useEffect } from "react";
import type { Ambiance } from "@/lib/game-content";

/** Applique l'ambiance ("irl" / "distance") au <body> via un attribut data-ambiance.
 *  Le CSS dans styles.css fait le fondu des couleurs. */
export function AmbianceTheme({ ambiance }: { ambiance: Ambiance | null | undefined }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const amb: Ambiance = ambiance === "distance" ? "distance" : "irl";
    document.body.setAttribute("data-ambiance", amb);
    return () => {
      // ne pas reset au démontage : on garde la dernière ambiance choisie
    };
  }, [ambiance]);
  return null;
}
