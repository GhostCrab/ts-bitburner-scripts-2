import { NS } from "@ns";

function getRandomInt(min: number, max: number): number {
    const lower: number = Math.min(min, max);
    const upper: number = Math.max(min, max);

    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function gen(): number[][] {
    const height = getRandomInt(6, 12);
    const width = getRandomInt(6, 12);
    const dstY = height - 1;
    const dstX = width - 1;
    const minPathLength = dstY + dstX; // Math.abs(dstY - srcY) + Math.abs(dstX - srcX)

    const grid: number[][] = new Array(height);
    for (let y = 0; y < height; y++) grid[y] = new Array(width).fill(0);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (y == 0 && x == 0) continue; // Don't block start
            if (y == dstY && x == dstX) continue; // Don't block destination

            // Generate more obstacles the farther a position is from start and destination.
            // Raw distance factor peaks at 50% at half-way mark. Rescale to 40% max.
            // Obstacle chance range of [15%, 40%] produces ~78% solvable puzzles
            const distanceFactor = (Math.min(y + x, dstY - y + dstX - x) / minPathLength) * 0.8;
            if (Math.random() < Math.max(0.15, distanceFactor)) grid[y][x] = 1;
        }
    }

    return grid;
}

export async function main(ns: NS): Promise<void> {
    const grid = gen();
    const data = grid;
    const width = data[0].length;
    const height = data.length;
    const dstY = height - 1;
    const dstX = width - 1;

    const paths: ([number, number] | undefined)[][] = new Array(height);
    for (let y = 0; y < height; y++) {
        paths[y] = new Array(width);
    }

    function validPosition(y: number, x: number): boolean {
        return y >= 0 && y < height && x >= 0 && x < width && data[y][x] == 0;
    }

    // List in-bounds and passable neighbors
    function* neighbors(y: number, x: number): Generator<[number, number]> {
        if (validPosition(y - 1, x)) yield [y - 1, x]; // Up
        if (validPosition(y + 1, x)) yield [y + 1, x]; // Down
        if (validPosition(y, x - 1)) yield [y, x - 1]; // Left
        if (validPosition(y, x + 1)) yield [y, x + 1]; // Right
    }

    // Prepare starting point
    paths[0][0] = [-1, -1];
    const queue: ([number, number] | undefined)[] = [[0, 0]];
    while (queue.length > 0) {
        const cur = queue.shift();
        if (!cur) break;

        for (const n of neighbors(cur[0], cur[1])) {
            const y = n[0];
            const x = n[1];
            if (!paths[y][x]) {
                paths[y][x] = cur;
                queue.push(n);
            }
        }
    }

    if (paths[dstY][dstX]) {
        ns.tprintf("CAN COMPLETE");
    } else {
        ns.tprintf("CANT COMPLETE");
    }

    function translate(cy: number, cx: number, ny: number, nx: number): string {
        if (ny === -1 && nx === -1) return "X";

        if (cy === ny) {
            if (cx > nx) return "L";
            return "R";
        }
        if (cy > ny) {
            return "U";
        }
        return "D";
    }

    for (let y = 0; y < height; y++) {
        let xstr = "";
        for (let x = 0; x < width; x++) {
            const n = paths[y][x];
            const nstr = n ? `[${translate(y, x, n[0], n[1])}]` : "[ ]";
            xstr = ns.sprintf("%s%s", xstr, validPosition(y, x) ? nstr : "[-]");
        }
        ns.tprintf(xstr);
    }

    // reverse the path
    let path = "";
    let cur = [dstY, dstX];
    while (validPosition(cur[0], cur[1])) {
        const cy = cur[0];
        const cx = cur[1];
        const n = paths[cy][cx];
        if (!n) break;
        const ny = n[0];
        const nx = n[1];
        switch (translate(cy, cx, ny, nx)) {
            case "L":
                path = "R" + path;
                break;
            case "R":
                path = "L" + path;
                break;
            case "U":
                path = "D" + path;
                break;
            case "D":
                path = "U" + path;
                break;
        }
        cur = n;
    }

    ns.tprintf(path);
}
