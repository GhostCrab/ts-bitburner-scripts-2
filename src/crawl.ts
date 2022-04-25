import { NS } from "@ns";
import { allHosts, doProgramBuys, softenServer, stFormat } from "/lib/util";

const SPECIAL_HOSTS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "w0r1d_d43m0n"];

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["all", false],
    ["ch", 5],
    ["suppress", false],
    ["soften", false],
    ["s", false],
    ["a", false],
    ["b", false],
];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export function autocomplete(data: any, args: string[]): string[] {
    data.flags(argsSchema);
    const lastFlag = args.length > 1 ? args[args.length - 2] : "";
    if (["--ch"].includes(lastFlag)) return ["10"];
    return ["-s", "-a", "--all", "--ch", "--suppress", "--soften", "-b"];
}

export async function main(ns: NS): Promise<void> {
    try {
        options = ns.flags(argsSchema);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }

    if (options.ch < 0) {
        ns.tprintf("ERROR: check flag must be > 0");
        return;
    }

    options.soften = options.soften || options.s;
    options.all = options.all || options.a;

    if (options.b)
        doProgramBuys(ns);

    const hosts = allHosts(ns).sort(
        (a, b) => ns.getServerRequiredHackingLevel(b) - ns.getServerRequiredHackingLevel(a)
    );

    if (options.soften) {
        for (const hostname of hosts) {
            softenServer(ns, hostname);
        }
    }

    let hostnameMaxLen = 0;
    hosts.map((a) => (hostnameMaxLen = Math.max(a.length, hostnameMaxLen)));

    if (options.suppress) return;

    let serverListCount = hosts.length;
    if (!options.all) {
        serverListCount = Math.min(
            serverListCount,
            options.ch +
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
            stFormat(ns, time),
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
