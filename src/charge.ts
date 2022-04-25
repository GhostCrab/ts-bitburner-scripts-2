import { NS } from "@ns";
import { ServerService } from "/services/server";

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [["reserve", Number.MAX_SAFE_INTEGER]];

let serverService: ServerService;
const CHARGEJS = "/lib/stanek/charge.js";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("scp");
    ns.disableLog("scan");
    ns.tail();

    try {
        options = ns.flags(argsSchema);
        serverService = new ServerService(ns);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }

    if (isNaN(options.reserve) || options.reserve < 0) {
        ns.tprintf("ERROR: --reserve must be a number > 0 (%s)", options.reserve);
        return;
    }

    const fragments = ns.stanek.activeFragments().filter((x) => x.id < 100);
    const scriptableServers = serverService.getScriptableServers(options.reserve);

    for (const server of scriptableServers) {
        if (server.hostname === "home") continue;
        await ns.scp(CHARGEJS, "home", server.hostname);
    }

    const availableThreadsTotal = scriptableServers.reduce(
        (input, server) => input + Math.floor(server.threadsAvailable(ns.getScriptRam(CHARGEJS))),
        0
    );

    ns.tprintf("available threads: %d", availableThreadsTotal);
    const fragSplit = Math.floor(availableThreadsTotal / fragments.length);

    ns.tprintf("Frags %d", fragments.length);
    ns.tprintf("Split %d", fragSplit);

    for (const fragment of fragments) {
        let threadsRemaining = fragSplit;
        for (const server of scriptableServers) {
            server.reload();
            const availableThreads = Math.floor(server.threadsAvailable(ns.getScriptRam(CHARGEJS)));
            const usingThreads = Math.min(threadsRemaining, availableThreads);

            if (usingThreads <= 0) continue;

            const pid = ns.exec(CHARGEJS, server.hostname, usingThreads, fragment.x, fragment.y);

            threadsRemaining -= usingThreads;

            if (threadsRemaining <= 0) break;
        }
    }
}
