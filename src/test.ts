import { NS } from "@ns";
import { permlog, stFormat } from "/lib/util";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main(ns: NS): Promise<void> {
    const augnames = ns.singularity.getAugmentationsFromFaction("BitRunners");
    await permlog(ns, "Resetting after %s [%s since the start of BitNode %s]", stFormat(ns, ns.getPlayer().playtimeSinceLastAug), stFormat(ns, ns.getPlayer().playtimeSinceLastBitnode), ns.getPlayer().bitNodeN);
    await permlog(ns, "%s (%d):", ns.getPlayer().factions[0], ns.singularity.getFactionRep(ns.getPlayer().factions[0]));
    for (const augname of augnames) {
        await permlog(ns, "  %s", augname);
    }
}
