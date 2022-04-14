import { NS } from "@ns";
import { mapHosts } from "/lib/util";

const SPECIAL_HOSTS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n"];

export async function main(ns: NS): Promise<void> {
    const hostPaths = mapHosts(ns);

    for (const hostname of SPECIAL_HOSTS) {
        const path = hostPaths[hostname];
        if (!path) continue;
        let pathStr = "";
        for (const curPath of path) {
            if (pathStr === "") pathStr = curPath;
            else pathStr = pathStr + " -> " + curPath;
        }
        ns.tprint(pathStr);
    }
}
