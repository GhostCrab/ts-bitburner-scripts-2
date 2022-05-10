import { NS } from "@ns";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main(ns: NS): Promise<void> {
    for (let i = 1; i < 40; i++) {
        const ram = Math.pow(2, i);
        const cost = ns.getPurchasedServerCost(ram)
        ns.tprintf("%s %s", ns.nFormat(ram * 1e9, "0b"), ns.nFormat(cost, "($0.000a)"));
    }
}

