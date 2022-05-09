import { NS } from "@ns";

// TODO: Joining factions gives a small amount of int xp.
// With singularity functions, soft reset, and the 10 corp factions you can create a script that farms int xp rather quickly.
// This would be faster than the below travel-based method, which has been nerfed quite heavily

/** @param {NS} ns
 * Script contributed by https://github.com/ShawnPatton
 * Concept: A small amount of intelligence is granted when you (successfully) travel to a new city. This script converts money into intelligence exp! **/
export async function main(ns: NS): Promise<void> {
    //disableLogs(ns, ["travelToCity", "sleep"]);
    ns.tail();
    const tripsPerCycle = 1000;
    const moneyThreshold = 1000000000000;
    let previousInt = ns.getPlayer().intelligence;
    let currentInt = previousInt;
    let previousLevelTime = Date.now();
    let levelupTime;
    let cycles = 0;
    let duration = 0;
    let tripsPerLevel = 0;
    let tripsPerMs = 0;
    ns.print(`Starting Script at Int ` + currentInt);
    while (true) {
        while (ns.getPlayer().money > moneyThreshold) {
            for (let i = 0; i < tripsPerCycle; i++) {
                ns.singularity.travelToCity("Aevum");
                ns.singularity.travelToCity("Sector-12");
            }
            await ns.sleep(1);
            cycles++;
            if (previousInt != ns.getPlayer().intelligence) {
                currentInt = ns.getPlayer().intelligence;
                levelupTime = Date.now();
                duration = levelupTime - previousLevelTime;
                tripsPerLevel = cycles * tripsPerCycle * 2;
                tripsPerMs = Math.floor(tripsPerLevel / duration);
                // ns.print(`Level Up: Int ` + currentInt + (justStarted ? ` Partial` : ` Full`) + ` Level in `
                //     + formatDuration(duration) + ` & ` + formatNumberShort(tripsPerLevel) + ` Travels`);
                ns.print(`Approximately ` + tripsPerMs + ` Trips/Millisecond`);
                previousLevelTime = levelupTime;
                previousInt = currentInt;
                cycles = 0;
            }
        }
        await ns.sleep(10000);
        ns.print(`Below money threshold, waiting 10 seconds`);
    }
}
