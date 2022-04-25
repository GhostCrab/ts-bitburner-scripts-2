import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
    for (const faction of ns.checkFactionInvitations()) {
        ns.joinFaction(faction);
    }


    ns.singularity.softReset(ns.getScriptName());
}