import { NS } from "@ns";
import { doBackdoor } from "/lib/util";

export async function main(ns: NS): Promise<void> {
    await doBackdoor(ns, "w0r1d_d43m0n");
}
