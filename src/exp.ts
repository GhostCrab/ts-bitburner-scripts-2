import { NS } from "@ns";
import { ServerService } from "/services/server";

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [["reserve", Number.MAX_SAFE_INTEGER]];

let serverService: ServerService;

export async function main(ns: NS): Promise<void> {
    try {
        options = ns.flags(argsSchema);
        //serverService = getServerService(ns);
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
        await ns.scp("/lib/exec/const_weaken.js", "home", server.hostname);
    }

    for (const server of scriptableServers) {
        const availableRam = server.availableRam();
        const availableThreads = Math.floor(availableRam / ns.getScriptRam("/lib/exec/const_weaken.js"));

        if (availableThreads <= 0) continue;

        ns.exec("/lib/exec/const_weaken.js", server.hostname, availableThreads, "--target", "joesguns");
    }
}
