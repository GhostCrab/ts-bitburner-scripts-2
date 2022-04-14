import { NS } from "@ns";
import { allHosts, HACKJS, GROWJS, WEAKENJS, llog } from "/lib/util";

const HOME_RESERVE_RAM = 8;
const HACK_RAM = 1.7;
const GROW_RAM = 1.75;
const WEAKEN_RAM = 1.75;

function getHostAvailableRam(ns: NS, hostnames: string[]): number {
    return hostnames.reduce(
        (tally, hostname) =>
            tally +
            (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname)
                ? Math.max(
                      0,
                      ns.getServerMaxRam(hostname) -
                          ns.getServerUsedRam(hostname) -
                          (hostname === "home" ? HOME_RESERVE_RAM : 0)
                  )
                : 0),
        0
    );
}

type Batch = {
    hackThreads: number;
    growThreads: number;
    weakenHackThreads: number;
    weakenGrowThreads: number;
};

//for (const [i, value] of myArray.entries()) {

function hostRamBlocks(ns: NS, hostnames: string[]): number[] {
    const blocks: number[] = [];
    for (const hostname of hostnames) {
        let blockSize = ns.getServerMaxRam(hostname);
        if (hostname === "home") blockSize = Math.max(0, ns.getServerMaxRam(hostname) - HOME_RESERVE_RAM);
        if (blockSize > 0) blocks.push(blockSize);
    }
    return blocks;
}

function testAllocateBatches(ns: NS, hostnames: string[], batches: Batch[]): boolean {
    // all hack threads and grow threads need to be allocated in a block, weaken threads can be spread out
    const blocks = hostRamBlocks(ns, hostnames).sort((a, b) => a - b);

    // attempt to reserve hack threads
    for (const batch of batches) {
        const hackThreadBlockSize = batch.hackThreads * HACK_RAM;
        let hackReserveSuccess = false;
        for (const [i, blockSize] of blocks.entries()) {
            if (hackThreadBlockSize <= blockSize) {
                blocks[i] -= hackThreadBlockSize;
                hackReserveSuccess = true;
                break;
            }
        }

        if (!hackReserveSuccess) return false;
    }

    // attempt to reserve grow threads
    for (const batch of batches) {
        const growThreadBlockSize = batch.growThreads * GROW_RAM;
        let growReserveSuccess = false;
        for (const [i, blockSize] of blocks.entries()) {
            if (growThreadBlockSize <= blockSize) {
                blocks[i] -= growThreadBlockSize;
                growReserveSuccess = true;
                break;
            }
        }
        if (!growReserveSuccess) return false;
    }

    // attempt to reserve weaken threads
    for (const batch of batches) {
        let weakenThreadsRemaining = batch.weakenGrowThreads + batch.weakenHackThreads;
        for (const [i, blockSize] of blocks.entries()) {
            if (WEAKEN_RAM <= blockSize) {
                const weakenThreadsAllocate = Math.min(weakenThreadsRemaining, Math.floor(blockSize / WEAKEN_RAM));

                blocks[i] -= weakenThreadsAllocate * WEAKEN_RAM;
                weakenThreadsRemaining -= weakenThreadsAllocate;

                if (weakenThreadsRemaining <= 0) break;
            }
        }

        if (weakenThreadsRemaining > 0) return false;
    }

    return true;
}

function testAllocateThreads(
    ns: NS,
    hostnames: string[],
    hackThreads: number,
    growThreads: number,
    weakenThreads: number
): boolean {
    return testAllocateBatches(ns, hostnames, [
        {
            hackThreads: hackThreads,
            growThreads: growThreads,
            weakenHackThreads: weakenThreads,
            weakenGrowThreads: 0,
        },
    ]);
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("sleep");
    ns.tail();

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

    const hackingLevel = ns.getHackingLevel();
    const hackTime = ns.getHackTime(targetHostname, hackingLevel);
    const growTime = ns.getGrowTime(targetHostname, hackingLevel);
    const weakenTime = ns.getWeakenTime(targetHostname, hackingLevel);

    const minSecurity = ns.getServerMinSecurityLevel(targetHostname);
    const weakenPerThread = 0.05; //ns.weakenAnalyze(1);

    let money = ns.getServerMoneyAvailable(targetHostname);
    const maxMoney = ns.getServerMaxMoney(targetHostname);

    // detect if we need to initialize the server
    while (money < maxMoney) {
        const security = ns.getServerSecurityLevel(targetHostname);
        const initialSecurityDiff = security - minSecurity;
        let growThreads = Math.floor(getHostAvailableRam(ns, ownedHostnames) / GROW_RAM);
        let weakenGrowThreads = 0;

        const growMult = Math.max(maxMoney / money, 1);
        const growThreadsNeeded = ns.growthAnalyze(targetHostname, growMult);
        growThreads = Math.min(growThreads, growThreadsNeeded);

        while (growThreads > 0) {
            const growSecurityIncrease = growThreads * 0.004;
            weakenGrowThreads = Math.ceil((growSecurityIncrease + initialSecurityDiff) / weakenPerThread);

            if (testAllocateThreads(ns, ownedHostnames, 0, growThreads, weakenGrowThreads)) break;

            growThreads--;
        }

        if (growThreads === 0) {
            llog(ns, "Unable to allocate primary grow threads, starting with a full weaken");

            let waitPID = 0;
            for (const hostname of ownedHostnames) {
                let availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
                if (hostname === "home") availableRam = Math.max(0, availableRam - HOME_RESERVE_RAM);
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
        } else {
            if (growThreads < growThreadsNeeded)
                llog(ns, "Only allocating %d out of the %d needed grow threads", growThreads, growThreadsNeeded);
            llog(ns, "Kicking off %d primary grow threads (%d weaken threads)", growThreads, weakenGrowThreads);

            // execute grows first, then weakens and wait for weakens to finish
            for (const hostname of ownedHostnames) {
                let availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
                if (hostname === "home") availableRam = Math.max(0, availableRam - HOME_RESERVE_RAM);
                const threads = Math.floor(availableRam / ns.getScriptRam(GROWJS));
                if (threads <= 0) continue;
                if (threads < growThreads) continue; // exectue grows as a block
                ns.exec(
                    GROWJS,
                    hostname,
                    growThreads,
                    "--target",
                    targetHostname,
                    "--hackLvlTiming",
                    ns.getHackingLevel()
                );
                break; // only execute grows once
            }

            let weakenGrowThreadsRemaining = weakenGrowThreads;
            let waitPID = 0;
            for (const hostname of ownedHostnames) {
                let availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
                if (hostname === "home") availableRam = Math.max(0, availableRam - HOME_RESERVE_RAM);
                let threads = Math.floor(availableRam / ns.getScriptRam(WEAKENJS));
                if (threads <= 0) continue;
                threads = Math.min(threads, weakenGrowThreadsRemaining);
                waitPID = ns.exec(
                    WEAKENJS,
                    hostname,
                    threads,
                    "--target",
                    targetHostname,
                    "--hackLvlTiming",
                    ns.getHackingLevel()
                );
                weakenGrowThreadsRemaining -= threads;

                if (weakenGrowThreadsRemaining <= 0) break;
            }

            while (ns.getRunningScript(waitPID) !== null) {
                await ns.sleep(100);
            }
            // wait a little bit longer to make sure everything else finished too
            await ns.sleep(500);
        }

        money = ns.getServerMoneyAvailable(targetHostname);
    }

    // start with 1 hack thread, calculate the number of grow and weaken threads needed to counter
    // if after 1 hack thread is calculated, the end state is not min security, max money, try only doing grow threads
    // while (true) {
    //     hackThreads++;

    //     const hackSecurityIncrease = hackThreads * 0.002;
    // }

    // start with 1 grow thread, calculate the number of weaken threads needed to counter
    // if after 1 grow thread is calculated, the end state is not min security, try only doing weaken threads

    // run the max number of weaken threads until security in minimum
}
