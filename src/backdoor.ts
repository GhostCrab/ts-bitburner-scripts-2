import { NS } from '@ns'
import { doBackdoor } from '/lib/util'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any,  @typescript-eslint/no-unused-vars
export function autocomplete(data: any, args: string[]): string[] {
    return data.servers;
}

export async function main(ns : NS) : Promise<void> {
    await doBackdoor(ns, String(ns.args[0]))
}