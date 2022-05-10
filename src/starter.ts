import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    while (true) {
        if (ns.getServerMaxRam("home") >= 128) {
            ns.run("mcp.js");
            break;
        }

        const hackPID = ns.exec("hack.js", "home", 1, "--limit", 10, "--rounds", 1);
        while (ns.getRunningScript(hackPID) !== null) await ns.sleep(100);

        const cctPID = ns.exec("cct.js", "home", 1);
        while (ns.getRunningScript(cctPID) !== null) await ns.sleep(10);

        while (ns.singularity.upgradeHomeRam()) await ns.sleep(10);

        const joinPID = ns.exec("join.js", "home", 1, "-t", "Tian Di Hui");
        while (ns.getRunningScript(joinPID) !== null) await ns.sleep(100);

        ns.singularity.workForFaction("Tian Di Hui", "Hacking Contracts", true);
    }
}