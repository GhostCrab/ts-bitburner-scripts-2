import { NS, Player } from "@ns";
import { getServerService } from "/lib/service_helpers";
import { HACKJS, GROWJS, WEAKENJS, llog } from "/lib/util";
import { ServerService, Server, ScriptExecution } from "/services/server";

const HOME_RESERVE_RAM = 8;
const HACK_RAM = 1.7;
const GROW_RAM = 1.75;
const WEAKEN_RAM = 1.75;

const SCRIPT_GAP = 400;

type Batch = {
    hackThreads: number;
    growThreads: number;
    weakenHackThreads: number;
    weakenGrowThreads: number;
};

function testAllocateBatches(ns: NS, servers: Server[], batches: Batch[]): boolean {
    // all hack threads and grow threads need to be allocated in a block, weaken threads can be spread out
    const blocks = servers
        .map((a) => a.availableRam())
        .filter((a) => a <= 0)
        .sort((a, b) => a - b);

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
    servers: Server[],
    hackThreads: number,
    growThreads: number,
    weakenThreads: number
): boolean {
    return testAllocateBatches(ns, servers, [
        {
            hackThreads: hackThreads,
            growThreads: growThreads,
            weakenHackThreads: weakenThreads,
            weakenGrowThreads: 0,
        },
    ]);
}

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["target", "n00dles"],
    ["reserve", 16],
];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export function autocomplete(data: any, args: string[]): string[] {
    data.flags(argsSchema);
    const lastFlag = args.length > 1 ? args[args.length - 2] : "";
    if (["--target"].includes(lastFlag)) return data.servers;
    if (["--reserve"].includes(lastFlag)) return ["16", "32", "64", "128"];
    return ["--target", "--reserve"];
}

let serverService: ServerService;

export async function main(ns: NS): Promise<void> {
    ns.disableLog("sleep");
    ns.tail();

    let targetServer: Server;

    try {
        options = ns.flags(argsSchema);
        serverService = getServerService(ns);
        targetServer = serverService.loadServer(options.target);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }

    if (!targetServer.canRunScripts()) {
        ns.tprintf("ERROR: Cannot hack %s: No root access", targetServer.hostname);
        return;
    }

    if (!targetServer.canBeHacked(ns.getHackingLevel())) {
        ns.tprintf(
            "ERROR: Cannot hack %s: Insufficient hacking experience %d < %d",
            targetServer.hostname,
            ns.getHackingLevel(),
            targetServer.requiredHackingSkill
        );
        return;
    }

    if (isNaN(options.reserve) || options.reserve < 0) {
        ns.tprintf("ERROR: --reserve must be a number > 0 (%s)", options.reserve);
        return;
    }

    const servers = serverService
        .getScriptableServers(options.reserve)
        .sort((a, b) => a.availableRam() - b.availableRam());
    for (const server of servers) await server.initScripts([HACKJS, GROWJS, WEAKENJS]);

    let simPlayer: Player | undefined;

    const hackingLevel = ns.getHackingLevel();
    const hackTime = targetServer.hackTime(hackingLevel, simPlayer);
    const growTime = targetServer.growTime(hackingLevel, simPlayer);
    const weakenTime = targetServer.weakenTime(hackingLevel, simPlayer);

    const weakenPerThread = targetServer.weakenAnalyze(1);

    // detect if we need to initialize the server
    while (targetServer.moneyAvailable < targetServer.moneyMax) {
        targetServer.reload();
        const initialSecurityDiff = targetServer.hackDifficulty - targetServer.minDifficulty;
        let growThreads = servers.reduce((tally, server) => tally + server.threadsAvailable(GROW_RAM), 0);
        let weakenGrowThreads = 0;

        const growThreadsNeeded = targetServer.growthAnalyze(simPlayer);
        growThreads = Math.min(growThreads, growThreadsNeeded);

        while (growThreads > 0) {
            const growSecurityIncrease = targetServer.growthAnalyzeSecurity(growThreads);
            weakenGrowThreads = Math.ceil((growSecurityIncrease + initialSecurityDiff) / weakenPerThread);

            if (testAllocateThreads(ns, servers, 0, growThreads, weakenGrowThreads)) break;

            growThreads--;
        }

        if (growThreads === 0) {
            llog(ns, "Unable to allocate primary grow threads, starting with a full weaken");

            const fullWeakenThreads = Math.ceil(
                (targetServer.hackDifficulty - targetServer.minDifficulty) / weakenPerThread
            );
            let weakenThreadsNeeded = fullWeakenThreads;
            for (const server of servers) {
                const threads = Math.min(weakenThreadsNeeded, server.threadsAvailable(WEAKEN_RAM));
                if (threads <= 0) continue;
                const result = server.reserveScript(WEAKENJS, WEAKEN_RAM, threads, [
                    "--target",
                    targetServer.hostname,
                    "--hackLvlTiming",
                    ns.getHackingLevel(),
                    "--batchID",
                    0,
                ]);

                if (!result) throw new Error("server.reserveScript() failed after sanity check");

                weakenThreadsNeeded -= threads;
                if (weakenThreadsNeeded === 0) break;
            }

            if (weakenThreadsNeeded > 0)
                llog("Only able to allocate %d out of %d weaken threads", fullWeakenThreads - weakenThreadsNeeded, fullWeakenThreads);
            else
                llog("Allocated %d weaken threads", fullWeakenThreads);

            const execs: ScriptExecution[] = [];
            servers.map((a) => execs.push(...a.reservedScripts));
            await executeAndWait(ns, execs);
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

async function executeAndWait(ns: NS, execs: ScriptExecution[]): Promise<void> {
    execs.sort((a, b) => a.offset - b.offset);
    const startTime = new Date().getTime();
    let waitPID = 0;
    while (true) {
        const exec = execs.shift();
        if (!exec) break;
        while (true) {
            const curOffset = new Date().getTime() - startTime;
            const offsetDiff = curOffset - exec.offset;
            if (offsetDiff < 0) {
                await ns.sleep(20);
                continue;
            }

            if (offsetDiff > SCRIPT_GAP / 2) {
                ns.tprintf(
                    "WARNING: Script execution offset off by %d (> minimum difference of %d)",
                    offsetDiff,
                    SCRIPT_GAP / 2
                );

                execs = execs.filter((a) => a.batchID !== exec.batchID);
                continue;
            }

            const pid = ns.exec(exec.filename, exec.hostname, exec.threads, ...exec.args);

            // Set waitPID to the last weaken call (assumed to be the last call to finish of the last batch)
            if (exec.filename === WEAKENJS) waitPID = pid;
        }
    }

    while (ns.getRunningScript(waitPID) !== null) {
        await ns.sleep(100);
    }
}
