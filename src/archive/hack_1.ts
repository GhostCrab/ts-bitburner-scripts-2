// DESCRIPTION: Slow hack using minimal footprint


import { NS } from "@ns";
import { allHosts, HACKJS, GROWJS, WEAKENJS } from "/lib/util";

async function doWeaken(ns: NS, targetHostname: string, ownedHostnames: string[]): Promise<void> {
    // check to see if we need to weaken the server
    const targetSecurityLevel = Math.max(
        ns.getServerMinSecurityLevel(targetHostname) * 1.15,
        ns.getServerMinSecurityLevel(targetHostname) + 3
    );
    if (ns.getServerSecurityLevel(targetHostname) > targetSecurityLevel) {
        while (ns.getServerSecurityLevel(targetHostname) > ns.getServerMinSecurityLevel(targetHostname)) {
            ns.tprintf(
                "Weaken %s: %f > %f",
                targetHostname,
                ns.getServerSecurityLevel(targetHostname),
                targetSecurityLevel
            );
            let waitPID = 0;
            for (const hostname of ownedHostnames) {
                const availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
                const threads = Math.floor(availableRam / ns.getScriptRam(WEAKENJS));
                if (threads <= 0) continue;
                waitPID = ns.exec(
                    WEAKENJS,
                    hostname,
                    threads,
                    "--target",
                    targetHostname,
                    "--hackLvlTiming",
                    ns.getHackingLevel()
                );
            }

            while (ns.getRunningScript(waitPID) !== null) {
                await ns.sleep(100);
            }
            // wait a little bit longer to make sure everything else finished too
            await ns.sleep(500);
        }
    }

    ns.tprintf(
        "Finished weakening %s (%f / %f)",
        targetHostname,
        ns.getServerMinSecurityLevel(targetHostname),
        ns.getServerSecurityLevel(targetHostname)
    );
}

async function doGrow(ns: NS, targetHostname: string, ownedHostnames: string[]): Promise<void> {
    while (ns.getServerMoneyAvailable(targetHostname) < ns.getServerMaxMoney(targetHostname)) {
        ns.tprintf(
            "Grow %s: %s < %s",
            targetHostname,
            ns.nFormat(ns.getServerMoneyAvailable(targetHostname), "$0.000a"),
            ns.nFormat(ns.getServerMaxMoney(targetHostname), "$0.000a")
        );
        let waitPID = 0;
        for (const hostname of ownedHostnames) {
            const availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
            const threads = Math.floor(availableRam / ns.getScriptRam(GROWJS));
            if (threads <= 0) continue;
            waitPID = ns.exec(
                GROWJS,
                hostname,
                threads,
                "--target",
                targetHostname,
                "--hackLvlTiming",
                ns.getHackingLevel()
            );
        }

        while (ns.getRunningScript(waitPID) !== null) {
            await ns.sleep(100);
        }
        // wait a little bit longer to make sure everything else finished too
        await ns.sleep(500);

        await doWeaken(ns, targetHostname, ownedHostnames);
    }

    ns.tprintf(
        "Finished growing %s (%s / %s)",
        targetHostname,
        ns.nFormat(ns.getServerMoneyAvailable(targetHostname), "$0.000a"),
        ns.nFormat(ns.getServerMaxMoney(targetHostname), "$0.000a")
    );
}

async function doHack(ns: NS, targetHostname: string, ownedHostnames: string[]): Promise<void> {
    const targetMoneyAvailable = ns.getServerMaxMoney(targetHostname) * 0.8;
    while (ns.getServerMoneyAvailable(targetHostname) > targetMoneyAvailable) {
        ns.tprintf(
            "Hack %s %s > %s",
            targetHostname,
            ns.nFormat(ns.getServerMoneyAvailable(targetHostname), "$0.000a"),
            ns.nFormat(targetMoneyAvailable, "$0.000a")
        );
        let waitPID = 0;
        for (const hostname of ownedHostnames) {
            const availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
            const threads = Math.floor(availableRam / ns.getScriptRam(HACKJS));
            if (threads <= 0) continue;
            waitPID = ns.exec(
                HACKJS,
                hostname,
                threads,
                "--target",
                targetHostname,
                "--hackLvlTiming",
                ns.getHackingLevel(),
                "--hackLvlEffect",
                ns.getHackingLevel()
            );
        }

        while (ns.getRunningScript(waitPID) !== null) {
            await ns.sleep(100);
        }
        // wait a little bit longer to make sure everything else finished too
        await ns.sleep(500);
    }

    ns.tprintf("Finished hacking %s", targetHostname);
}

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([["target", "n00dles"]]);

    const targetHostname = flags["target"];

    if (!ns.serverExists(targetHostname)) {
        ns.tprintf("ERROR: Cannot hack %s: Server does not exist", targetHostname);
        return;
    }

    if (!ns.hasRootAccess(targetHostname)) {
        ns.tprintf("ERROR: Cannot hack %s: No root access", targetHostname);
        return;
    }

    if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(targetHostname)) {
        ns.tprintf(
            "ERROR: Cannot hack %s: Insufficient hacking experience %d < %d",
            targetHostname,
            ns.getHackingLevel(),
            ns.getServerRequiredHackingLevel(targetHostname)
        );
        return;
    }

    // collect all available ram
    const allHostnames = allHosts(ns);
    const ownedHostnames = allHostnames.filter((a) => ns.hasRootAccess(a));

    // trasfer hacking scripts to the hosts
    for (const hostname of ownedHostnames.filter((a) => a !== "home")) {
        await ns.scp(HACKJS, hostname);
        await ns.scp(GROWJS, hostname);
        await ns.scp(WEAKENJS, hostname);
    }

    while (true) {
        await doWeaken(ns, targetHostname, ownedHostnames);
        await doGrow(ns, targetHostname, ownedHostnames);
        await doHack(ns, targetHostname, ownedHostnames);
    }
}
