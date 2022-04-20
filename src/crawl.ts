import { NS } from "@ns";
import { allHosts, softenServer, stFormat } from "/lib/util";

const SPECIAL_HOSTS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n"];

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([
        ["all", false],
        ["ch", 5],
        ["suppress", false],
        ["soften", false],
    ]);

    if (flags.ch < 0) {
        ns.tprintf("ERROR: check flag must be > 0");
        return;
    }

    const hosts = allHosts(ns).sort(
        (a, b) => ns.getServerRequiredHackingLevel(b) - ns.getServerRequiredHackingLevel(a)
    );

    if (flags.soften) {
        for (const hostname of hosts) {
            softenServer(ns, hostname);
        }
    }

    let hostnameMaxLen = 0;
    hosts.map((a) => (hostnameMaxLen = Math.max(a.length, hostnameMaxLen)));

    if (flags.suppress) return;

    let serverListCount = hosts.length;
    if (!flags.all) {
        serverListCount = Math.min(
            serverListCount,
            flags.ch +
                hosts.reduce(
                    (tally, hostname) =>
                        tally + (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname) ? 1 : 0),
                    0
                )
        );
    }

    const lookHosts = serverListCount < hosts.length ? hosts.slice(-serverListCount) : hosts;

    for (const hostname of lookHosts) {
        const displayHostname = SPECIAL_HOSTS.includes(hostname) ? "*" + hostname : hostname;
        const root = ns.hasRootAccess(hostname);
        const requiredSkill = ns.getServerRequiredHackingLevel(hostname);
        const canHack = ns.getHackingLevel() >= requiredSkill;
        const ram = ns.getServerMaxRam(hostname);
        const time = ns.getWeakenTime(hostname);

        ns.tprintf(
            `%${hostnameMaxLen}s %4d %s %s %5s %8s %6.2f/%6.2f %9s/%9s`,
            displayHostname,
            requiredSkill,
            root ? "[R]" : "[ ]",
            canHack ? "[H]" : "[ ]",
            ram > 0 ? ns.nFormat(ram * 1e9, "0b") : "-----",
            stFormat(ns, time, true),
            ns.getServerSecurityLevel(hostname),
            ns.getServerMinSecurityLevel(hostname),
            ns.nFormat(ns.getServerMoneyAvailable(hostname), "$0.000a"),
            ns.nFormat(ns.getServerMaxMoney(hostname), "$0.000a")
        );
    }

    const availableRam = hosts.reduce(
        (tally, hostname) => tally + (ns.hasRootAccess(hostname) ? ns.getServerMaxRam(hostname) : 0),
        0
    );

    ns.tprintf("Total RAM available: %s", ns.nFormat(availableRam * 1e9, "0b"));
}
