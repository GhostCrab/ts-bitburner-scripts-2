import { NS } from "@ns";
import { allHosts, HACKJS, GROWJS, WEAKENJS, softenServer, doProgramBuys, CONSTSHAREJS } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    doProgramBuys(ns);

    const hosts = allHosts(ns);

    for (const hostname of hosts) {
        softenServer(ns, hostname);
        if (hostname !== "home") {
            for (const script of [HACKJS, GROWJS, WEAKENJS, CONSTSHAREJS]) await ns.scp(script, hostname);
        }
    }
}
