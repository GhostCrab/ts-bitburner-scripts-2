import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.singularity.stopAction();

    while (ns.singularity.upgradeHomeRam()) await ns.sleep(10);
    while (ns.singularity.upgradeHomeCores()) await ns.sleep(10);

    const joinPID = ns.exec("join.js", "home");
    while (ns.getRunningScript(joinPID) !== null) await ns.sleep(10);

    const cctPID = ns.exec("cct.js", "home", 1);
    while (ns.getRunningScript(cctPID) !== null) await ns.sleep(10);

    const mcpPID = ns.exec("buy_augs.js", "home", 1, "-ng");
    while (ns.getRunningScript(mcpPID) !== null) await ns.sleep(10);

    ns.singularity.installAugmentations("controller.js");

    // in case install fails because we dont have any augs to install
    ns.singularity.softReset("controller.js");
}
