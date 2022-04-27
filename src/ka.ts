import { NS } from "@ns";
import { allHosts, HACKJS, GROWJS, WEAKENJS, CONSTSHAREJS, CONSTWEAKENJS } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    const killScriptList = [HACKJS, GROWJS, WEAKENJS, CONSTSHAREJS, CONSTWEAKENJS, "hack.js", "/lib/stanek/charge.js", "/archive/hack_2.js"];

    const allHostnames = allHosts(ns);

    for (const hostname of allHostnames) {
        const processes = ns.ps(hostname).filter((a) => killScriptList.includes(a.filename));

        for (const process of processes) {
            ns.kill(process.pid);
        }
    }
}
