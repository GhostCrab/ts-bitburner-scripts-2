import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([
        ["target", "n00dles"],
        ["hackLvlTiming", 1],
    ]);
    await ns.weaken(flags["target"], {
        hackOverrideTiming: flags["hackLvlTiming"],
    });
}
