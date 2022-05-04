import { NS } from "@ns";
import { allHosts } from "lib/util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let options: any;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ["continuous", false],
    ["c", false],
];

function answerCCT(ns: NS, cct: CCT, answer: number | string[]) {
    try {
        const reward = ns.codingcontract.attempt(answer, cct.name, cct.host, { returnReward: true });

        if (reward === "") {
            ns.tprintf("ERROR: Failed to solve %s:%s of type %s", cct.host, cct.name, cct.type);
            ns.tprintf("  data: %s; answer: %s", cct.data.toString(), answer.toString());
        } else {
            ns.tprintf("SUCCESS: Solved %s:%s => %s", cct.host, cct.name, reward);
        }
    } catch (e) {
        ns.tprintf("Caught Exception: %s", e);
    }
}

class CCT {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [index: string]: any;

    name: string;
    host: string;
    type: string;
    desc: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solve: any;

    constructor(ns: NS, hostname: string, filename: string) {
        this.name = filename;
        this.host = hostname;
        this.type = ns.codingcontract.getContractType(filename, hostname);
        this.desc = ns.codingcontract.getDescription(filename, hostname);
        this.data = ns.codingcontract.getData(filename, hostname);

        switch (this.type) {
            case "Find Largest Prime Factor":
                this.solve = _.bind(CCT.solveFindLargestPrimeFactor, null, _, this);
                break;
            case "Subarray with Maximum Sum":
                this.solve = _.bind(CCT.solveSubarraywithMaximumSum, null, _, this);
                break;
            case "Total Ways to Sum":
                this.solve = _.bind(CCT.solveTotalWaystoSum, null, _, this);
                break;
            case "Total Ways to Sum II":
                this.solve = _.bind(CCT.solveTotalWaystoSumII, null, _, this);
                break;
            case "Spiralize Matrix":
                this.solve = _.bind(CCT.solveSpiralizeMatrix, null, _, this);
                break;
            case "Array Jumping Game":
                this.solve = _.bind(CCT.solveArrayJumpingGame, null, _, this);
                break;
            case "Array Jumping Game II":
                this.solve = _.bind(CCT.solveArrayJumpingGameII, null, _, this);
                break;
            case "Merge Overlapping Intervals":
                this.solve = _.bind(CCT.solveMergeOverlappingIntervals, null, _, this);
                break;
            case "Generate IP Addresses":
                this.solve = _.bind(CCT.solveGenerateIPAddresses, null, _, this);
                break;
            case "Algorithmic Stock Trader I":
                this.solve = _.bind(CCT.solveAlgorithmicStockTraderI, null, _, this);
                break;
            case "Algorithmic Stock Trader II":
                this.solve = _.bind(CCT.solveAlgorithmicStockTraderII, null, _, this);
                break;
            case "Algorithmic Stock Trader III":
                this.solve = _.bind(CCT.solveAlgorithmicStockTraderIII, null, _, this);
                break;
            case "Algorithmic Stock Trader IV":
                this.solve = _.bind(CCT.solveAlgorithmicStockTraderIV, null, _, this);
                break;
            case "Minimum Path Sum in a Triangle":
                this.solve = _.bind(CCT.solveMinimumPathSuminaTriangle, null, _, this);
                break;
            case "Unique Paths in a Grid I":
                this.solve = _.bind(CCT.solveUniquePathsinaGridI, null, _, this);
                break;
            case "Unique Paths in a Grid II":
                this.solve = _.bind(CCT.solveUniquePathsinaGridII, null, _, this);
                break;
            case "Shortest Path in a Grid":
                this.solve = _.bind(CCT.solveShortestPathinaGrid, null, _, this);
                break;
            case "Sanitize Parentheses in Expression":
                this.solve = _.bind(CCT.solveSanitizeParenthesesinExpression, null, _, this);
                break;
            case "Find All Valid Math Expressions":
                this.solve = _.bind(CCT.solveFindAllValidMathExpressions, null, _, this);
                break;
            case "HammingCodes: Integer to Encoded Binary":
                this.solve = _.bind(CCT.solveHammingCodesIntegertoEncodedBinary, null, _, this);
                break;
            case "HammingCodes: Encoded Binary to Integer":
                this.solve = _.bind(CCT.solveHammingCodesEncodedBinarytoInteger, null, _, this);
                break;
            case "Proper 2-Coloring of a Graph":
                this.solve = _.bind(CCT.solveProper2ColoringofaGraph, null, _, this);
                break;
            case "Compression I: RLE Compression":
                this.solve = _.bind(CCT.solveCompressionIRLECompression, null, _, this);
                break;
            case "Compression II: LZ Decompression":
                this.solve = _.bind(CCT.solveCompressionIILZDecompression, null, _, this);
                break;
            case "Compression III: LZ Compression":
                this.solve = _.bind(CCT.solveCompressionIIILZCompression, null, _, this);
                break;
        }

        //this.print(ns);
    }

    print(ns: NS) {
        ns.tprintf("%s %s:", this.host, this.name);
        ns.tprintf("  %s", this.type);
        ns.tprintf("  %s", this.desc);
        ns.tprintf("  %s", this.data);
    }

    static solveTotalWaystoSum(ns: NS, cct: CCT) {
        const ways: number[] = [1];
        ways.length = cct.data + 1;
        ways.fill(0, 1);
        for (let i = 1; i < cct.data; ++i) {
            for (let j: number = i; j <= cct.data; ++j) {
                ways[j] += ways[j - i];
            }
        }

        answerCCT(ns, cct, ways[cct.data]);
    }

    static solveTotalWaystoSumII(ns: NS, cct: CCT) {
        const data = cct.data;
        const n = data[0];
        const s = data[1];
        const ways: number[] = [1];
        ways.length = n + 1;
        ways.fill(0, 1);
        for (let i = 0; i < s.length; i++) {
            for (let j = s[i]; j <= n; j++) {
                ways[j] += ways[j - s[i]];
            }
        }

        answerCCT(ns, cct, ways[n]);
    }

    static solveSubarraywithMaximumSum(ns: NS, cct: CCT) {
        const nums: number[] = cct.data.slice();
        for (let i = 1; i < nums.length; i++) {
            nums[i] = Math.max(nums[i], nums[i] + nums[i - 1]);
        }

        answerCCT(ns, cct, Math.max(...nums));
    }

    static solveSpiralizeMatrix(ns: NS, cct: CCT) {
        const spiral = [];
        const m = cct.data.length;
        const n = cct.data[0].length;
        let u = 0;
        let d = m - 1;
        let l = 0;
        let r = n - 1;
        let k = 0;
        while (true) {
            // Up
            for (let col = l; col <= r; col++) {
                spiral[k] = cct.data[u][col];
                ++k;
            }
            if (++u > d) {
                break;
            }

            // Right
            for (let row = u; row <= d; row++) {
                spiral[k] = cct.data[row][r];
                ++k;
            }
            if (--r < l) {
                break;
            }

            // Down
            for (let col = r; col >= l; col--) {
                spiral[k] = cct.data[d][col];
                ++k;
            }
            if (--d < u) {
                break;
            }

            // Left
            for (let row = d; row >= u; row--) {
                spiral[k] = cct.data[row][l];
                ++k;
            }
            if (++l > r) {
                break;
            }
        }

        answerCCT(ns, cct, spiral);
    }

    static solveArrayJumpingGame(ns: NS, cct: CCT) {
        const n = cct.data.length;
        let i = 0;
        for (let reach = 0; i < n && i <= reach; ++i) {
            reach = Math.max(i + cct.data[i], reach);
        }

        answerCCT(ns, cct, i === n ? 1 : 0);
    }

    static solveArrayJumpingGameII(ns: NS, cct: CCT) {
        const data = cct.data;
        const n: number = data.length;
        let reach = 0;
        let jumps = 0;
        let lastJump = -1;
        while (reach < n - 1) {
            let jumpedFrom = -1;
            for (let i = reach; i > lastJump; i--) {
                if (i + data[i] > reach) {
                    reach = i + data[i];
                    jumpedFrom = i;
                }
            }
            if (jumpedFrom === -1) {
                jumps = 0;
                break;
            }
            lastJump = jumpedFrom;
            jumps++;
        }

        answerCCT(ns, cct, jumps);
    }

    static solveMergeOverlappingIntervals(ns: NS, cct: CCT) {
        function convert2DArrayToString(arr: number[][]): string {
            const components: string[] = [];
            arr.forEach((e: number[]) => {
                let s: string = e.toString();
                s = ["[", s, "]"].join("");
                components.push(s);
            });

            return components.join(",").replace(/\s/g, "");
        }

        const intervals: number[][] = cct.data.slice();
        intervals.sort((a, b) => {
            return a[0] - b[0];
        });

        const result: number[][] = [];
        let start: number = intervals[0][0];
        let end: number = intervals[0][1];
        for (const interval of intervals) {
            if (interval[0] <= end) {
                end = Math.max(end, interval[1]);
            } else {
                result.push([start, end]);
                start = interval[0];
                end = interval[1];
            }
        }
        result.push([start, end]);

        answerCCT(ns, cct, [convert2DArrayToString(result)]);
    }

    static solveGenerateIPAddresses(ns: NS, cct: CCT) {
        function validate(str: string) {
            if (str === "0") return true;
            if (str.length > 1 && str[0] === "0") return false;
            if (str.length > 3) return false;
            return parseInt(str) < 255;
        }

        const results = [];
        for (let i = 1; i <= 3; i++) {
            if (cct.data.length - i > 9) continue;

            const a = cct.data.substr(0, i);

            if (!validate(a)) continue;

            for (let j = 1; j <= 3; j++) {
                if (cct.data.length - (i + j) > 6) continue;

                const b = cct.data.substr(i, j);

                if (!validate(b)) continue;

                for (let k = 1; k <= 3; k++) {
                    if (cct.data.length - (i + j + k) > 3) continue;

                    const c = cct.data.substr(i + j, k);
                    const d = cct.data.substr(i + j + k);

                    if (validate(c) && validate(d)) {
                        results.push(a + "." + b + "." + c + "." + d);
                    }
                }
            }
        }

        answerCCT(ns, cct, results);
    }

    static solveAlgorithmicStockTraderI(ns: NS, cct: CCT) {
        let maxCur = 0;
        let maxSoFar = 0;
        for (let i = 1; i < cct.data.length; ++i) {
            maxCur = Math.max(0, (maxCur += cct.data[i] - cct.data[i - 1]));
            maxSoFar = Math.max(maxCur, maxSoFar);
        }

        answerCCT(ns, cct, maxSoFar);
    }

    static solveAlgorithmicStockTraderII(ns: NS, cct: CCT) {
        let profit = 0;
        for (let p = 1; p < cct.data.length; ++p) {
            profit += Math.max(cct.data[p] - cct.data[p - 1], 0);
        }

        answerCCT(ns, cct, profit);
    }

    static solveAlgorithmicStockTraderIII(ns: NS, cct: CCT) {
        let hold1 = Number.MIN_SAFE_INTEGER;
        let hold2 = Number.MIN_SAFE_INTEGER;
        let release1 = 0;
        let release2 = 0;
        for (const price of cct.data) {
            release2 = Math.max(release2, hold2 + price);
            hold2 = Math.max(hold2, release1 - price);
            release1 = Math.max(release1, hold1 + price);
            hold1 = Math.max(hold1, price * -1);
        }

        answerCCT(ns, cct, release2);
    }

    static solveAlgorithmicStockTraderIV(ns: NS, cct: CCT) {
        const k: number = cct.data[0];
        const prices: number[] = cct.data[1];

        const len = prices.length;
        if (len < 2) {
            answerCCT(ns, cct, 0);
            return;
        }
        if (k > len / 2) {
            let res = 0;
            for (let i = 1; i < len; ++i) {
                res += Math.max(prices[i] - prices[i - 1], 0);
            }

            answerCCT(ns, cct, res);
            return;
        }

        const hold: number[] = [];
        const rele: number[] = [];
        hold.length = k + 1;
        rele.length = k + 1;
        for (let i = 0; i <= k; ++i) {
            hold[i] = Number.MIN_SAFE_INTEGER;
            rele[i] = 0;
        }

        let cur: number;
        for (let i = 0; i < len; ++i) {
            cur = prices[i];
            for (let j = k; j > 0; --j) {
                rele[j] = Math.max(rele[j], hold[j] + cur);
                hold[j] = Math.max(hold[j], rele[j - 1] - cur);
            }
        }

        answerCCT(ns, cct, rele[k]);
    }

    static solveMinimumPathSuminaTriangle(ns: NS, cct: CCT) {
        const n: number = cct.data.length;
        const dp: number[] = cct.data[n - 1].slice();
        for (let i = n - 2; i > -1; --i) {
            for (let j = 0; j < cct.data[i].length; ++j) {
                dp[j] = Math.min(dp[j], dp[j + 1]) + cct.data[i][j];
            }
        }

        answerCCT(ns, cct, dp[0]);
    }

    static solveUniquePathsinaGridI(ns: NS, cct: CCT) {
        const n = cct.data[0]; // Number of rows
        const m = cct.data[1]; // Number of columns
        const currentRow = [];
        currentRow.length = n;

        for (let i = 0; i < n; i++) {
            currentRow[i] = 1;
        }
        for (let row = 1; row < m; row++) {
            for (let i = 1; i < n; i++) {
                currentRow[i] += currentRow[i - 1];
            }
        }

        answerCCT(ns, cct, currentRow[n - 1]);
    }

    static solveUniquePathsinaGridII(ns: NS, cct: CCT) {
        const obstacleGrid = [];
        obstacleGrid.length = cct.data.length;
        for (let i = 0; i < obstacleGrid.length; ++i) {
            obstacleGrid[i] = cct.data[i].slice();
        }

        for (let i = 0; i < obstacleGrid.length; i++) {
            for (let j = 0; j < obstacleGrid[0].length; j++) {
                if (obstacleGrid[i][j] == 1) {
                    obstacleGrid[i][j] = 0;
                } else if (i == 0 && j == 0) {
                    obstacleGrid[0][0] = 1;
                } else {
                    obstacleGrid[i][j] = (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0);
                }
            }
        }

        answerCCT(ns, cct, obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1]);
    }

    static solveShortestPathinaGrid(ns: NS, cct: CCT) {
        const data = cct.data;
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

        // for (let y = 0; y < height; y++) {
        //     let xstr = "";
        //     for (let x = 0; x < width; x++) {
        //         const n = paths[y][x];
        //         const nstr = n ? `[${translate(y, x, n[0], n[1])}]` : "[ ]";
        //         xstr = ns.sprintf("%s%s", xstr, validPosition(y, x) ? nstr : "[-]");
        //     }
        //     ns.tprintf(xstr);
        // }

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

        answerCCT(ns, cct, [path]);
    }

    static solveSanitizeParenthesesinExpression(ns: NS, cct: CCT) {
        let left = 0;
        let right = 0;
        const res: string[] = [];

        for (let i = 0; i < cct.data.length; ++i) {
            if (cct.data[i] === "(") {
                ++left;
            } else if (cct.data[i] === ")") {
                left > 0 ? --left : ++right;
            }
        }

        function dfs(
            pair: number,
            index: number,
            left: number,
            right: number,
            s: string,
            solution: string,
            res: string[]
        ): void {
            if (s.length === index) {
                if (left === 0 && right === 0 && pair === 0) {
                    for (let i = 0; i < res.length; i++) {
                        if (res[i] === solution) {
                            return;
                        }
                    }
                    res.push(solution);
                }
                return;
            }

            if (s[index] === "(") {
                if (left > 0) {
                    dfs(pair, index + 1, left - 1, right, s, solution, res);
                }
                dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
            } else if (s[index] === ")") {
                if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
                if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
            } else {
                dfs(pair, index + 1, left, right, s, solution + s[index], res);
            }
        }

        dfs(0, 0, left, right, cct.data, "", res);

        answerCCT(ns, cct, res);
    }

    static solveFindAllValidMathExpressions(ns: NS, cct: CCT) {
        const num: string = cct.data[0];
        const target: number = cct.data[1];

        function helper(
            res: string[],
            path: string,
            num: string,
            target: number,
            pos: number,
            evaluated: number,
            multed: number
        ): void {
            if (pos === num.length) {
                if (target === evaluated) {
                    res.push(path);
                }
                return;
            }

            for (let i = pos; i < num.length; ++i) {
                if (i != pos && num[pos] == "0") {
                    break;
                }
                const cur = parseInt(num.substring(pos, i + 1));

                if (pos === 0) {
                    helper(res, path + cur, num, target, i + 1, cur, cur);
                } else {
                    helper(res, path + "+" + cur, num, target, i + 1, evaluated + cur, cur);
                    helper(res, path + "-" + cur, num, target, i + 1, evaluated - cur, -cur);
                    helper(res, path + "*" + cur, num, target, i + 1, evaluated - multed + multed * cur, multed * cur);
                }
            }
        }

        const result: string[] = [];
        helper(result, "", num, target, 0, 0, 0);

        answerCCT(ns, cct, result);
    }

    static solveHammingCodesIntegertoEncodedBinary(ns: NS, cct: CCT) {
        answerCCT(ns, cct, [HammingEncode(cct.data)]);
    }

    static solveHammingCodesEncodedBinarytoInteger(ns: NS, cct: CCT) {
        answerCCT(ns, cct, HammingDecode(cct.data));
    }

    static solveProper2ColoringofaGraph(ns: NS, cct: CCT) {
        // const data = cct.data;

        // function neighbourhood(vertex: number): number[] {
        //     const adjLeft = data[1].filter(([a, _]) => a == vertex).map(([_, b]) => b);
        //     const adjRight = data[1].filter(([_, b]) => b == vertex).map(([a, _]) => a);
        //     return adjLeft.concat(adjRight);
        // }

        // //Verify that there is no solution by attempting to create a proper 2-coloring.
        // const coloring: (number | undefined)[] = Array(data[0]).fill(undefined);
        // while (coloring.some((val) => val === undefined)) {
        //     //Color a vertex in the graph
        //     const initialVertex: number = coloring.findIndex((val) => val === undefined);
        //     coloring[initialVertex] = 0;
        //     const frontier: number[] = [initialVertex];

        //     //Propogate the coloring throughout the component containing v greedily
        //     while (frontier.length > 0) {
        //         const v: number = frontier.pop() || 0;
        //         const neighbors: number[] = neighbourhood(v);

        //         //For each vertex u adjacent to v
        //         for (const id in neighbors) {
        //             const u: number = neighbors[id];

        //             //Set the color of u to the opposite of v's color if it is new,
        //             //then add u to the frontier to continue the algorithm.
        //             if (coloring[u] === undefined) {
        //                 if (coloring[v] === 0) coloring[u] = 1;
        //                 else coloring[u] = 0;

        //                 frontier.push(u);
        //             }

        //             //Assert u,v do not have the same color
        //             else if (coloring[u] === coloring[v]) {
        //                 //If u,v do have the same color, no proper 2-coloring exists, meaning
        //                 //the player was correct to say there is no proper 2-coloring of the graph.
        //                 answerCCT(ns, cct, []);
        //                 return;
        //             }
        //         }
        //     }
        // }

        answerCCT(ns, cct, 0);
    }

    static solveCompressionIRLECompression(ns: NS, cct: CCT) {
        answerCCT(ns, cct, 0);
    }

    static solveCompressionIILZDecompression(ns: NS, cct: CCT) {
        answerCCT(ns, cct, 0);
    }

    static solveCompressionIIILZCompression(ns: NS, cct: CCT) {
        answerCCT(ns, cct, 0);
    }

    static solveFindLargestPrimeFactor(ns: NS, cct: CCT) {
        let fac = 2;
        let n = cct.data;
        while (n > (fac - 1) * (fac - 1)) {
            while (n % fac === 0) {
                n = Math.round(n / fac);
            }
            ++fac;
        }

        answerCCT(ns, cct, n === 1 ? fac - 1 : n);
    }
}

export async function main(ns: NS): Promise<void> {
    try {
        options = ns.flags(argsSchema);
    } catch (e) {
        ns.tprintf("ERROR: %s", e);
        return;
    }

    options.continuous = options.continuous || options.c;

    const hosts = allHosts(ns);
    while (true) {
        const ccts = [];
        for (const hostname of hosts) {
            const ls = ns.ls(hostname).filter((filename) => filename.indexOf(".cct") !== -1);

            if (ls.length === 0) continue;

            ccts.push(new CCT(ns, hostname, ls[0]));
        }

        for (const cct of ccts) {
            cct.solve(ns);
        }

        if (!options.continuous) break;

        await ns.sleep(60 * 1000);
    }
}

function HammingDecode(_data: string): number {
    //check for altered bit and decode
    const _build = _data.split(""); // ye, an array for working, again
    const _testArray = []; //for the "truthtable". if any is false, the data has an altered bit, will check for and fix it
    const _sumParity = Math.ceil(Math.log2(_data.length)); // sum of parity for later use
    const count = (arr: Array<string>, val: string): number =>
        arr.reduce((a: number, v: string) => (v === val ? a + 1 : a), 0);
    // the count.... again ;)

    let _overallParity = _build.splice(0, 1).join(""); // store first index, for checking in next step and fix the _build properly later on
    _testArray.push(_overallParity == (count(_build, "1") % 2).toString() ? true : false); // first check with the overall parity bit
    for (let i = 0; i < _sumParity; i++) {
        // for the rest of the remaining parity bits we also "check"
        const _tempIndex = Math.pow(2, i) - 1; // get the parityBits Index
        const _tempStep = _tempIndex + 1; // set the stepsize
        const _tempData = [..._build]; // get a "copy" of the build-data for working
        const _tempArray = []; // init empty array for "testing"
        while (_tempData[_tempIndex] != undefined) {
            // extract from the copied data until the "starting" index is undefined
            const _temp = [..._tempData.splice(_tempIndex, _tempStep * 2)]; // extract 2*stepsize
            _tempArray.push(..._temp.splice(0, _tempStep)); // and cut again for keeping first half
        }
        const _tempParity = _tempArray.shift(); // and again save the first index separated for checking with the rest of the data
        _testArray.push(_tempParity == (count(_tempArray, "1") % 2).toString() ? true : false);
        // is the _tempParity the calculated data? push answer into the 'truthtable'
    }
    let _fixIndex = 0; // init the "fixing" index and start with 0
    for (let i = 1; i < _sumParity + 1; i++) {
        // simple binary adding for every boolean in the _testArray, starting from 2nd index of it
        _fixIndex += _testArray[i] ? 0 : Math.pow(2, i) / 2;
    }
    _build.unshift(_overallParity); // now we need the "overall" parity back in it's place
    // try fix the actual encoded binary string if there is an error
    if (_fixIndex > 0 && _testArray[0] == false) {
        // if the overall is false and the sum of calculated values is greater equal 0, fix the corresponding hamming-bit
        _build[_fixIndex] = _build[_fixIndex] == "0" ? "1" : "0";
    } else if (_testArray[0] == false) {
        // otherwise, if the the overall_parity is the only wrong, fix that one
        _overallParity = _overallParity == "0" ? "1" : "0";
    } else if (_testArray[0] == true && _testArray.some((truth) => truth == false)) {
        return 0; // uhm, there's some strange going on... 2 bits are altered? How? This should not happen 👀
    }
    // oof.. halfway through... we fixed an possible altered bit, now "extract" the parity-bits from the _build
    for (let i = _sumParity; i >= 0; i--) {
        // start from the last parity down the 2nd index one
        _build.splice(Math.pow(2, i), 1);
    }
    _build.splice(0, 1); // remove the overall parity bit and we have our binary value
    return parseInt(_build.join(""), 2); // parse the integer with redux 2 and we're done!
}

export function HammingEncode(value: number): string {
    // encoding following Hammings rule
    function HammingSumOfParity(_lengthOfDBits: number): number {
        // will calculate the needed amount of parityBits 'without' the "overall"-Parity (that math took me 4 Days to get it working)
        return _lengthOfDBits < 3 || _lengthOfDBits == 0 // oh and of course using ternary operators, it's a pretty neat function
            ? _lengthOfDBits == 0
                ? 0
                : _lengthOfDBits + 1
            : // the following math will only work, if the length is greater equal 3, otherwise it's "kind of" broken :D
            Math.ceil(Math.log2(_lengthOfDBits * 2)) <=
              Math.ceil(Math.log2(1 + _lengthOfDBits + Math.ceil(Math.log2(_lengthOfDBits))))
            ? Math.ceil(Math.log2(_lengthOfDBits) + 1)
            : Math.ceil(Math.log2(_lengthOfDBits));
    }
    const _data = value.toString(2).split(""); // first, change into binary string, then create array with 1 bit per index
    const _sumParity: number = HammingSumOfParity(_data.length); // get the sum of needed parity bits (for later use in encoding)
    const count = (arr: Array<string>, val: string): number =>
        arr.reduce((a: number, v: string) => (v === val ? a + 1 : a), 0);
    // function count for specific entries in the array, for later use

    const _build = ["x", "x", ..._data.splice(0, 1)]; // init the "pre-build"
    for (let i = 2; i < _sumParity; i++) {
        // add new paritybits and the corresponding data bits (pre-building array)
        _build.push("x", ..._data.splice(0, Math.pow(2, i) - 1));
    }
    // now the "calculation"... get the paritybits ('x') working
    for (const index of _build.reduce(function (a: Array<number>, e: string, i: number) {
        if (e == "x") a.push(i);
        return a;
    }, [])) {
        // that reduce will result in an array of index numbers where the "x" is placed
        const _tempcount = index + 1; // set the "stepsize" for the parityBit
        const _temparray = []; // temporary array to store the extracted bits
        const _tempdata = [..._build]; // only work with a copy of the _build
        while (_tempdata[index] !== undefined) {
            // as long as there are bits on the starting index, do "cut"
            const _temp: Array<string> = _tempdata.splice(index, _tempcount * 2); // cut stepsize*2 bits, then...
            _temparray.push(..._temp.splice(0, _tempcount)); // ... cut the result again and keep the first half
        }
        _temparray.splice(0, 1); // remove first bit, which is the parity one
        _build[index] = (count(_temparray, "1") % 2).toString(); // count with remainder of 2 and"toString" to store the parityBit
    } // parity done, now the "overall"-parity is set
    _build.unshift((count(_build, "1") % 2).toString()); // has to be done as last element
    return _build.join(""); // return the _build as string
}
