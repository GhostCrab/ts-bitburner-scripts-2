import { NS, Player } from "@ns";
import { HACKJS, GROWJS, WEAKENJS, llog } from "/lib/util";
import { ServerService, Server, ScriptExecution, Argument } from "/services/server";

const TSPACER = 400;

const HOME_RESERVE_RAM = 32;
const HACK_RAM = 1.7;
const GROW_RAM = 1.75;
const WEAKEN_RAM = 1.75;

const SCRIPT_GAP = 400;

function updateScriptExecutionArg(exec: ScriptExecution, arg: string, val: Argument): void {
    const argIndex = exec.args.findIndex((a) => a === arg);
    if (argIndex !== -1 && argIndex + 1 < exec.args.length) exec.args[argIndex + 1] = val;
    return;
}

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
    ["reserve", HOME_RESERVE_RAM],
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

// allocate a batch
// check to see if server is initialized, if not, reserve a GW batch
// else figure out optimal batch size for number of batches left to allocate
// and reserve all of those

function allocateBatches(ns: NS, targetServer: Server, servers: Server[], simPlayer?: Player): number {
    const batchSpacer = TSPACER * 4;
    const weakenPerThread = targetServer.weakenAmount(1);

    const hackTimeLong = targetServer.hackTime(Number.MIN_VALUE, simPlayer);
    const batchCountMax = Math.max(Math.floor(hackTimeLong / batchSpacer), 1);
    llog(ns, "Maximum Batches: %d", batchCountMax);

    let batchID = 0;
    while (true) {
        // If we're maxed out on batches, break
        if (batchID >= batchCountMax) break;

        // is server initialized
        const securityDiff = targetServer.hackDifficulty - targetServer.minDifficulty;
        const moneyDiff = targetServer.moneyMax - targetServer.moneyAvailable;

        if (securityDiff > 0 || moneyDiff > 0) {
            llog(ns, "Allocating Primary Thread (BatchID %d)", batchID);
    
            // allocate primary thread
            const bigBlock = servers
                .map((a) => a.availableRam())
                .filter((a) => a > 0)
                .sort((a, b) => b - a)[0];

            llog(ns, "Big Block %d", bigBlock);

            // We've run out of available ram, break out and execute reserved scripts
            if (bigBlock < GROW_RAM) break;

            let growThreads = Math.floor(bigBlock / GROW_RAM);
            let weakenGrowThreads = 0;

            const growThreadsNeeded = targetServer.growthAmount(simPlayer);
            growThreads = Math.min(growThreads, growThreadsNeeded);

            while (growThreads > 0) {
                const growSecurityIncrease = targetServer.growthAmountSecurity(growThreads);
                weakenGrowThreads = Math.ceil((growSecurityIncrease + securityDiff) / weakenPerThread);

                if (testAllocateThreads(ns, servers, 0, growThreads, weakenGrowThreads)) break;

                growThreads--;
            }

            llog(ns, "%d grow threads", growThreads);

            if (growThreads === 0) {
                for (const server of servers) {
                    const threads = server.threadsAvailable(WEAKEN_RAM);
                    if (threads <= 0) continue;
                    server.reserveScript(WEAKENJS, WEAKEN_RAM, threads, [
                        "--target",
                        targetServer.hostname,
                        "--hackLvlTiming",
                        ns.getHackingLevel(),
                        "--batchID",
                        batchID,
                    ]);
                }

                // Full weaken loop indicates we are done allocating batches
                break;
            } else {
                if (growThreads < growThreadsNeeded)
                    llog(ns, "Only allocating %d out of the %d needed grow threads", growThreads, growThreadsNeeded);
                llog(ns, "Kicking off %d primary grow threads (%d weaken threads)", growThreads, weakenGrowThreads);

                // reserve grows first, then weakens
                for (const server of servers) {
                    if (server.threadsAvailable(GROW_RAM) < growThreads) continue; // exectue grows as a block
                    server.reserveScript(GROWJS, GROW_RAM, growThreads, [
                        "--target",
                        targetServer.hostname,
                        "--hackLvlTiming",
                        ns.getHackingLevel(),
                        "--batchID",
                        batchID
                    ]);

                    break;
                }

                let weakenGrowThreadsRemaining = weakenGrowThreads;
                for (const server of servers) {
                    const threads = Math.min(weakenGrowThreadsRemaining, server.threadsAvailable(WEAKEN_RAM));
                    if (threads <= 0) continue;
                    server.reserveScript(WEAKENJS, WEAKEN_RAM, threads, [
                        "--target",
                        targetServer.hostname,
                        "--hackLvlTiming",
                        ns.getHackingLevel(),
                        "--batchID",
                        batchID,
                    ]);

                    weakenGrowThreadsRemaining -= threads;
                    if (weakenGrowThreadsRemaining === 0) break;
                }
            }

            // if this isnt a sim, or we are unable to simulate because we dont have formulas.exe, keep looping until we run
            // out of available threads, just assign everything to batchID 0.
            if (!simPlayer) continue;

            targetServer.simGrow(growThreads, weakenGrowThreads, simPlayer);
            batchID++;
            continue;
        } else {
            // calculate how many HWGW batches we can fit
        }

        return batchID;
    }
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("disableLog");
    ns.disableLog("sleep");
    ns.disableLog("scan");
    ns.disableLog("getHackingLevel");
    ns.tail();

    let targetServer: Server;

    try {
        options = ns.flags(argsSchema);
        serverService = new ServerService(ns);
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

    await doSoften(ns);

    const servers = serverService
        .getScriptableServers(options.reserve)
        .sort((a, b) => a.availableRam() - b.availableRam());

    let simPlayer: Player | undefined;

    //const batchCount = allocateBatches(ns, targetServer, servers, simPlayer);
    allocateBatches(ns, targetServer, servers, simPlayer);

    const execs: ScriptExecution[] = [];
    servers.map((a) => execs.push(...a.popReservedScripts()));

    // fix up hack overrides on execs
    // const hackLevel = targetServer.hackLevelForTime(9999, simPlayer);
    // const growLevel = targetServer.growLevelForTime(9999, simPlayer);
    // const weakenLevel = targetServer.weakenLevelForTime(9999, simPlayer);
    const hackLevel = ns.getHackingLevel();
    const growLevel = ns.getHackingLevel();
    const weakenLevel = ns.getHackingLevel();
    const hackTime = targetServer.hackTime(hackLevel);
    const growTime = targetServer.growTime(hackLevel);
    const weakenTime = targetServer.weakenTime(hackLevel);
    const hackOffset = weakenTime - TSPACER - hackTime;
    const growOffset = weakenTime + TSPACER - growTime;
    const weakenHackOffset = 0;
    const weakenGrowOffset = TSPACER * 2;
    const batchSpacer = TSPACER * 4;
    for (const exec of execs) {
        switch (exec.filename) {
            case HACKJS:
                updateScriptExecutionArg(exec, "--hackLvlTiming", hackLevel);
                exec.offset = (exec.batchID * batchSpacer) + hackOffset;
                exec.args.push("--offset", exec.offset);
                break;
            case GROWJS:
                updateScriptExecutionArg(exec, "--hackLvlTiming", growLevel);
                exec.offset = (exec.batchID * batchSpacer) + growOffset;
                exec.args.push("--offset", exec.offset);
                break;
            case WEAKENJS:
                updateScriptExecutionArg(exec, "--hackLvlTiming", weakenLevel);
                if (exec.offset) exec.offset = (exec.batchID * batchSpacer) + weakenGrowOffset;
                else exec.offset = (exec.batchID * batchSpacer) + weakenHackOffset;
                exec.args.push("--offset", exec.offset);
                break;
        }
    }

    await executeAndWait(ns, execs);
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
                break;
            }

            const pid = ns.exec(exec.filename, exec.hostname, exec.threads, ...exec.args);

            // Set waitPID to the last weaken call (assumed to be the last call to finish of the last batch)
            if (exec.filename === WEAKENJS) waitPID = pid;

            break;
        }
    }

    while (ns.getRunningScript(waitPID) !== null) {
        await ns.sleep(100);
    }
}

async function doSoften(ns: NS) {
    const waitPID = ns.exec("soften.js", "home");
    while (ns.getRunningScript(waitPID) !== null) {
        await ns.sleep(0);
    }
}
