import { NS } from "@ns";
import { ServerService } from "/services/server";

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["reserve", Number.MAX_SAFE_INTEGER],
    ["timer", 0],
];

let serverService: ServerService;

export async function main(ns: NS): Promise<void> {
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

    const scriptableServers = serverService.getScriptableServers(options.reserve);

    for (const server of scriptableServers) {
        if (server.hostname === "home") continue;
        await ns.scp("/lib/exec/const_share.js", "home", server.hostname);
    }

    const pids: number[] = []
    for (const server of scriptableServers) {
        const availableRam = server.availableRam();
        const availableThreads = Math.floor(availableRam / ns.getScriptRam("/lib/exec/const_share.js"));

        if (availableThreads <= 0) continue;

        pids.push(ns.exec("/lib/exec/const_share.js", server.hostname, availableThreads));
    }

    if (options.timer) {
        await ns.sleep(options.timer * 1000);

        for (const pid of pids) {
            ns.kill(pid);
        }
    }
}
