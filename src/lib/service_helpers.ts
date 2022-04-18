import { NS } from "@ns";
import { ServerService } from "/services/server"

export enum SERVICE_PORTS {
    SERVER = 7,
}

export function getServerService(ns: NS, portNum = SERVICE_PORTS.SERVER): ServerService {
    const portHandle = ns.getPortHandle(portNum);
    if (!portHandle.empty()) {
        return portHandle.peek();
    }

    throw new Error("Server Service must be initialized before getServerService() may be called");
}
