import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const files = ns.ls(ns.getHostname());

    const libs = files.filter((a) => a.indexOf("/lib") !== -1);
    const scripts = files.filter((a) => a.indexOf("/lib") === -1 && a.indexOf(".js") !== -1);
    const execs = files.filter((a) => a.indexOf(".exe") !== -1);
    const others = files.filter((a) => !libs.includes(a) && !scripts.includes(a) && !execs.includes(a));

    let maxFilenameLength = 0;
    libs.map((a) => (maxFilenameLength = Math.max(maxFilenameLength, a.length - 5)));
    scripts.map((a) => (maxFilenameLength = Math.max(maxFilenameLength, a.length)));
    execs.map((a) => (maxFilenameLength = Math.max(maxFilenameLength, a.length)));
    others.map((a) => (maxFilenameLength = Math.max(maxFilenameLength, a.length)));

    ns.tprintf("Scripts:");
    for (const file of scripts) {
        const ram = ns.getScriptRam(file);
        ns.tprintf(`  %${maxFilenameLength}s %8s`, file, ns.nFormat(ram * 1e9, "0.00b"));
    }

    ns.tprintf("Library Scripts:");
    for (const file of libs) {
        const ram = ns.getScriptRam(file);
        const subName = file.substring(5);
        ns.tprintf(`  %${maxFilenameLength}s %8s`, subName, ns.nFormat(ram * 1e9, "0.00b"));
    }

    ns.tprintf("Executables:");
    for (const file of execs) {
        ns.tprintf(`  %${maxFilenameLength}s`, file);
    }

    ns.tprintf("Other:");
    for (const file of others) {
        ns.tprintf(`  %${maxFilenameLength}s`, file);
    }
}
