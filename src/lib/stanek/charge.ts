import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    while (true) {
        await ns.stanek.chargeFragment(Number(ns.args[0]), Number(ns.args[1]));
    }
}
