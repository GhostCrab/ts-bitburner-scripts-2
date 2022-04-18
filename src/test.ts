import { NS } from "@ns";
import { getServerService } from "/lib/service_helpers";
import { ServerService } from "/services/server";

let serverService: ServerService;

export async function main(ns: NS): Promise<void> {
    try {
        serverService = getServerService(ns);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }
    const server = serverService.loadServer("n00dles2");

    console.log(server)
   
}
