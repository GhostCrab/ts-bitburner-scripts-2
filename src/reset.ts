import { NS } from "@ns";
import { permlog, stFormat } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    ns.singularity.stopAction();

    const mainFaction = ns.getPlayer().factions[0];
    const ownedAugs = ns.singularity
        .getOwnedAugmentations(true)
        .filter((a) => !ns.singularity.getOwnedAugmentations().includes(a));

    const joinPID = ns.exec("join.js", "home");
    while (ns.getRunningScript(joinPID) !== null) await ns.sleep(10);

    const cctPID = ns.exec("cct.js", "home", 1);
    while (ns.getRunningScript(cctPID) !== null) await ns.sleep(10);

    while (ns.singularity.upgradeHomeRam()) await ns.sleep(10);
    while (ns.singularity.upgradeHomeCores()) await ns.sleep(10);

    const mcpPID = ns.exec("buy_augs.js", "home", 1, "-ng");
    while (ns.getRunningScript(mcpPID) !== null) await ns.sleep(10);

    await permlog(
        ns,
        "Resetting after %s [%s since the start of BitNode %s]",
        stFormat(ns, ns.getPlayer().playtimeSinceLastAug),
        stFormat(ns, ns.getPlayer().playtimeSinceLastBitnode),
        ns.getPlayer().bitNodeN
    );
    await permlog(ns, "%s (%d):", mainFaction, ns.singularity.getFactionRep(mainFaction));
    for (const augname of ownedAugs) {
        await permlog(ns, "  %s", augname);
    }

    ns.singularity.installAugmentations("mcp.js");

    // in case install fails because we dont have any augs to install
    ns.singularity.softReset("mcp.js");
}
