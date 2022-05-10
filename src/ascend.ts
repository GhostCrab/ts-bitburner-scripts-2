import { NS } from "@ns";
import { permlog, stFormat } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    await permlog(
        ns,
        "Ascending after %s [%s since the start of BitNode %s]",
        stFormat(ns, ns.getPlayer().playtimeSinceLastAug),
        stFormat(ns, ns.getPlayer().playtimeSinceLastBitnode),
        ns.getPlayer().bitNodeN
    );
    ns.singularity.destroyW0r1dD43m0n(9, "starter.js");
}
