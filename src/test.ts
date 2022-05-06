import { NS } from "@ns";

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


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main(ns: NS): Promise<void> {
    playerProp = findProp("player");
    console.log(playerProp);
}
