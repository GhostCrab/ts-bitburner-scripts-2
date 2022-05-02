import { NS, Server, Player } from "@ns";

function calculateIntelligenceBonus(intelligence: number, weight = 1): number {
    return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}

export function calculateHackLevelForTime(server: Server, player: Player, ms: number): number {
    const difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
    const hackTime = ms / 1000;
    const baseDiff = 500;
    const baseSkill = 50;
    const diffFactor = 2.5;
    const hackTimeMultiplier = 5;
  
    const difficultyFactor = diffFactor * difficultyMult + baseDiff;
    const speedFactor = player.hacking_speed_mult * calculateIntelligenceBonus(player.intelligence, 1);
  
    const hackLvl = (hackTimeMultiplier * difficultyFactor) / (hackTime * speedFactor) - baseSkill;
  
    return hackLvl;
  }

export async function main(ns: NS): Promise<void> {
    // try {
    //     //serverService = getServerService(ns);
    //     serverService = new ServerService(ns);
    // } catch (e) {
    //     ns.tprintf("ERROR: %s", e);
    //     return;
    // }
    // const server = serverService.loadServer("zb-def");
    // //const server = new Server(ns, "zb-def");

    // ns.tprintf("Hack Time Short: %f", ns.getHackTime("zb-def"));
    // ns.tprintf("Hack Time Long: %f", ns.getHackTime("zb-def", Number.MIN_VALUE));

    // const hl = server.hackLevelForTime(20*60*1000, ns.getPlayer());
    // ns.tprintf("Hack Level For Time: %f", server.hackLevelForTime(20*60*1000));
    // ns.tprintf("Target Hack Time: %f", ns.getHackTime("zb-def", hl))

    // ns.tprintf("Grow Time Short: %f", ns.getGrowTime("zb-def"));
    // ns.tprintf("Grow Time Long: %f", ns.getGrowTime("zb-def", Number.MIN_VALUE));

    // const gl = server.growLevelForTime(20*60*1000, ns.getPlayer());
    // ns.tprintf("Grow Level For Time: %f", server.growLevelForTime(20*60*1000));
    // ns.tprintf("Target Grow Time: %f", ns.getGrowTime("zb-def", gl))

    // ns.tprintf("Weaken Time Short: %f", ns.getWeakenTime("zb-def"));
    // ns.tprintf("Weaken Time Long: %f", ns.getWeakenTime("zb-def", Number.MIN_VALUE));

    // const wl = server.weakenLevelForTime(20*60*1000, ns.getPlayer());
    // ns.tprintf("Weaken Level For Time: %f", server.weakenLevelForTime(20*60*1000));
    // ns.tprintf("Target Weaken Time: %f", ns.getWeakenTime("zb-def", wl))

    ns.tail();
    const normalHackTime = ns.getHackTime("b-and-a", ns.getPlayer().hacking * 0.5);

    const hackTime = ns.formulas.hacking.hackTime(
        ns.getServer("b-and-a"),
        ns.getPlayer(),
        ns.getPlayer().hacking * 0.5
    );
    const hackLevel = ns.formulas.hacking.hackLevelForTime(ns.getServer("b-and-a"), ns.getPlayer(), hackTime);
    const hackLevel2 = calculateHackLevelForTime(ns.getServer("b-and-a"), ns.getPlayer(), hackTime);
    ns.tprintf("%f %f %f %f %f", ns.getPlayer().hacking * 0.5, normalHackTime, hackTime, hackLevel2, hackLevel);


    await ns.hack("b-and-a", {hackOverrideTiming: ns.getPlayer().hacking * 0.5});
}
