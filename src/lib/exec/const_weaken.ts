import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([["target", "n00dles"]]);
    while (true) await ns.weaken(flags["target"]);
}
