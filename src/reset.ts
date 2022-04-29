import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    while (ns.upgradeHomeRam()) await ns.sleep(0);
    while (ns.upgradeHomeCores()) await ns.sleep(0);

    const joinPID = ns.exec("join.js", "home");
    while (ns.getRunningScript(joinPID) !== null) await ns.sleep(0);

    const cctPID = ns.exec("cct.js", "home", 1);
    await ns.sleep(500);
    ns.kill(cctPID);

    const mcpPID = ns.exec("mcp.js", "home", 1, "-ng");
    while (ns.getRunningScript(mcpPID) !== null) await ns.sleep(0);

    ns.installAugmentations("controller.js");
}
