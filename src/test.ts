import { NS } from "@ns";
import { allHosts, softenServer } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    const hosts = allHosts(ns);
    ns.tprintf(`${hosts }`);

    for (const hostname of hosts) {
        softenServer(ns, hostname);
    }
}
