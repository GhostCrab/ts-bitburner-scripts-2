import { NS } from "@ns";
import { getServerService } from "/lib/service_helpers";
import { ServerService } from "/services/server";

let serverService: ServerService;

export async function main(ns: NS): Promise<void> {
    try {
        serverService = getServerService(ns);
        //serverService = new ServerService(ns);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }
    const server = serverService.loadServer("n00dles");
    //const server = new Server(ns, "n00dles");

    ns.tprintf("Hack Time Short: %f", ns.getHackTime("n00dles"));
    ns.tprintf("Hack Time Long: %f", ns.getHackTime("n00dles", Number.MIN_VALUE));

    const hl = server.hackLevelForTime(3500);
    ns.tprintf("Hack Level For Time: %f", server.hackLevelForTime(3500));
    ns.tprintf("Target Hack Time: %f", ns.getHackTime("n00dles", hl))
}
