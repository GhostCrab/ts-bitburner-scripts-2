import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([
        ["target", "n00dles"],
        ["hackLvlTiming", 1],
        ["hackLvlEffect", 1],
    ]);
    await ns.hack(flags["target"], {
        hackOverrideTiming: flags["hackLvlTiming"],
        hackOverrideEffect: flags["hackLvlEffect"],
    });
}