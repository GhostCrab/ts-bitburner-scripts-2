/* Inspiration taken from https://github.com/jjclark1982/bitburner-scripts/blob/main/service/servers.js */

import { NS, Server as NSServer, Player } from "@ns";
import { allHosts } from "/lib/util";

enum CodingContractRewardType {
    FactionReputation,
    FactionReputationAll,
    CompanyReputation,
    Money,
}

interface CodingContractReward {
    name?: string;
    type: CodingContractRewardType;
}

interface CodingContract {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    fn: string;
    reward: CodingContractReward | null;
    tries: number;
    type: string;
}

interface RunningScript {
    args: string[];
    filename: string;
    logs: string[];
    offlineExpGained: number;
    offlineMoneyMade: number;
    offlineRunningTime: number;
    onlineExpGained: number;
    onlineMoneyMade: number;
    onlineRunningTime: number;
    pid: number;
    ramUsage: number;
    server: string;
    threads: number;
}

interface ScriptReference {
    filename: string;
    server: string;
}

interface RamUsageEntry {
    type: "ns" | "dom" | "fn" | "misc";
    name: string;
    cost: number;
}

interface ScriptUrl {
    filename: string;
    url: string;
    moduleSequenceNumber: number;
}

type Argument = string | number | boolean;

export interface ScriptExecution {
    filename: string;
    hostname: string;
    threads: number;
    ram: number;
    args: Argument[];
    offset: number;
    batchID: number;
}

export interface Script {
    code: string;
    filename: string;
    url: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module: any;
    moduleSequenceNumber: number;
    dependencies: ScriptUrl[];
    dependents: ScriptReference[];
    ramUsage: number;
    ramUsageEntries?: RamUsageEntry[];
    server: string;
}

export interface TextFile {
    fn: string;
    text: string;
}

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["help", false],
    ["port", 7],
];

function getScriptExecutionArg(args: Argument[], arg: string): Argument | undefined {
    const argIndex = args.findIndex((a) => a === arg);
    if (argIndex !== -1) return args[argIndex + 1];
    return;
}

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    ns.disableLog("asleep");
    ns.disableLog("scan");
    ns.clearLog();

    options = ns.flags(argsSchema);
    if (options.help) {
        ns.tprint("Provide server information on a netscript port");
        return;
    }

    const serverService = new ServerService(ns);
    eval("window").serverService = serverService;
    const portHandle = ns.getPortHandle(options.port);
    portHandle.clear();
    portHandle.write(serverService);
    ns.atExit(() => {
        portHandle.clear();
        delete eval("window").serverService;
    });
    ns.print(`Started Server Service on port ${options.port}`);
    while (true) {
        await ns.asleep(60 * 60 * 1000);
    }
}

type ServerDict = { [id: string]: Server };

export class ServerService {
    ns: NS;
    allHostsCache: string[] = [];

    constructor(ns: NS) {
        this.ns = ns;
    }

    loadServer(hostname: string): Server {
        return new Server(this.ns, hostname);
    }

    getAllServers(homeReserve?: number): ServerDict {
        const allServers: ServerDict = {};
        for (const hostname of this.getAllHosts()) {
            allServers[hostname] = this.loadServer(hostname);
        }

        if (homeReserve && homeReserve > 0) allServers["home"].reservedRam = homeReserve;
        return allServers;
    }

    getScriptableServers(homeReserve?: number): Server[] {
        return Object.values(this.getAllServers(homeReserve)).filter((server) => server.canRunScripts());
    }

    getHackableServers(hacking: number): Server[] {
        return Object.values(this.getAllServers()).filter((server) => server.canBeHacked(hacking));
    }

    getAllHosts(force = false): string[] {
        if (!this.allHostsCache.length || force) {
            this.allHostsCache = allHosts(this.ns);
        }

        return this.allHostsCache;
    }
}

export class Server implements NSServer {
    // base server memebers
    contracts: CodingContract[] = [];
    cpuCores = 1;
    ftpPortOpen = false;
    hasAdminRights = false;
    hostname = "";
    httpPortOpen = false;
    ip = "";
    isConnectedTo = false;
    maxRam = 0;
    messages: string[] = [];
    organizationName = "";
    programs: string[] = [];
    ramUsed = 0;
    runningScripts: RunningScript[] = [];
    scripts: Script[] = [];
    serversOnNetwork: string[] = [];
    smtpPortOpen = false;
    sqlPortOpen = false;
    sshPortOpen = false;
    textFiles: TextFile[] = [];
    purchasedByPlayer = false;

    // server members
    backdoorInstalled = false;
    baseDifficulty = 1;
    hackDifficulty = 1;
    minDifficulty = 1;
    moneyAvailable = 0;
    moneyMax = 0;
    numOpenPortsRequired = 5;
    openPortCount = 0;
    requiredHackingSkill = 1;
    serverGrowth = 1;
    suppression = 0;
    activeSuppressionThreads: { hostname: string; threads: number }[] = [];
    suppressionIntervalID: NodeJS.Timer | null = null;
    suppressionLastUpdateTime = 0;

    // hacknet server members
    cache = 1;
    cores = 1;
    hashCapacity = 0;
    hashRate = 0;
    level = 1;
    onlineTimeSeconds = 0;
    totalHashesGenerated = 0;

    // my server members
    ns: NS;
    reservedRam = 0;
    reservedScripts: ScriptExecution[] = [];

    constructor(ns: NS, data: string | NSServer | undefined) {
        this.ns = ns;
        if (typeof data === "string") {
            this.hostname = data;
            data = undefined;
        }
        this.reload(data);
    }

    async initScripts(scripts: string[]): Promise<void> {
        if (this.hostname === "home") return;
        for (const script of scripts) if (this.ns.fileExists(script, "home")) await this.ns.scp(script, this.hostname);
    }

    reload(data?: NSServer): Server {
        data ||= this.ns.getServer(this.hostname);
        Object.assign(this, data);
        return this;
    }

    canRunScripts(): boolean {
        return this.hasAdminRights && this.maxRam > 0;
    }

    canBeHacked(hacking: number): boolean {
        return this.hasAdminRights && this.moneyMax > 0 && this.requiredHackingSkill <= hacking;
    }

    reservedScriptRam(): number {
        return this.reservedScripts.reduce((tally, script) => tally + script.ram, 0);
    }

    reserveScript(filename: string, ram: number, threads: number, args: Argument[] = []): boolean {
        const totalRam = ram * threads;
        const offset = Number(getScriptExecutionArg(args, "--offset"));
        const batchID = Number(getScriptExecutionArg(args, "--batchID"));
        if (this.availableRam() >= totalRam) {
            this.reservedScripts.push({
                filename: filename,
                hostname: this.hostname,
                ram: totalRam,
                threads: threads,
                args: args,
                offset: offset,
                batchID: batchID,
            });
            return true;
        }

        return false;
    }

    clearReservedScripts(): void {
        this.reservedScripts = [];
    }

    availableRam(): number {
        return Math.max(0, this.maxRam - this.ramUsed - this.reservedRam - this.reservedScriptRam());
    }

    threadsAvailable(threadSize = 1.75): number {
        return Math.floor(this.availableRam() / threadSize) || 0;
    }

    hackTime(hackOverride?: number, player?: Player): number {
        if (player && this.ns.fileExists("Formulas.exe", "home"))
            return this.ns.formulas.hacking.hackTime(this, player, hackOverride);

        return this.ns.getHackTime(this.hostname, hackOverride);
    }

    growTime(hackOverride?: number, player?: Player): number {
        if (player && this.ns.fileExists("Formulas.exe", "home"))
            return this.ns.formulas.hacking.growTime(this, player, hackOverride);

        return this.ns.getGrowTime(this.hostname, hackOverride);
    }

    weakenTime(hackOverride?: number, player?: Player): number {
        if (player && this.ns.fileExists("Formulas.exe", "home"))
            return this.ns.formulas.hacking.weakenTime(this, player, hackOverride);

        return this.ns.getWeakenTime(this.hostname, hackOverride);
    }

    growthAnalyze(player?: Player, growMult?: number, cores?: number): number {
        growMult ||= this.moneyMax / this.moneyAvailable;
        growMult = Math.max(1, growMult);

        if (player && this.ns.fileExists("Formulas.exe", "home"))
            return this.ns.formulas.hacking.numCycleForGrowth(this, growMult, player, cores);

        return this.ns.growthAnalyze(this.hostname, growMult, cores);
    }

    growPercent(player: Player, threads: number, cores?: number): number {
        if (player && this.ns.fileExists("Formulas.exe", "home"))
            return this.ns.formulas.hacking.growPercent(this, threads, player, cores);

        return 0;
    }

    growthAnalyzeSecurity(threads = 1): number {
        //return this.ns.growthAnalyzeSecurity(threads);
        return 0.004 * threads;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    weakenAnalyze(threads = 1, cores?: number): number {
        //return this.ns.weakenAnalyze(threads, cores);
        return 0.05 * threads;
    }
}
