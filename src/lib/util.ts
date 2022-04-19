import { NS } from "@ns";

export const HACKJS = "/lib/exec/hack.js";
export const GROWJS = "/lib/exec/grow.js";
export const WEAKENJS = "/lib/exec/weaken.js";
export const CONSTSHAREJS = "/lib/exec/const_share.js";
export const CONSTWEAKENJS = "/lib/exec/const_weaken.js";

export function llog(ns: NS, str: string, ...args: (string | number)[]): void {
    ns.printf("%8s " + str, new Date().toLocaleTimeString("it-IT"), ...args);
}

export function softenServer(ns: NS, hostname: string): boolean {
    try {
        ns.brutessh(hostname);
    } catch (e) {
        //
    }

    try {
        ns.ftpcrack(hostname);
    } catch (e) {
        //
    }

    try {
        ns.httpworm(hostname);
    } catch (e) {
        //
    }

    try {
        ns.relaysmtp(hostname);
    } catch (e) {
        //
    }

    try {
        ns.sqlinject(hostname);
    } catch (e) {
        //
    }

    try {
        ns.nuke(hostname);
    } catch (e) {
        return false;
    }

    return true;
}

export function mapHosts(
    ns: NS,
    hosts: Record<string, string[]> = {},
    parents: string[] = [],
    current = "home"
): Record<string, string[]> {
    const newParents = parents.concat(current);
    hosts[current] = newParents;

    const children = ns.scan(current).filter((element) => !parents.includes(element));
    for (const child of children) {
        mapHosts(ns, hosts, newParents, child);
    }
    return hosts;
}

export function allHosts(ns: NS): string[] {
    return Object.keys(mapHosts(ns));
}

export function doProgramBuys(ns: NS): void {
    const player = ns.getPlayer();

    if (!player.tor && player.money > 200e3) ns.purchaseTor();

    if (!ns.fileExists("BruteSSH.exe", "home") && player.money > 500e3) ns.purchaseProgram("BruteSSH.exe");

    if (!ns.fileExists("FTPCrack.exe", "home") && player.money > 1500e3) ns.purchaseProgram("FTPCrack.exe");

    if (!ns.fileExists("relaySMTP.exe", "home") && player.money > 5e6) ns.purchaseProgram("relaySMTP.exe");

    if (!ns.fileExists("HTTPWorm.exe", "home") && player.money > 30e6) ns.purchaseProgram("HTTPWorm.exe");

    if (!ns.fileExists("SQLInject.exe", "home") && player.money > 250e6) ns.purchaseProgram("SQLInject.exe");
}

export function doBuyAndSoftenAll(ns: NS): void {
    doProgramBuys(ns);
    for (const hostname of allHosts(ns)) {
        softenServer(ns, hostname);
    }
}

export function stFormat(ns: NS, ms: number, showms = false, showfull = false): string {
    let timeLeft = ms;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    timeLeft -= hours * (1000 * 60 * 60);
    const minutes = Math.floor(timeLeft / (1000 * 60));
    timeLeft -= minutes * (1000 * 60);
    const seconds = Math.floor(timeLeft / 1000);
    timeLeft -= seconds * 1000;
    const milliseconds = timeLeft;

    if (showms) {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d.%03d", minutes, seconds, milliseconds);
        return ns.sprintf("%02d.%03d", seconds, milliseconds);
    } else {
        if (hours > 0 || showfull) return ns.sprintf("%02d:%02d:%02d", hours, minutes, seconds);
        if (minutes > 0) return ns.sprintf("%02d:%02d", minutes, seconds);
        return ns.sprintf("%02d", seconds);
    }
}

export function stdFormat(ns: NS, offset = 0, showms = false): string {
    const date = new Date(new Date().getTime() + offset);

    if (showms) {
        const ms = ns.sprintf("%03d", date.getUTCMilliseconds());
        return date.toLocaleTimeString("it-IT") + "." + ms;
    } else {
        return date.toLocaleTimeString("it-IT");
    }
}

export async function doBackdoor(ns: NS, hostname: string): Promise<boolean> {
    const hosts = mapHosts(ns);
    const trail = hosts[hostname];

    const server = ns.getServer(hostname);

    if (server.backdoorInstalled) return true;

    if (server.requiredHackingSkill > ns.getHackingLevel()) {
        ns.tprintf(
            "Unable to backdoor server %s - Hacking level %d < %d",
            hostname,
            ns.getHackingLevel(),
            server.requiredHackingSkill
        );
        return false;
    }

    if (!server.hasAdminRights && !softenServer(ns, hostname)) {
        ns.tprintf(
            "Unable to backdoor server %s - Unable to obtain admin rights",
            hostname,
            ns.getHackingLevel(),
            server.requiredHackingSkill
        );
        return false;
    }

    for (const hostHopName of trail) {
        ns.connect(hostHopName);
    }

    await ns.installBackdoor();
    ns.connect("home");

    return true;
}

export async function doBackdoors(ns: NS): Promise<void> {
    const targetHosts = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n"];

    for (const hostname of targetHosts) {
        await doBackdoor(ns, hostname);
    }
}
