import { NS } from "@ns";
import { canBackdoor, doBackdoor } from "lib/util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findProp = function (propName: string): any {
    for (const div of eval("document").querySelectorAll("div")) {
        const propKey = Object.keys(div)[1];
        if (!propKey) continue;
        const props = div[propKey];
        if (props.children?.props && props.children.props[propName]) return props.children.props[propName];
        if (props.children instanceof Array)
            for (const child of props.children) if (child?.props && child.props[propName]) return child.props[propName];
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playerProp: any;

function refreshInvitations(): void {
    const factions = playerProp.checkForFactionInvitations();

    for (const faction of factions) {
        if (!faction.alreadyInvited) {
            playerProp.receiveInvite(faction.name);
            faction.alreadyInvited = true;
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let options: any;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["c", false], // only check for invites, dont actually join
    ["t", ""],
    ["target", ""],
];

type FactionRequirements = {
    locations?: string[] | string;
    money?: number;
    hacking?: number;
    backdoor?: string;
    karma?: number;
    combat?: number;
    murder?: number;
    law?: boolean;
    augmentations?: number;
    corp?: string;
    corporationRep?: number;
    businessLeader?: boolean;
    hnServer?: boolean;
    daedalus?: boolean; // hacking level OR combat levels
};

class Faction {
    name: string;
    invited: boolean;
    joined: boolean;
    requirements: FactionRequirements;

    constructor(ns: NS, name: string, requirements: FactionRequirements) {
        this.name = name;
        this.invited = ns.checkFactionInvitations().includes(this.name);
        this.joined = ns.getPlayer().factions.includes(this.name);
        this.requirements = requirements;
    }

    async getInvite(ns: NS): Promise<boolean> {
        refreshInvitations();
        this.invited = ns.checkFactionInvitations().includes(this.name);
        this.joined = ns.getPlayer().factions.includes(this.name);

        if (this.invited || this.joined) return true;

        if (!this.checkRequirements(ns)) return false;

        // location check
        if (this.requirements.locations) {
            if (Array.isArray(this.requirements.locations)) {
                if (!this.requirements.locations.includes(ns.getPlayer().location)) {
                    ns.travelToCity(this.requirements.locations[0]);
                }
            } else {
                if (this.requirements.locations !== ns.getPlayer().location) {
                    ns.travelToCity(this.requirements.locations);
                }
            }
        }

        // do backdoor
        if (this.requirements.backdoor) await doBackdoor(ns, this.requirements.backdoor);

        refreshInvitations();
        this.invited = ns.checkFactionInvitations().includes(this.name);

        return this.invited;
    }

    async join(ns: NS): Promise<boolean> {
        this.joined = ns.getPlayer().factions.includes(this.name);
        if (this.joined) return true;

        if (!(await this.getInvite(ns))) return false;

        return ns.joinFaction(this.name);
    }

    checkRequirements(ns: NS, enforceLocation = false): boolean {
        let passed = true;

        // location check
        if (enforceLocation && this.requirements.locations) {
            if (Array.isArray(this.requirements.locations)) {
                passed &&= this.requirements.locations.includes(ns.getPlayer().location);
            } else {
                passed &&= this.requirements.locations === ns.getPlayer().location;
            }
        }

        if (this.requirements.daedalus && this.requirements.money && this.requirements.hacking) {
            passed &&=
                ns.getPlayer().money >= this.requirements.money || ns.getPlayer().hacking >= this.requirements.hacking;
        } else {
            // money check
            if (this.requirements.money) {
                passed &&= ns.getPlayer().money >= this.requirements.money;
            }

            // hacking check
            if (this.requirements.hacking) {
                passed &&= ns.getPlayer().hacking >= this.requirements.hacking;
            }
        }

        // karma check
        if (this.requirements.karma) {
            passed &&= ns.heart.break() <= this.requirements.karma;
        }

        // combat check
        if (this.requirements.combat) {
            passed &&= ns.getPlayer().strength >= this.requirements.combat;
            passed &&= ns.getPlayer().defense >= this.requirements.combat;
            passed &&= ns.getPlayer().dexterity >= this.requirements.combat;
            passed &&= ns.getPlayer().agility >= this.requirements.combat;
        }

        // murder check
        if (this.requirements.murder) {
            passed &&= ns.getPlayer().numPeopleKilled >= this.requirements.murder;
        }

        // law check
        if (this.requirements.law) {
            //
        }

        // augmentations check
        if (this.requirements.augmentations) {
            passed &&= ns.getOwnedAugmentations().length >= this.requirements.augmentations;
        }

        // corporation check
        if (this.requirements.corp && this.requirements.corporationRep) {
            passed &&= ns.getCompanyRep(this.requirements.corp) >= this.requirements.corporationRep;
        }

        // businessLeader check
        if (this.requirements.businessLeader) {
            //
        }

        // hacknet check
        if (this.requirements.hnServer) {
            passed = false;
        }

        // backdoor check
        if (this.requirements.backdoor) {
            passed &&= canBackdoor(ns, this.requirements.backdoor);
        }

        return passed;
    }
}

export async function main(ns: NS): Promise<void> {
    try {
        options = ns.flags(argsSchema);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }

    options.target = options.target !== "" ? options.target : options.t;

    playerProp = findProp("player");
    if (!playerProp) return;

    // faction checklist so we dont try to get invites for factions we are already invited to / joined
    const factions: { [id: string]: Faction } = {
        CyberSec: new Faction(ns, "CyberSec", {
            backdoor: "CSEC",
        }),
        NiteSec: new Faction(ns, "NiteSec", {
            backdoor: "avmnite-02h",
        }),
        "The Black Hand": new Faction(ns, "The Black Hand", {
            backdoor: "I.I.I.I",
        }),
        BitRunners: new Faction(ns, "BitRunners", {
            backdoor: "run4theh111z",
        }),
        "Tian Di Hui": new Faction(ns, "Tian Di Hui", {
            money: 1e6,
            hacking: 50,
            locations: ["Chongqing", "New Tokyo", "Ishima"],
        }),
        Netburners: new Faction(ns, "Netburners", {
            hacking: 80,
            hnServer: true,
        }),
        "Sector-12": new Faction(ns, "Sector-12", {
            money: 15e6,
            locations: "Sector-12",
        }),
        Chongqing: new Faction(ns, "Chongqing", {
            money: 20e6,
            locations: "Chongqing",
        }),
        "New Tokyo": new Faction(ns, "New Tokyo", {
            money: 20e6,
            locations: "New Tokyo",
        }),
        Ishima: new Faction(ns, "Ishima", {
            money: 30e6,
            locations: "Ishima",
        }),
        Aevum: new Faction(ns, "Aevum", {
            money: 40e6,
            locations: "Aevum",
        }),
        Volhaven: new Faction(ns, "Volhaven", {
            money: 50e6,
            locations: "Volhaven",
        }),
        ECorp: new Faction(ns, "ECorp", {
            corp: "ECorp",
            corporationRep: 200000,
        }),
        MegaCorp: new Faction(ns, "MegaCorp", {
            corp: "MegaCorp",
            corporationRep: 200000,
        }),
        "KuaiGong International": new Faction(ns, "KuaiGong International", {
            corp: "KuaiGong International",
            corporationRep: 200000,
        }),
        "Four Sigma": new Faction(ns, "Four Sigma", {
            corp: "Four Sigma",
            corporationRep: 200000,
        }),
        NWO: new Faction(ns, "NWO", {
            corp: "NWO",
            corporationRep: 200000,
        }),
        "Blade Industries": new Faction(ns, "Blade Industries", {
            corp: "Blade Industries",
            corporationRep: 200000,
        }),
        "OmniTek Incorporated": new Faction(ns, "OmniTek Incorporated", {
            corp: "OmniTek Incorporated",
            corporationRep: 200000,
        }),
        "Bachman & Associates": new Faction(ns, "Bachman & Associates", {
            corp: "Bachman & Associates",
            corporationRep: 200000,
        }),
        "Clarke Incorporated": new Faction(ns, "Clarke Incorporated", {
            corp: "Clarke Incorporated",
            corporationRep: 200000,
        }),
        "Fulcrum Secret Technologies": new Faction(ns, "Fulcrum Secret Technologies", {
            corp: "Fulcrum Technologies",
            corporationRep: 250000,
            backdoor: "fulcrumassets",
        }),
        "Slum Snakes": new Faction(ns, "Slum Snakes", {
            karma: -9,
            money: 1e6,
            combat: 30,
        }),
        Tetrads: new Faction(ns, "Tetrads", {
            karma: -18,
            combat: 75,
            locations: ["Chongqing", "New Tokyo", "Ishima"],
        }),
        Silhouette: new Faction(ns, "Silhouette", {
            karma: -22,
            money: 15e6,
            businessLeader: true,
        }),
        "Speakers for the Dead": new Faction(ns, "Speakers for the Dead", {
            karma: -45,
            hacking: 100,
            combat: 300,
            murder: 30,
            law: true,
        }),
        "The Dark Army": new Faction(ns, "The Dark Army", {
            karma: -45,
            hacking: 300,
            combat: 300,
            murder: 5,
            law: true,
            locations: "Chongqing",
        }),
        "The Syndicate": new Faction(ns, "The Syndicate", {
            karma: -90,
            hacking: 200,
            combat: 200,
            money: 10e6,
            law: true,
            locations: ["Aevum", "Sector-12"],
        }),
        "The Covenant": new Faction(ns, "The Covenant", {
            hacking: 850,
            combat: 850,
            money: 75e9,
            augmentations: 20,
        }),
        Daedalus: new Faction(ns, "Daedalus", {
            hacking: 2500,
            combat: 1500,
            money: 100e9,
            augmentations: 30,
            daedalus: true,
        }),
        Illuminati: new Faction(ns, "Illuminati", {
            hacking: 1500,
            combat: 1200,
            money: 150e9,
            augmentations: 30,
        }),
    };

    if (options.target) {
        if (factions[options.target]) {
            await factions[options.target].getInvite(ns);
        }
    } else {
        for (const faction of Object.values(factions)) {
            await faction.getInvite(ns);
        }
    }

    // for (const faction of factions) {
    // }

    // city priority:
    //   Chongqing [Neuregen Gene Modification]
    //   Sector-12 [CashRoot Starter Kit]
    //   Aevum [PCMatrix]
    //   New Tokyo --
    //   Ishima --
    //   Volhaven --

    if (options.c) return;

    if (
        ns.checkFactionInvitations().includes("Chongqing") &&
        !ns.getOwnedAugmentations(true).includes("Neuregen Gene Modification")
    ) {
        await factions["Chongqing"].join(ns);
    }

    if (
        ns.checkFactionInvitations().includes("Sector-12") &&
        !ns.getOwnedAugmentations(true).includes("CashRoot Starter Kit")
    ) {
        await factions["Sector-12"].join(ns);
    }

    if (ns.checkFactionInvitations().includes("Aevum") && !ns.getOwnedAugmentations(true).includes("PCMatrix")) {
        await factions["Aevum"].join(ns);
    }

    for (const faction of Object.values(factions)) {
        await faction.join(ns);
    }
}
