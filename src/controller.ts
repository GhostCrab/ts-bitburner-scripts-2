import { NS } from "@ns";
import { Augmentation } from "/lib/augmentation/augmentation";
import { allHosts, CONSTWEAKENJS, doBuyAndSoftenAll, stFormat } from "/lib/util";
import { ServerService } from "/services/server";

const HOME_RESERVE_RAM = 128;

function favorToRep(f: number) {
    const raw = 25000 * (Math.pow(1.02, f) - 1);
    return Math.round(raw * 10000) / 10000; // round to make things easier.
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("disableLog");
    ns.disableLog("sleep");
    ns.tail();
    const serverService = new ServerService(ns);

    if (ns.getRunningScript("clock.js", "home") === null) ns.exec("clock.js", "home");

    let doExp = true;
    //const msToRep = 0;
    while (true) {
        const hackPID = ns.exec("hack.js", "home", 1, "--limit", 10, "--rounds", 1);
        while (ns.getRunningScript(hackPID) !== null) await ns.sleep(100);

        const servers = serverService.getScriptableServers(HOME_RESERVE_RAM);
        const availableRamBefore = servers.reduce((tally, server) => tally + server.availableRam(), 0);

        doBuyAndSoftenAll(ns);

        if (ns.getPlayer().money * 0.25 > ns.getUpgradeHomeRamCost()) ns.upgradeHomeRam();

        if (ns.getPlayer().money < 100000000000) {
            const bsaPID = ns.exec("buy_server_all.js", "home", 1, "-qe");
            while (ns.getRunningScript(bsaPID) !== null) await ns.sleep(100);
        } else {
            const bsaPID = ns.exec("buy_server_all.js", "home", 1, "--allow", 0.25, "-qe");
            while (ns.getRunningScript(bsaPID) !== null) await ns.sleep(100);
        }

        const availableRamAfter = servers.reduce((tally, server) => tally + server.availableRam(), 0);

        if (availableRamBefore < availableRamAfter || doExp) {
            doExp = false;

            ns.exec("exp.js", "home", 1, "--reserve", HOME_RESERVE_RAM);
            await ns.sleep(60 * 1000);

            // kill all weaken scripts
            const allHostnames = allHosts(ns);

            for (const hostname of allHostnames) {
                const processes = ns.ps(hostname).filter((a) => a.filename === CONSTWEAKENJS);

                for (const process of processes) {
                    ns.kill(process.pid);
                }
            }
        }

        if (ns.getPlayer().money > 100000000) {
            const joinPID = ns.exec("join.js", "home", 1, "-c");
            while (ns.getRunningScript(joinPID) !== null) await ns.sleep(100);
        }

        // check to see what faction should be targeted
        // 1) tian di hui 6.25k - Social Negotiation Assistant (S.N.A)
        // 2) cybersec to 10k - Cranial Signal Processors - Gen I
        // 3) Nitesec 45k - CRTX42-AA Gene Modification
        // 4) The Black Hand 100k
        // 5) Bitrunners 65k
        // 6) Bitrunners 385k
        // 7) Bitrunners Bribe
        // 8) Daedalus 65k
        // 9) Daedalus 385k
        // 10) Daedalus Bribe
        // 11) World Daemon

        const augTargets = [
            {
                faction: "Tian Di Hui",
                aug: "Social Negotiation Assistant (S.N.A)",
            },
            {
                faction: "CyberSec",
                aug: "Cranial Signal Processors - Gen I",
            },
            {
                faction: "NiteSec",
                aug: "CRTX42-AA Gene Modification",
            },
            {
                faction: "The Black Hand",
                aug: "The Black Hand",
            },
            {
                faction: "BitRunners",
                aug: "Embedded Netburner Module Core V2 Upgrade",
            },
            {
                faction: "Daedalus",
                aug: "The Red Pill",
            },
            {
                faction: "Chongqing",
                aug: "Neuregen Gene Modification",
            },
        ];

        let doInstall = false;
        let allInstalled = true;
        for (const augTarget of augTargets) {
            const targetAug = new Augmentation(ns, augTarget.aug, augTarget.faction);
            if (!targetAug.owned) {
                allInstalled = false;
                if (ns.checkFactionInvitations().includes(augTarget.faction)) ns.joinFaction(augTarget.faction);
                ns.workForFaction(augTarget.faction, "Hacking Contracts", true);

                if (targetAug.purchaseable) doInstall = true;

                if (targetAug.rep > favorToRep(ns.getFavorToDonate())) {
                    const favor = ns.getFactionFavor(augTarget.faction);
                    const targetRep = favorToRep(ns.getFavorToDonate());
                    const currentRep =
                        ns.getFactionRep(augTarget.faction) +
                        (ns.getPlayer().currentWorkFactionName === augTarget.faction
                            ? ns.getPlayer().workRepGained
                            : 0);
                    const storedRep = Math.max(0, favorToRep(favor));
                    const targetRep15Percent = targetRep * 0.15;
                    const totalRep = currentRep + storedRep;

                    // first pass
                    if (totalRep < targetRep15Percent && favor < 25) {
                        const repGainPerMS = (ns.getPlayer().workRepGainRate * 5) / 1000;
                        const msToRep = (targetRep15Percent - totalRep) / repGainPerMS;

                        ns.tprintf(
                            "Time For %s %d => %d: %s",
                            augTarget.faction,
                            totalRep,
                            targetRep15Percent,
                            stFormat(ns, msToRep)
                        );
                    }
                    if (totalRep >= targetRep15Percent && favor < 25) doInstall = true;

                    // second pass
                    if (totalRep < targetRep && favor < ns.getFavorToDonate()) {
                        const repGainPerMS = (ns.getPlayer().workRepGainRate * 5) / 1000;
                        const msToRep = (targetRep - totalRep) / repGainPerMS;

                        ns.tprintf(
                            "Time For %s %d => %d: %s",
                            augTarget.faction,
                            totalRep,
                            targetRep,
                            stFormat(ns, msToRep)
                        );
                    }
                    if (totalRep > targetRep && favor < ns.getFavorToDonate()) doInstall = true;

                    // third pass
                    if (favor > ns.getFavorToDonate() && currentRep < targetAug.rep) {
                        const donateAmt = 1e6 * ((targetAug.rep - currentRep) / ns.getPlayer().faction_rep_mult);
                        if (donateAmt < ns.getPlayer().money * 0.1) {
                            ns.donateToFaction(augTarget.faction, donateAmt);
                            doInstall = true;
                        }
                    }
                }

                break;
            }
        }

        if (doInstall) {
            ns.stopAction();

            const mcpPID = ns.exec("mcp.js", "home", 1, "-g");
            while (ns.getRunningScript(mcpPID) !== null) await ns.sleep(100);

            const joinPID = ns.exec("join.js", "home", 1);
            while (ns.getRunningScript(joinPID) !== null) await ns.sleep(100);

            const cctPID = ns.exec("cct.js", "home", 1);
            await ns.sleep(1000);
            ns.kill(cctPID);

            ns.exec("reset.js", "home", 1);
        }

        if (allInstalled) {
            // if we have the red pill and we can hack the world daemon, ascend
            if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel("w0r1d_d43m0n"))
                ns.exec("ascend.js", "home", 1);

            // level up until we can hack the world daemon
            const srcFile11 = ns.getOwnedSourceFiles().find((x) => x.n === 11);
            const srcFile11Lvl = srcFile11 ? srcFile11.lvl : 0;
            const multmult = 1.9 * [1, 0.96, 0.94, 0.93][srcFile11Lvl];

            let ngPrice = ns.getAugmentationPrice("NeuroFlux Governor");
            let ngRepReq = ns.getAugmentationRepReq("NeuroFlux Governor");
            let total = 0;
            for (let i = 0; i < 10; i++) {
                total += ngPrice;
                ngPrice = ngPrice * 1.14 * multmult;
                ngRepReq *= 1.14;
            }

            const donateAmt = 1e6 * (ngRepReq / ns.getPlayer().faction_rep_mult);
            if (donateAmt + total <= ns.getPlayer().money) {
                ns.exec("reset.js", "home", 1);
            }
        }

        await ns.sleep(100);
    }
}
