import { NS } from "@ns";
import { Augmentation } from "/lib/augmentation/augmentation";
import { allHosts, CONSTWEAKENJS, doBuyAndSoftenAll } from "/lib/util";
import { ServerService } from "/services/server";

const HOME_RESERVE_RAM = 128;

function favorToRep(f: number) {
    const raw = 25000 * (Math.pow(1.02, f) - 1);
    return Math.round(raw * 10000) / 10000; // round to make things easier.
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("disableLog");
    ns.disableLog("sleep");
    ns.disableLog("brutessh");
    ns.disableLog("ftpcrack");
    ns.disableLog("httpworm");
    ns.disableLog("relaysmtp");
    ns.disableLog("sqlinject");
    ns.disableLog("nuke");

    //ns.tail();
    const serverService = new ServerService(ns);

    if (ns.getRunningScript("clock.js", "home") === null) ns.exec("clock.js", "home");

    let doExp = true;
    //const msToRep = 0;
    let doServerBuys = true;
    while (true) {
        const hackPID = ns.exec("hack.js", "home", 1, "--limit", 10, "--rounds", 1);
        while (ns.getRunningScript(hackPID) !== null) await ns.sleep(100);

        if (ns.getPlayer().factions.length > 0) {
            const cctPID = ns.exec("cct.js", "home", 1);
            while (ns.getRunningScript(cctPID) !== null) await ns.sleep(10);
        }

        // if we have the red pill and we can hack the world daemon, ascend
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel("w0r1d_d43m0n")) ns.exec("ascend.js", "home");

        const joinPID = ns.exec("join.js", "home", 1, "-c");
        while (ns.getRunningScript(joinPID) !== null) await ns.sleep(100);

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

        type AugTarget = {
            faction: string;
            aug: string;
            allbuy?: boolean;
        };

        const augTargets: AugTarget[] = [
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
                faction: "Chongqing",
                aug: "Neuregen Gene Modification",
                allbuy: true,
            },
            {
                faction: "BitRunners",
                aug: "Embedded Netburner Module Core V2 Upgrade",
            },
            {
                faction: "Daedalus",
                aug: "The Red Pill",
            },
        ];

        const backupTargets: AugTarget[] = [
            {
                faction: "Sector-12", // +3 augs
                aug: "CashRoot Starter Kit", // 12.5k
                allbuy: true,
            },
            {
                faction: "Ishima", // +2 augs
                aug: "INFRARET Enhancement", // 7.5k
                allbuy: true,
            },
            {
                faction: "Volhaven", // +2 augs
                aug: "Combat Rib II", // 18.75k
                allbuy: true,
            },
            {
                faction: "New Tokyo", // +1 aug
                aug: "NutriGen Implant", // 6.25k
                allbuy: true,
            },
            {
                faction: "Tian Di Hui", // +2 augs
                aug: "Neuroreceptor Management Implant", // 75k
                allbuy: true,
            },
            {
                faction: "Aevum", // +1 aug
                aug: "PCMatrix", // 100k
                allbuy: true,
            },
        ];

        let doInstall = false;
        let allInstalled = true;
        let installNonHackAugs = false;
        for (const augTarget of augTargets) {
            let targetAug = new Augmentation(ns, augTarget.aug, augTarget.faction);
            if (targetAug.owned) continue;

            let targetFaction = augTarget.faction;
            installNonHackAugs = !!augTarget.allbuy;

            // override target aug if we're targeting Daedalus but we dont have enough augments banked
            if (
                augTarget.faction === "Daedalus" &&
                ns.singularity.getOwnedAugmentations().length < ns.getBitNodeMultipliers().DaedalusAugsRequirement
            ) {
                ns.tprintf("Overriding Daedalus");
                for (const altAugTarget of backupTargets) {
                    const altTargetAug = new Augmentation(ns, altAugTarget.aug, altAugTarget.faction);
                    if (altTargetAug.owned) continue;

                    targetAug = new Augmentation(ns, altAugTarget.aug, altAugTarget.faction);
                    targetFaction = altAugTarget.faction;
                    installNonHackAugs = !!altAugTarget.allbuy;

                    ns.tprintf("Overriding Daedalus => %s", targetFaction);

                    break;
                }
            }

            let targetRepDisp = targetAug.rep;

            const augs = ns.singularity
                .getAugmentationsFromFaction(targetFaction)
                .map((name) => {
                    return new Augmentation(ns, name, targetFaction);
                })
                .filter((a) => a.rep <= targetAug.rep && !a.owned && !a.installed)
                .sort((a, b) => a.rep - b.rep);
            let goalCost = 0;
            let multpow = 0;
            const srcFile11 = ns.getOwnedSourceFiles().find((x) => x.n === 11);
            const srcFile11Lvl = srcFile11 ? srcFile11.lvl : 0;
            const multmult = 1.9 * [1, 0.96, 0.94, 0.93][srcFile11Lvl];
            for (const aug of augs) {
                goalCost += aug.price * Math.pow(multmult, multpow);
                multpow++;
            }

            let overrideDoInstall = false;
            allInstalled = false;
            if (ns.singularity.checkFactionInvitations().includes(targetFaction))
                ns.singularity.joinFaction(targetFaction);
            ns.singularity.workForFaction(targetFaction, "Hacking Contracts", true);

            if (targetAug.purchaseable) doInstall = true;

            if (targetAug.rep > favorToRep(ns.getFavorToDonate())) {
                const favor = ns.singularity.getFactionFavor(targetFaction);
                const targetRep = favorToRep(ns.getFavorToDonate());
                const currentRep =
                    ns.singularity.getFactionRep(targetFaction) +
                    (ns.getPlayer().currentWorkFactionName === targetFaction ? ns.getPlayer().workRepGained : 0);
                const storedRep = Math.max(0, favorToRep(favor));
                const targetRep15Percent = targetRep * 0.15;
                const totalRep = currentRep + storedRep;

                // first pass
                if (totalRep < targetRep15Percent && favor < 25) {
                    targetRepDisp = targetRep15Percent;
                    // const repGainPerMS = (ns.getPlayer().workRepGainRate * 5) / 1000;
                    // const msToRep = (targetRep15Percent - totalRep) / repGainPerMS;

                    // ns.tprintf(
                    //     "Time For %s %d => %d: %s",
                    //     targetFaction,
                    //     totalRep,
                    //     targetRep15Percent,
                    //     stFormat(ns, msToRep)
                    // );
                }
                if (totalRep >= targetRep15Percent && favor < 25) {
                    overrideDoInstall = true;
                    doInstall = true;
                }

                // second pass
                if (totalRep > targetRep15Percent && totalRep < targetRep && favor < ns.getFavorToDonate()) {
                    targetRepDisp = targetRep;
                    // const repGainPerMS = (ns.getPlayer().workRepGainRate * 5) / 1000;
                    // const msToRep = (targetRep - totalRep) / repGainPerMS;

                    // ns.tprintf("Time For %s %d => %d: %s", targetFaction, totalRep, targetRep, stFormat(ns, msToRep));
                }
                if (totalRep > targetRep15Percent && totalRep > targetRep && favor < ns.getFavorToDonate()) {
                    overrideDoInstall = true;
                    doInstall = true;
                }

                // third pass
                if (favor > ns.getFavorToDonate() && currentRep < targetAug.rep) {
                    const donateAmt = 1e6 * ((targetAug.rep - currentRep) / ns.getPlayer().faction_rep_mult);
                    if (donateAmt < ns.getPlayer().money) {
                        ns.singularity.donateToFaction(targetFaction, donateAmt);
                        doInstall = true;
                    } else {
                        goalCost += donateAmt;
                    }
                }

                if (ns.getPlayer().money < goalCost && !overrideDoInstall) {
                    ns.tprintf("Controller: Target Cash %s", ns.nFormat(goalCost, "$0.000a"));
                    if (doInstall) doServerBuys = false;
                    doInstall = false;
                }
            }

            const port = ns.getPortHandle(2);
            port.clear();
            port.write(JSON.stringify([targetFaction, targetRepDisp, goalCost]));

            break;
        }

        if (doInstall) {
            ns.singularity.stopAction();

            const baFlags = installNonHackAugs ? "-gn" : "-g";
            const mcpPID = ns.exec("buy_augs.js", "home", 1, baFlags);
            while (ns.getRunningScript(mcpPID) !== null) await ns.sleep(10);

            const joinPID = ns.exec("join.js", "home", 1);
            while (ns.getRunningScript(joinPID) !== null) await ns.sleep(10);

            const cctPID = ns.exec("cct.js", "home", 1);
            while (ns.getRunningScript(cctPID) !== null) await ns.sleep(10);

            ns.exec("reset.js", "home", 1);
        }

        if (allInstalled) {
            // level up until we can hack the world daemon
            const srcFile11 = ns.getOwnedSourceFiles().find((x) => x.n === 11);
            const srcFile11Lvl = srcFile11 ? srcFile11.lvl : 0;
            const multmult = 1.9 * [1, 0.96, 0.94, 0.93][srcFile11Lvl];

            let ngPrice = ns.singularity.getAugmentationPrice("NeuroFlux Governor");
            let ngRepReq = ns.singularity.getAugmentationRepReq("NeuroFlux Governor");
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

        const servers = serverService.getScriptableServers(HOME_RESERVE_RAM);
        const availableRamBefore = servers.reduce((tally, server) => tally + server.availableRam(), 0);

        doBuyAndSoftenAll(ns);

        if (ns.getPlayer().money * 0.25 > ns.singularity.getUpgradeHomeRamCost()) ns.singularity.upgradeHomeRam();

        if (ns.getPlayer().money < 1000000000 && doServerBuys) {
            const bsaPID = ns.exec("buy_server_all.js", "home", 1, "--allow", 0.5, "-qe");
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

        // if we have the red pill and we can hack the world daemon, ascend
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel("w0r1d_d43m0n")) ns.exec("ascend.js", "home");

        await ns.sleep(100);
    }
}
