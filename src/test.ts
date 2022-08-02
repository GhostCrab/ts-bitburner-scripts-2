import { NS } from "@ns";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main(ns: NS): Promise<void> {
    for (let i = 0; i <= 30; i++) {
        const curRam = Math.pow(2, i);
        const cost = ns.getPurchasedServerCost(curRam);

        ns.tprintf("%d, %s %d", curRam / 1.75, ns.nFormat(curRam * 1e9, "0b"), cost);
    }

    const testram = 10000 * 4000 * 1.75;
    ns.tprintf("%s %d", ns.nFormat(testram * 1e9, "0b"), testram);
}
