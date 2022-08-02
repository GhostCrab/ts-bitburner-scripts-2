import { NS } from "@ns";
import { Augmentation } from "/lib/augmentation/augmentation";
import { doBuyAndSoftenAll, getAugmentationPriceMultiplier } from "/lib/util";

enum ControllerState {
    init = -1,
    rep,
    hack,
    exp,
    join,
    cct,
    buying,
}

const CS = ControllerState;

const HOME_RESERVE_RAM = 128;

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

    if (ns.getRunningScript("clock.js", "home") === null) ns.exec("clock.js", "home");

    let state = CS.init;
    let waitPID = 0;
    let doExp = true;
    const [targetAug, installNonHackAugs] = getTargetAug(ns);
    let targetCash = getTargetCash(ns, targetAug);
    const favor = ns.singularity.getFactionFavor(targetAug.faction);
    const storedRep = Math.max(0, favorToRep(favor));
    const donateRep = favorToRep(ns.getFavorToDonate());
    const donateRep15Percent = donateRep * 0.15;
    let repPerSec = ns.getPlayer().workRepGainRate * 5;

    // update targetAug.rep to something managable
    if (favor < ns.getFavorToDonate() && targetAug.rep > favorToRep(ns.getFavorToDonate())) {
        if (storedRep < donateRep15Percent) {
            targetAug.rep = donateRep15Percent - storedRep;
            targetCash = 0;
        } else if (storedRep < donateRep) {
            targetAug.rep = donateRep - storedRep;
            targetCash = 0;
        }
    }

    // update targetCash if we will need to donate to get the target aug
    if (favor >= ns.getFavorToDonate()) {
        targetCash += 1e6 * (targetAug.rep / ns.getPlayer().faction_rep_mult);
    }

    const port = ns.getPortHandle(2);
    port.clear();
    port.write(JSON.stringify([targetAug.faction, targetAug.rep, targetCash]));
    const stateInterval = setInterval(() => {
        const runningScript = ns.getRunningScript(waitPID);

        if (runningScript && state === CS.rep) {
            repPerSec = ns.getPlayer().workRepGainRate * 5;
        }

        // detect state transition
        if (runningScript === null) {
            waitPID = 0;
            switch (state) {
                case CS.init:
                case CS.buying:
                    state = CS.rep;
                    break;
                case CS.rep:
                    state = CS.hack;
                    break;
                case CS.hack:
                    if (doExp) {
                        state = CS.exp;
                        doExp = false;
                    } else {
                        state = CS.join;
                    }
                    break;
                case CS.exp:
                    state = CS.join;
                    break;
                case CS.join:
                    state = CS.cct;
                    break;
                case CS.cct:
                    state = CS.buying;
                    break;
            }
        }

        // if no processes are running, try to run one depending on the current state
        if (waitPID === 0) {
            const incomePerSec = ns.getScriptIncome(ns.getScriptName(), "home", ...ns.args);
            const secondsToTargetCash = incomePerSec > 0 ? (targetCash - ns.getPlayer().money) / incomePerSec : 0;

            switch (state) {
                case CS.rep:
                    waitPID = ns.exec("share.js", "home", 1, "--reserve", 0, "--timer", 2.5);
                    break;
                case CS.hack: {
                    const currentRep =
                        ns.singularity.getFactionRep(targetAug.faction) +
                        (ns.getPlayer().currentWorkFactionName === targetAug.faction
                            ? ns.getPlayer().workRepGained
                            : 0);

                    const secondsToTargetRep = repPerSec > 0 ? (targetAug.rep - currentRep) / repPerSec : 0;
                    const maxTargetTime = Math.max(secondsToTargetCash, secondsToTargetRep, 10 * 60);

                    if (targetCash - ns.getPlayer().money <= 0) {
                        waitPID = ns.exec("hack.js", "home", 1, "--limit", maxTargetTime / 60, "--rounds", 1);
                    } else {
                        waitPID = ns.exec(
                            "hack.js",
                            "home",
                            1,
                            "--limit",
                            maxTargetTime / 60,
                            "--rounds",
                            1,
                            "--goal",
                            targetCash - ns.getPlayer().money
                        );
                    }
                    break;
                }
                case CS.exp:
                    doBuyAndSoftenAll(ns);
                    waitPID = ns.exec("exp.js", "home", 1, "--reserve", HOME_RESERVE_RAM, "--timer", 60);
                    break;
                case CS.join:
                    waitPID = ns.exec("join.js", "home", 1, "-c");
                    break;
                case CS.cct:
                    if (ns.getPlayer().factions.length > 0) waitPID = ns.exec("cct.js", "home", 1);
                    break;
                case CS.buying:
                    if (secondsToTargetCash > 20 * 60) {
                        if (ns.getPlayer().money > ns.singularity.getUpgradeHomeRamCost())
                            ns.singularity.upgradeHomeRam();

                        waitPID = ns.exec("buy_server_all.js", "home", 1, "-qe");
                    } else {
                        if (ns.getPlayer().money - targetCash > ns.singularity.getUpgradeHomeRamCost())
                            ns.singularity.upgradeHomeRam();

                        waitPID = ns.exec("buy_server_all.js", "home", 1, "--reserve", targetCash, "-qe");
                    }

                    break;
            }
        }
    });

    while (true) {
        const currentRep =
            ns.singularity.getFactionRep(targetAug.faction) +
            (ns.getPlayer().currentWorkFactionName === targetAug.faction ? ns.getPlayer().workRepGained : 0);

        // If we have the red pill and we can hack the world daemon, ascend
        if (
            ns.getHackingLevel() >= ns.getServerRequiredHackingLevel("w0r1d_d43m0n") &&
            ns.singularity.getOwnedAugmentations().includes("The Red Pill")
        )
            ns.exec("ascend.js", "home");

        // If we havent joined the target faction yet, try to join it and get to work
        if (ns.singularity.checkFactionInvitations().includes(targetAug.faction)) {
            ns.singularity.joinFaction(targetAug.faction);
            ns.singularity.workForFaction(targetAug.faction, "Hacking Contracts", true);
        }

        if (ns.getPlayer().currentWorkFactionName !== targetAug.faction) {
            ns.singularity.workForFaction(targetAug.faction, "Hacking Contracts", true);
        }

        // Check to see if we can install augs and reset
        if ((favor >= ns.getFavorToDonate() || currentRep >= targetAug.rep) && ns.getPlayer().money >= targetCash) {
            clearInterval(stateInterval);

            ns.singularity.stopAction();

            if (favor >= ns.getFavorToDonate() && currentRep < targetAug.rep) {
                const donateAmt = 1e6 * ((targetAug.rep - currentRep) / ns.getPlayer().faction_rep_mult);
                ns.singularity.donateToFaction(targetAug.faction, donateAmt);
            }

            const baFlags = installNonHackAugs ? "-gn" : "-g";
            const mcpPID = ns.exec("buy_augs.js", "home", 1, baFlags);
            while (ns.getRunningScript(mcpPID) !== null) await ns.asleep(10);

            ns.exec("reset.js", "home", 1);
        }

        await ns.asleep(1000);
    }
}

function getTargetAug(ns: NS): [Augmentation, boolean] {
    // check to see what faction should be targeted
    // 1) tian di hui 6.25k - Social Negotiation Assistant (S.N.A)
    // 2) cybersec to 10k - Cranial Signal Processors - Gen I
    // 3) Nitesec 45k - CRTX42-AA Gene Modification
    // 4) The Black Hand 100k
    // 5) Bitrunners repToDonate() * 0.15
    // 6) Bitrunners repToDonate()
    // 7) Bitrunners Donate
    // 8) Daedalus repToDonate() * 0.15
    // 9) Daedalus repToDonate()
    // 10) Daedalus Donate
    // 11) World Daemon

    let targetAug: Augmentation | undefined;
    let installNonHackAugs = false;
    for (const augTarget of augTargets) {
        targetAug = new Augmentation(ns, augTarget.aug, augTarget.faction);
        installNonHackAugs = !!augTarget.allbuy;
        if (!targetAug.owned) break;
    }

    // if we're out of augs to purchase (end of line is TRP), buy 10 NFGs from BitRunners at a time
    if (!targetAug || targetAug.owned) {
        const multmult = getAugmentationPriceMultiplier(ns);
        targetAug = new Augmentation(ns, "NeuroFlux Governor", "BitRunners");
        for (let i = 0; i < 10; i++) {
            targetAug.rep *= 1.14;
            targetAug.price = targetAug.price * 1.14 * multmult;
        }
        return [targetAug, true];
    }

    // override target aug if we're targeting Daedalus but we dont have enough augments banked
    if (
        targetAug.faction === "Daedalus" &&
        ns.singularity.getOwnedAugmentations().length < ns.getBitNodeMultipliers().DaedalusAugsRequirement
    ) {
        for (const augTarget of backupTargets) {
            targetAug = new Augmentation(ns, augTarget.aug, augTarget.faction);
            installNonHackAugs = !!augTarget.allbuy;
            if (!targetAug.owned) break;
        }
    }

    return [targetAug, installNonHackAugs];
}

function getTargetCash(ns: NS, targetAug: Augmentation): number {
    if (targetAug.name === "NeuroFlux Governor") return targetAug.price;

    let targetCash = 0;
    const multmult = getAugmentationPriceMultiplier(ns);
    const augs = ns.singularity
        .getAugmentationsFromFaction(targetAug.faction)
        .map((name) => {
            return new Augmentation(ns, name, targetAug.faction);
        })
        .filter((a) => a.rep <= targetAug.rep && !a.owned && !a.installed)
        .sort((a, b) => a.rep - b.rep);
    let multpow = 0;
    for (const aug of augs) {
        targetCash += aug.price * Math.pow(multmult, multpow);
        multpow++;
    }

    return targetCash;
}