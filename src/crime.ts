import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("sleep");
    ns.tail();

    // const crimes = [
    //     "shoplift",
    //     "rob store",
    //     "mug",
    //     "larceny",
    //     "drugs",
    //     "bond forge",
    //     "traffick arms",
    //     "homicide",
    //     "grand auto",
    //     "kidnap",
    //     "assassinate",
    //     "heist",
    // ];

    // for (const crimename of crimes) {
    //     const crimeStats = ns.getCrimeStats(crimename);
    //     ns.tprintf("%16s  %9s %5s %9s/s", crimeStats.name, ns.nFormat(crimeStats.money, "($0.000a)"), stFormat(ns, crimeStats.time, false), ns.nFormat(crimeStats.money / (crimeStats.time / 1000), "($0.000a)"));
    // }

    let dynamic = true;
    let crime = "shoplift";
    if (ns.args[0]) {
        crime = ns.args[0].toString();
        dynamic = false;
    }

    while (true) {
        if (dynamic) {
            if (ns.singularity.getCrimeChance("mug") > 0.7) crime = "mug";
            if (ns.singularity.getCrimeChance("homicide") > 0.7) crime = "homicide";
        }
        await ns.sleep(ns.singularity.commitCrime(crime) + 200);
    }

    ns.singularity.workForFaction("NiteSec", "Field Work");
}
