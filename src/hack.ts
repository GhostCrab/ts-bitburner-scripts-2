import { NS, Player } from "@ns";
import { HACKJS, GROWJS, WEAKENJS, llog, stFormat } from "/lib/util";
import { ServerService, Server, ScriptExecution, Argument } from "/services/server";

const TSPACER = 400;

const HOME_RESERVE_RAM = 16;
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
        .filter((a) => a > 0)
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

function reserveBatch(
    ns: NS,
    targetServer: Server,
    batchID: number,
    servers: Server[],
    hackThreads: number,
    growThreads: number,
    weakenHackThreads: number,
    weakenGrowThreads: number
): boolean {
    if (hackThreads > 0) {
        for (const server of servers) {
            if (server.threadsAvailable(HACK_RAM) < hackThreads) continue; // exectue grows as a block
            server.reserveScript(HACKJS, HACK_RAM, hackThreads, [
                "--target",
                targetServer.hostname,
                "--hackLvlTiming",
                ns.getHackingLevel(),
                "--hackLvlEffect",
                ns.getHackingLevel(),
                "--batchID",
                batchID,
                "--offset",
                0,
            ]);

            break;
        }
    }

    if (growThreads > 0) {
        for (const server of servers) {
            if (server.threadsAvailable(GROW_RAM) < growThreads) continue; // exectue grows as a block
            server.reserveScript(GROWJS, GROW_RAM, growThreads, [
                "--target",
                targetServer.hostname,
                "--hackLvlTiming",
                ns.getHackingLevel(),
                "--hackLvlEffect",
                ns.getHackingLevel(),
                "--batchID",
                batchID,
                "--offset",
                0,
            ]);

            break;
        }
    }

    if (weakenHackThreads) {
        let weakenHackThreadsRemaining = weakenHackThreads;
        for (const server of servers) {
            const threads = Math.min(weakenHackThreadsRemaining, server.threadsAvailable(WEAKEN_RAM));
            if (threads <= 0) continue;
            server.reserveScript(WEAKENJS, WEAKEN_RAM, threads, [
                "--target",
                targetServer.hostname,
                "--hackLvlTiming",
                ns.getHackingLevel(),
                "--batchID",
                batchID,
                "--offset",
                0, // set the weaken hack offset to 0 to differentiate it from a weaken grow
            ]);

            weakenHackThreadsRemaining -= threads;
            if (weakenHackThreadsRemaining === 0) break;
        }
    }

    if (weakenGrowThreads) {
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
                "--offset",
                1, // set the weaken grow offset to 1 to differentiate it from a weaken hack
            ]);

            weakenGrowThreadsRemaining -= threads;
            if (weakenGrowThreadsRemaining === 0) break;
        }
    }

    return true;
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

function allocateBatches(
    ns: NS,
    targetServer: Server,
    servers: Server[],
    hackLimit: number,
    doLog: boolean,
    simPlayer?: Player
): [number, number, number] {
    const batchSpacer = TSPACER * 4;
    const weakenPerThread = targetServer.weakenAmount(1);

    const hackTimeLong = targetServer.hackTime(Number.MIN_VALUE, simPlayer);
    const batchCountMax = Math.max(Math.floor(hackTimeLong / batchSpacer), 1);
    //llog(ns, "Maximum Batches: %d", batchCountMax);

    let totalMoney = 0;
    let totalPercent = 0;
    let batchID = 0;
    while (true) {
        // If we're maxed out on batches, break
        if (batchID >= batchCountMax) break;

        // is server initialized
        const securityDiff = targetServer.hackDifficulty - targetServer.minDifficulty;
        const moneyDiff = targetServer.moneyMax - targetServer.moneyAvailable;

        if (moneyDiff > 0) {
            //llog(ns, "Allocating Primary Batch (BatchID %d)", batchID);

            // allocate primary thread
            const bigBlock = servers
                .map((a) => a.availableRam())
                .filter((a) => a > 0)
                .sort((a, b) => b - a)[0];

            //llog(ns, "Big Block %d", bigBlock);

            // We've run out of available ram, break out and execute reserved scripts
            if (bigBlock < GROW_RAM) break;

            let growThreads = Math.floor(bigBlock / GROW_RAM);
            let weakenGrowThreads = 0;

            // if we're smart, only allocate the needed threads instead of max'ing out the big block
            if (simPlayer) {
                const growThreadsNeeded = targetServer.growthAmount(simPlayer);
                growThreads = Math.min(growThreads, growThreadsNeeded);
            }

            while (growThreads > 0) {
                const growSecurityIncrease = targetServer.growthAmountSecurity(growThreads);
                weakenGrowThreads = Math.ceil((growSecurityIncrease + securityDiff) / weakenPerThread);

                if (testAllocateThreads(ns, servers, 0, growThreads, weakenGrowThreads)) break;

                growThreads--;
            }

            if (growThreads === 0) {
                let threadCount = 0;
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
                        "--offset",
                        0,
                    ]);

                    threadCount += threads;
                }

                if (doLog) llog(ns, "Reserved Final Weaken Batch W-%d; Big Block %d", threadCount, bigBlock);

                // Full weaken loop indicates we are done allocating batches
                break;
            } else {
                reserveBatch(ns, targetServer, batchID, servers, 0, growThreads, 0, weakenGrowThreads);
            }

            if (doLog)
                llog(
                    ns,
                    "Reserving Primary Batch %d G-%d GW-%d; Big Block %d",
                    batchID,
                    growThreads,
                    weakenGrowThreads,
                    bigBlock
                );

            // if this isnt a sim, or we are unable to simulate because we dont have formulas.exe, keep looping until we run
            // out of available threads, just assign everything to batchID 0.
            if (!simPlayer) continue;

            targetServer.simGrow(growThreads, weakenGrowThreads, simPlayer);
            batchID++;
        } else {
            // allocate primary thread
            const bigBlock = servers
                .map((a) => a.availableRam())
                .filter((a) => a > 0)
                .sort((a, b) => b - a)[0];

            // We've run out of available ram, break out and execute reserved scripts
            if (bigBlock < GROW_RAM) break;

            const hackOverride = ns.getHackingLevel();
            // maximum number of hack threads this batch can not be higher than either how many threads
            // you can fit in the server with the most free RAM, or the maximum number of hack threads
            // you can target a server with before it is completely drained.
            const maxHackThreads = hackLimit / targetServer.hackAnalyze(hackOverride, simPlayer);
            let hackThreads = Math.min(
                Math.floor(bigBlock / HACK_RAM),
                hackLimit === 1 ? maxHackThreads - 1 : maxHackThreads
            );
            let hackAmount = 0;
            let weakenHackThreads = 0;
            let growThreads = 0;
            let weakenGrowThreads = 0;

            while (hackThreads > 0) {
                hackAmount = targetServer.hackAmount(hackThreads, hackOverride, simPlayer);
                const hackSecurityIncrease = targetServer.hackAmountSecurity(hackThreads);
                weakenHackThreads = Math.ceil((hackSecurityIncrease + securityDiff) / weakenPerThread);

                growThreads = Math.ceil(
                    targetServer.growthAmount(
                        simPlayer,
                        targetServer.moneyMax / (targetServer.moneyAvailable - hackAmount)
                    )
                );
                const growSecurityIncrease = targetServer.growthAmountSecurity(growThreads);
                weakenGrowThreads = Math.ceil(growSecurityIncrease / weakenPerThread);

                if (testAllocateThreads(ns, servers, hackThreads, growThreads, weakenHackThreads + weakenGrowThreads))
                    break;

                hackThreads--;
            }

            if (hackThreads === 0) break;

            if (doLog)
                llog(
                    ns,
                    "Reserving Batch %d H-%d HW-%d G-%d GW-%d; Big Block %d; Total %s (%.2f%%)",
                    batchID,
                    hackThreads,
                    weakenHackThreads,
                    growThreads,
                    weakenGrowThreads,
                    bigBlock,
                    ns.nFormat(hackAmount, "$0.000a"),
                    (hackAmount / targetServer.moneyMax) * 100
                );

            reserveBatch(
                ns,
                targetServer,
                batchID++,
                servers,
                hackThreads,
                growThreads,
                weakenHackThreads,
                weakenGrowThreads
            );

            totalMoney += hackAmount;
            totalPercent += (hackAmount / targetServer.moneyMax) * 100;
        }
    }

    return [batchID, totalMoney, totalPercent];
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("disableLog");
    ns.disableLog("sleep");
    ns.disableLog("scan");
    ns.disableLog("getHackingLevel");
    ns.disableLog("ALL");
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

    const simPlayer: Player | undefined = ns.fileExists("Formulas.exe", "home") ? ns.getPlayer() : undefined;
    const batchSpacer = TSPACER * 4;

    while (true) {
        let bestHackLimit = 0;
        let bestHackLimitValue = 0;
        for (const hackLimit of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975, 1]) {
            targetServer.reload();
            const [batchCount, totalMoney] = allocateBatches(ns, targetServer, servers, hackLimit, false, simPlayer);
            const weakenLevelCalc = targetServer.weakenLevelForTime(batchCount * batchSpacer, simPlayer);
            const weakenLevel =
                weakenLevelCalc <= 0 || weakenLevelCalc > ns.getHackingLevel() ? ns.getHackingLevel() : weakenLevelCalc;
            const weakenTime = targetServer.weakenTime(weakenLevel);
            const cycleTime = weakenTime + batchCount * batchSpacer;
            const value = totalMoney / (cycleTime / 1000);

            llog(
                ns,
                "Check %.3f - %d, %s, %s/s",
                hackLimit,
                batchCount,
                ns.nFormat(totalMoney, "$0.000a"),
                ns.nFormat(value, "$0.000a")
            );
            if (value > bestHackLimitValue) {
                bestHackLimit = hackLimit;
                bestHackLimitValue = value;
            }

            servers.map((a) => a.clearReservedScripts());
        }

        targetServer.reload();

        const [batchCount, totalMoney, totalPercent] = allocateBatches(
            ns,
            targetServer,
            servers,
            bestHackLimit,
            true,
            simPlayer
        );

        const execs: ScriptExecution[] = [];
        servers.map((a) => execs.push(...a.popReservedScripts()));

        // reverse engineer hackOverride to tightly fit batch count
        // const hackTimeLong = targetServer.hackTime(Number.MIN_VALUE, simPlayer);
        // const batchCountMax = Math.max(Math.floor(hackTimeLong / batchSpacer), 1);
        const playerHackingLevel = ns.getHackingLevel();
        const hackTimeTarget = batchCount * batchSpacer;
        const hackLevelCalc = targetServer.hackLevelForTime(hackTimeTarget, simPlayer);
        const hackLevel = hackLevelCalc <= 0 || hackLevelCalc > playerHackingLevel ? playerHackingLevel : hackLevelCalc;
        const growLevelCalc = targetServer.growLevelForTime(hackTimeTarget, simPlayer);
        const growLevel = growLevelCalc <= 0 || growLevelCalc > playerHackingLevel ? playerHackingLevel : growLevelCalc;
        const weakenLevelCalc = targetServer.weakenLevelForTime(hackTimeTarget, simPlayer);
        const weakenLevel =
            weakenLevelCalc <= 0 || weakenLevelCalc > playerHackingLevel ? playerHackingLevel : weakenLevelCalc;
        const hackTime = targetServer.hackTime(hackLevel);
        const growTime = targetServer.growTime(growLevel);
        const weakenTime = targetServer.weakenTime(weakenLevel);

        const hackOffset = weakenTime - TSPACER - hackTime;
        const growOffset = weakenTime + TSPACER - growTime;
        const weakenHackOffset = 0;
        const weakenGrowOffset = TSPACER * 2;
        const startOffset = hackOffset < 0 ? -hackOffset : 0;

        // ns.tprintf("Batches: %d", batchCount);
        // ns.tprintf("Target Time: %s", stFormat(ns, hackTimeTarget, true));
        // ns.tprintf("Hack Level          : %8.4f/%8.4f %s", hackLevelCalc, hackLevel, stFormat(ns, hackTime, true));
        // ns.tprintf("Grow Level          : %8.4f/%8.4f %s", growLevelCalc, growLevel, stFormat(ns, growTime, true));
        // ns.tprintf("Weaken Level        : %8.4f/%8.4f %s", weakenLevelCalc, weakenLevel, stFormat(ns, weakenTime, true));
        // ns.tprintf("Hack Timeline       : %6d %6d %6d", hackOffset + startOffset, hackTime, hackOffset + startOffset + hackTime);
        // ns.tprintf("Weaken Hack Timeline: %6d %6d %6d", weakenHackOffset + startOffset, weakenTime, weakenHackOffset + startOffset + weakenTime);
        // ns.tprintf("Grow Timeline       : %6d %6d %6d", growOffset + startOffset, growTime, growOffset + startOffset + growTime);
        // ns.tprintf("Weaken Grow Timeline: %6d %6d %6d", weakenGrowOffset + startOffset, weakenTime, weakenGrowOffset + startOffset + weakenTime);

        // fix up hack overrides on execs
        for (const exec of execs) {
            switch (exec.filename) {
                case HACKJS:
                    updateScriptExecutionArg(exec, "--hackLvlTiming", hackLevel);
                    exec.offset = exec.batchID * batchSpacer + hackOffset + startOffset;
                    updateScriptExecutionArg(exec, "--offset", exec.offset);
                    break;
                case GROWJS:
                    updateScriptExecutionArg(exec, "--hackLvlTiming", growLevel);
                    exec.offset = exec.batchID * batchSpacer + growOffset + startOffset;
                    updateScriptExecutionArg(exec, "--offset", exec.offset);
                    break;
                case WEAKENJS:
                    updateScriptExecutionArg(exec, "--hackLvlTiming", weakenLevel);
                    if (exec.offset) exec.offset = exec.batchID * batchSpacer + weakenGrowOffset + startOffset;
                    else exec.offset = exec.batchID * batchSpacer + weakenHackOffset + startOffset;
                    updateScriptExecutionArg(exec, "--offset", exec.offset);
                    break;
            }
        }

        const cycleTime = weakenTime + batchCount * batchSpacer;
        llog(
            ns,
            "Executing %d batches over %s for %s income (%s/s) %d%%",
            batchCount,
            stFormat(ns, cycleTime, true),
            ns.nFormat(totalMoney, "$0.000a"),
            ns.nFormat(totalMoney / (cycleTime / 1000), "$0.000a"),
            totalPercent
        );

        const port = ns.getPortHandle(1);
        port.clear();
        port.write(
            JSON.stringify([
                new Date(),
                cycleTime,
                targetServer.hostname,
                ns.getScriptIncome(ns.getScriptName(), ns.getHostname(), ...ns.args).toString(),
                "SMART",
            ])
        );

        await executeAndWait(ns, execs);
    }
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
                llog(
                    ns,
                    "WARNING: Script execution offset off by %d (> minimum difference of %d)",
                    offsetDiff,
                    SCRIPT_GAP / 2
                );

                execs = execs.filter((a) => a.batchID !== exec.batchID);
                break;
            }

            // llog(
            //     ns,
            //     "Executing %s:%s -t%d offset: %s",
            //     exec.hostname,
            //     exec.filename,
            //     exec.threads,
            //     stFormat(ns, exec.offset, true)
            // );
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
