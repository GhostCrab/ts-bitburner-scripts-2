import { NS } from "@ns";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main(ns: NS): Promise<void> {
    ns.tprintf("%s", ns.nFormat(ns.getScriptIncome("mcp.js", "home", ...ns.args), "$0.000a"));
}

