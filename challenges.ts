type TestCase = {
  input: string;
  output: string;
  points: number;
};

type Challenge = {
  name: string;
  type: "string" | "number";
  info: string;
  test: TestCase[];
};

// --- Generators ---

function genMinimalSubarrayLength(): TestCase[] {
  const inputs = [
    { s: 15, arr: [2, 3, 1, 2, 4, 3, 8] },
    { s: 20, arr: [1, 1, 1, 1, 1] },
    { s: 14, arr: [3, 3, 3, 3, 3] },
    { s: 7, arr: [2, 3, 1, 2, 4, 3] },
    { s: 4, arr: [1, 4, 4] },
    { s: 11, arr: [1, 1, 1, 1, 1, 1, 1, 1] },
    { s: 10, arr: [1, 2, 3, 4, 5] },
    { s: 5, arr: [5] },
    { s: 100, arr: [10, 20, 30, 40, 50] },
    { s: 8, arr: [1, 2, 1, 2, 1, 2, 1, 2] },
  ];
  return inputs.map(({ s, arr }) => {
    let minLen = Infinity;
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      for (let j = i; j < arr.length; j++) {
        sum += arr[j];
        if (sum >= s) {
          minLen = Math.min(minLen, j - i + 1);
          break;
        }
      }
    }
    return {
      input: `${arr.length} ${s}\n${arr.join(" ")}\n`,
      output: `Enter array length and target sum: ${arr.length} ${s}\nEnter array values: ${arr.join(" ")}\nMinimal Subarray Length: ${minLen === Infinity ? "0" : minLen}`,
      points: 2,
    };
  });
}

function genDiagonalBalance(): TestCase[] {
  const inputs = [
    [[5, 0, 2], [0, 0, 0], [1, 0, 4]],
    [[1, 2], [3, 4]],
    [[1, 0], [0, 1]],
    [[2, 1, 1], [0, -1, 0], [1, 1, 2]],
    [[5, 5], [5, 5]],
    [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
    [[0, 0], [0, 0]],
    [[-1, 2], [3, -1]],
    [[10, 0, 0], [0, 10, 0], [0, 0, 10]],
    [[2, 0, 0], [0, 2, 0], [0, 0, -2]],
  ];
  return inputs.map((mat) => {
    const n = mat.length;
    let main = 0, anti = 0;
    for (let i = 0; i < n; i++) { main += mat[i][i]; anti += mat[i][n - 1 - i]; }
    let out = "IMPOSSIBLE";
    if (main === anti) out = "-1 -1";
    else {
      let found = false;
      for (let r = 0; r < n && !found; r++) {
        let nMain = main - mat[r][r] + (-mat[r][r]);
        let nAnti = anti - mat[r][n - 1 - r] + (-mat[r][n - 1 - r]);
        if (nMain === nAnti) { out = `R ${r}`; found = true; }
      }
      for (let c = 0; c < n && !found; c++) {
        let nMain = main - mat[c][c] + (-mat[c][c]);
        let nAnti = anti - mat[n - 1 - c][c] + (-mat[n - 1 - c][c]);
        if (nMain === nAnti) { out = `C ${c}`; found = true; }
      }
    }
    let outStr = `Enter matrix size: ${n}\n`;
    mat.forEach((r, i) => { outStr += `Enter matrix row ${i + 1}: ${r.join(" ")}\n`; });
    outStr += `Operation: ${out}`;
    return {
      input: `${n}\n${mat.map(r => r.join(" ")).join("\n")}\n`,
      output: outStr,
      points: 3,
    };
  });
}

function genSubarraySumConstraint(): TestCase[] {
  const inputs = [
    { s: 7, l: 2, arr: [1, 2, 3, 4, 5] },
    { s: 10, l: 1, arr: [1, 1, 1, 1] },
    { s: 5, l: 1, arr: [10, 20, 30] },
    { s: 15, l: 3, arr: [2, 4, 6, 8, 10] },
    { s: 0, l: 1, arr: [0, 0, 0] },
    { s: 100, l: 2, arr: [50, 50, 50] },
    { s: 8, l: 2, arr: [3, 1, 2, 5, 1] },
    { s: 5, l: 2, arr: [2, 2, 2, 2] },
    { s: 20, l: 4, arr: [1, 2, 3, 4, 5, 6] },
    { s: 3, l: 1, arr: [1, 2, 3] }
  ];
  return inputs.map(({ s, l, arr }) => {
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      for (let j = i; j < arr.length; j++) {
        sum += arr[j];
        if (j - i + 1 >= l && sum <= s) count++;
      }
    }
    return {
      input: `${arr.length} ${s} ${l}\n${arr.join(" ")}\n`,
      output: `Enter array length, target sum, and min length: ${arr.length} ${s} ${l}\nEnter array values: ${arr.join(" ")}\nValid Subarrays: ${count}`,
      points: 2.5,
    };
  });
}

function genSlidingWindowTolerance(): TestCase[] {
  const inputs = [
    { w: 4, t: 5, arr: [10, 12, 11, 15, 16, 14, 2] },
    { w: 3, t: 2, arr: [1, 2, 3, 4, 5, 6] },
    { w: 5, t: 10, arr: [100] },
    { w: 2, t: 0, arr: [5, 5, 5, 5] },
    { w: 3, t: 10, arr: [1, 20, 3, 40, 5] },
    { w: 4, t: 3, arr: [1, 2, 1, 2, 1, 2] },
    { w: 2, t: 5, arr: [10, 15, 20, 25, 30] },
    { w: 5, t: 50, arr: [10, 20, 30, 40, 50, 60] },
    { w: 3, t: 1, arr: [1, 1, 2, 2, 3, 3] },
    { w: 1, t: 0, arr: [1, 2, 3] }
  ];
  return inputs.map(({ w, t, arr }) => {
    let valid = 0;
    for (let i = 0; i <= arr.length - w; i++) {
      const window = arr.slice(i, i + w);
      if (Math.max(...window) - Math.min(...window) <= t) valid++;
    }
    return {
      input: `${w} ${t}\n${arr.join(" ")} -1\n`,
      output: `Enter window size and tolerance: ${w} ${t}\nEnter data stream (end with -1): ${arr.join(" ")} -1\nValid Windows: ${valid}`,
      points: 2,
    };
  });
}

function genVowelConsonantBalance(): TestCase[] {
  const inputs = [
    "AEIOUBCDFG", "A", "ABABAB", "HELLO", "WORLD",
    "ZZZAAA", "BCDFGH", "AEIOU", "ABACABADABACABA", "QWERTYUIOP"
  ];
  return inputs.map(str => {
    let max = 0;
    for (let i = 0; i < str.length; i++) {
      let v = 0, c = 0;
      for (let j = i; j < str.length; j++) {
        if ("AEIOU".includes(str[j])) v++; else c++;
        if (v === c) max = Math.max(max, j - i + 1);
      }
    }
    return { 
      input: `${str}\n`, 
      output: `Enter string: ${str}\nLongest Balanced Substring Length: ${max}`, 
      points: 2.5 
    };
  });
}

function genConsecutivePlateaus(): TestCase[] {
  const inputs = [
    [1, 2, 2, 3, 3, 3, 4, 5, 5],
    [10, 10, 10, 10, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 1, 2, 2, 3, 3],
    [5, 5],
    [1, 2, 1, 2, 1],
    [9, 9, 9, 8, 8, 7, 7, 7, 7],
    [2, 2, 3, 4, 4, 5, 6, 6],
    [1],
    [1, 1, 1, 2, 3, 3, 3, 4, 5, 5, 5]
  ];
  return inputs.map(arr => {
    let count = 0, i = 0;
    while (i < arr.length) {
      let j = i + 1;
      while (j < arr.length && arr[j] === arr[i]) j++;
      if (j - i >= 2) count++;
      i = j;
    }
    return { 
      input: `${arr.join(" ")} 0\n`, 
      output: `Enter sequence (end with 0): ${arr.join(" ")} 0\nPlateaus Count: ${count}`, 
      points: 1.5 
    };
  });
}

function genEvenMedian(): TestCase[] {
  const inputs = [
    [4, 6, 2, 8, 3, 4, 1],
    [1, 3, 5],
    [2, 1, 3, 5, 4],
    [10, 20, 30, 40],
    [7, 7, 7, 7, 7],
    [12, 15, 18, 21, 24],
    [2, 4, 6, 8, 10, 12],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [100, 50, 25, 75, 125],
    [3, 1, 4, 1, 5, 9, 2]
  ];
  return inputs.map(arr => {
    const sorted = [...arr].sort((a, b) => a - b);
    let m = sorted[Math.floor(sorted.length / 2)];
    let out = m % 2 !== 0 ? m + 1 : m;
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nEven Median: ${out}`, 
      points: 1.5 
    };
  });
}

function genFindTheSpy(): TestCase[] {
  const inputs = [
    [6, 7, 2, 4, 8, 3, 2],
    [1, 9, 5, 1, 4],
    [10, 11, 12, 10],
    [5, 5],
    [1, 2, 3, 4, 5, 3],
    [9, 8, 7, 8],
    [2, 4, 6, 8, 4],
    [3, 1, 4, 1, 5],
    [7, 7, 2],
    [100, 200, 300, 200]
  ];
  return inputs.map(arr => {
    const seen = new Set();
    let spy = -1;
    for (const n of arr) { if (seen.has(n)) spy = n; seen.add(n); }
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter length of array: ${arr.length}\nValues: ${arr.join(" ")}\nOutput: ${spy}`, 
      points: 1.5 
    };
  });
}

function genStringRotation(): TestCase[] {
  const inputs = ["Cpe", "Cat", "Hi", "A", "Code", "Test", "Rotate", "JS", "World", "Gemini"];
  return inputs.map(s => {
    const res = [];
    for (let i = 0; i < s.length; i++) res.push(s.slice(i) + s.slice(0, i));
    return { 
      input: `${s}\n`, 
      output: `Enter string: ${s}\nRotations: ${res.join(" ")}`, 
      points: 2 
    };
  });
}

function genHollowSquare(): TestCase[] {
  return [4, 3, 2, 1, 5, 6, 7, 8, 9, 10].map(n => {
    let out = [];
    if (n === 1) out.push("*");
    else {
      out.push("*".repeat(n));
      for (let i = 0; i < n - 2; i++) out.push("*" + " ".repeat(n - 2) + "*");
      out.push("*".repeat(n));
    }
    return { 
      input: `${n}\n`, 
      output: `Enter size: ${n}\n${out.join("\n")}`, 
      points: 2 
    };
  });
}

function genBalancedBrackets(): TestCase[] {
  const inputs = [
    "{[()]}", "{[(])}", "((()))", "[]", "][", "{[]}", "({[]})", "((({{{[[[]]]}}})))", "(]", "()[]{}"
  ];
  return inputs.map(s => {
    const stack = [];
    const pairs: any = { ')': '(', '}': '{', ']': '[' };
    let valid = true;
    for (const c of s) {
      if (['(', '{', '['].includes(c)) stack.push(c);
      else if (stack.pop() !== pairs[c]) { valid = false; break; }
    }
    if (stack.length > 0) valid = false;
    return { 
      input: `${s}\n`, 
      output: `Enter brackets: ${s}\nStatus: ${valid ? "Valid" : "Invalid"}`, 
      points: 2 
    };
  });
}

function genKadanesPeak(): TestCase[] {
  const inputs = [
    [-2, 1, -3, 4, -1, 2, 1, -5, 4],
    [1, 2, 3, 4, 5],
    [-5, -1, -3],
    [0, 0, 0],
    [-2, -3, 4, -1, -2, 1, 5, -3],
    [2, 3, -8, 7, -1, 2, 3],
    [-1, -2, -3, -4],
    [5, -2, 5, -2, 5],
    [10, -5, 10, -5, 10],
    [-10, 2, 3, -2, 0, 5, -15]
  ];
  return inputs.map(arr => {
    let max = -Infinity, curr = 0;
    for (const x of arr) {
      curr = Math.max(x, curr + x);
      max = Math.max(max, curr);
    }
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nMax Subarray Sum: ${max}`, 
      points: 3 
    };
  });
}

function genTwoSumMatch(): TestCase[] {
  const inputs = [
    { t: 9, arr: [2, 7, 11, 15] },
    { t: 6, arr: [3, 2, 4] },
    { t: 10, arr: [5, 1, 5] },
    { t: 8, arr: [1, 2, 3, 4, 5] },
    { t: 0, arr: [-2, 1, 2, 3] },
    { t: 100, arr: [10, 20, 30, 70, 80] },
    { t: -5, arr: [-1, -2, -3, -4] },
    { t: 14, arr: [7, 7, 8, 9] },
    { t: 20, arr: [5, 10, 15, 20] },
    { t: 3, arr: [1, 2] }
  ];
  return inputs.map(({ t, arr }) => {
    let out = "";
    for (let i = 0; i < arr.length && !out; i++) {
      for (let j = i + 1; j < arr.length && !out; j++) {
        if (arr[i] + arr[j] === t) out = `${arr[i]} ${arr[j]}`;
      }
    }
    return { 
      input: `${t}\n${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter target sum: ${t}\nEnter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nMatch: ${out}`, 
      points: 2 
    };
  });
}

function genValidPalindrome(): TestCase[] {
  const inputs = ["racecar", "hello", "madam", "level", "world", "radar", "typescript", "civic", "openai", "kayak"];
  return inputs.map(s => {
    const isPal = s === s.split('').reverse().join('');
    return { 
      input: `${s}\n`, 
      output: `Enter word: ${s}\nIs Palindrome: ${isPal ? "True" : "False"}`, 
      points: 1 
    };
  });
}

function genAnagramCount(): TestCase[] {
  const inputs = [
    "eat tea tan ate nat bat",
    "hello world",
    "a a a",
    "cat act tac dog god",
    "listen silent enlist google",
    "one two three",
    "abcd dcba cdab",
    "abc def ghi",
    "aabb abab bbaa",
    "z y x w v u"
  ];
  return inputs.map(s => {
    const groups = new Set();
    for (const word of s.split(" ")) groups.add(word.split('').sort().join(''));
    return { 
      input: `${s}\n`, 
      output: `Enter words: ${s}\nAnagram Groups: ${groups.size}`, 
      points: 3 
    };
  });
}

function genIPAddressValidator(): TestCase[] {
  const inputs = [
    "192.168.1.1", "256.0.0.1", "192.168.01.1", "0.0.0.0", "1.1.1.1",
    "123.456.78.90", "12.34.56.78", "255.255.255.255", "192.168.1", "a.b.c.d"
  ];
  return inputs.map(ip => {
    let valid = true;
    const parts = ip.split('.');
    if (parts.length !== 4) valid = false;
    else {
      for (const p of parts) {
        if (!/^\d+$/.test(p)) { valid = false; break; }
        const n = parseInt(p, 10);
        if (n < 0 || n > 255 || p !== n.toString()) { valid = false; break; }
      }
    }
    return { 
      input: `${ip}\n`, 
      output: `Enter IP address: ${ip}\nStatus: ${valid ? "Valid" : "Invalid"}`, 
      points: 2 
    };
  });
}

function genIslandPerimeter(): TestCase[] {
  const inputs = [
    [[0, 1], [1, 1]], [[1]], [[1, 1], [1, 1]], [[0, 0], [0, 0]],
    [[1, 0, 1], [0, 1, 0], [1, 0, 1]], [[1, 1, 1], [1, 0, 1], [1, 1, 1]],
    [[1, 0], [0, 0]], [[1, 1, 0], [1, 1, 0], [0, 0, 0]],
    [[1, 1, 1]], [[1], [1], [1]]
  ];
  return inputs.map(grid => {
    let p = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        if (grid[r][c] === 1) {
          p += 4;
          if (r > 0 && grid[r - 1][c] === 1) p -= 2;
          if (c > 0 && grid[r][c - 1] === 1) p -= 2;
        }
      }
    }
    let outStr = `Enter rows and cols: ${grid.length} ${grid[0].length}\n`;
    grid.forEach((r, i) => { outStr += `Enter grid row ${i + 1}: ${r.join(" ")}\n`; });
    outStr += `Island Perimeter: ${p}`;
    return {
      input: `${grid.length} ${grid[0].length}\n${grid.map(r => r.join(" ")).join("\n")}\n`,
      output: outStr,
      points: 3,
    };
  });
}

function genLIS(): TestCase[] {
  const inputs = [
    [10, 9, 2, 5, 3, 7, 101, 18], [0, 1, 0, 3, 2, 3], [7, 7, 7, 7, 7, 7, 7],
    [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [1, 3, 6, 7, 9, 4, 10, 5, 6],
    [10, 22, 9, 33, 21, 50, 41, 60, 80], [3, 10, 2, 1, 20], [3, 2], [50, 3, 10, 7, 40, 80]
  ];
  return inputs.map(arr => {
    let max = 1;
    if (arr.length === 0) max = 0;
    else {
      let dp = Array(arr.length).fill(1);
      for (let i = 1; i < arr.length; i++) {
        for (let j = 0; j < i; j++) if (arr[i] > arr[j]) dp[i] = Math.max(dp[i], dp[j] + 1);
        max = Math.max(max, dp[i]);
      }
    }
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nLIS Length: ${max}`, 
      points: 4 
    };
  });
}

function genMissingNumber(): TestCase[] {
  const inputs = [
    [3, 0, 1], [0, 1], [9, 6, 4, 2, 3, 5, 7, 0, 1],
    [0], [1, 2, 3], [0, 1, 2, 3, 4, 6],
    [5, 3, 1, 0, 2], [7, 6, 5, 4, 3, 2, 1],
    [8, 7, 6, 5, 3, 2, 1, 0], [2, 0]
  ];
  return inputs.map(arr => {
    const n = arr.length;
    const expected = (n * (n + 1)) / 2;
    const actual = arr.reduce((a, b) => a + b, 0);
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nMissing Number: ${expected - actual}`, 
      points: 1 
    };
  });
}

function genMoveZeroes(): TestCase[] {
  const inputs = [
    [0, 1, 0, 3, 12], [0, 0, 1], [2, 1], [0], [1, 2, 3],
    [0, 0, 0], [1, 0, 2, 0, 3], [4, 2, 4, 0, 0, 3, 0, 5, 1, 0],
    [0, 1], [1, 0]
  ];
  return inputs.map(arr => {
    let res = arr.filter(x => x !== 0);
    while (res.length < arr.length) res.push(0);
    return { 
      input: `${arr.length}\n${arr.join(" ")}\n`, 
      output: `Enter array length: ${arr.length}\nEnter array values: ${arr.join(" ")}\nResult: ${res.join(" ")}`, 
      points: 2 
    };
  });
}

// --- Challenges Definition ---

export const challenges: Challenge[] = [
  {
    name: "Minimal Subarray Length",
    type: "number",
    info: `
      <p>
        Given an array of <code>N</code> positive integers and a positive integer <code>S</code>, your task is to find the minimal length of a contiguous subarray whose sum is greater than or equal to <code>S</code>. If there is no such subarray, the output should be 0.
      </p>
      <p>
        A <b>contiguous subarray</b> is a group of consecutive elements taken from the array — elements that are side by side with no gaps.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>7 15
2 3 1 2 4 3 8</pre>
      <b>Output:</b>
      <pre>Enter array length and target sum: 7 15
Enter array values: 2 3 1 2 4 3 8
Minimal Subarray Length: 3</pre>
    `,
    test: genMinimalSubarrayLength(),
  },
  {
    name: "Diagonal Balance",
    type: "string",
    info: `
      <p>
        You are given a square matrix of size <code>N x N</code>. Your task is to determine if you can make the sum of its main diagonal equal to the sum of its anti-diagonal by performing at most one operation.
      </p>
      <p>
        The allowed operation is to choose a single row <i>or</i> a single column and multiply all of its elements by -1.<br/>
        If they are already equal, output <code>-1 -1</code>. If a solution is found, print <code>R index</code> or <code>C index</code>. Prioritize rows over columns, and smallest index first. If impossible, print <code>IMPOSSIBLE</code>.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>3
5 0 2
0 0 0
1 0 4</pre>
      <b>Output:</b>
      <pre>Enter matrix size: 3
Enter matrix row 1: 5 0 2
Enter matrix row 2: 0 0 0
Enter matrix row 3: 1 0 4
Operation: R 0</pre>
    `,
    test: genDiagonalBalance(),
  },
  {
    name: "Subarray Sum Constraint",
    type: "number",
    info: `
      <p>
        You are given an array of <code>N</code> non-negative integers, a target sum <code>S</code>, and a minimum length <code>L</code>. Count the number of contiguous subarrays that have a length of at least <code>L</code> and whose sum of elements is less than or equal to <code>S</code>.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>5 7 2
1 2 3 4 5</pre>
      <b>Output:</b>
      <pre>Enter array length, target sum, and min length: 5 7 2
Enter array values: 1 2 3 4 5
Valid Subarrays: 4</pre>
    `,
    test: genSubarraySumConstraint(),
  },
  {
    name: "Sliding Window Tolerance",
    type: "number",
    info: `
      <p>
        Analyze a stream of data to find "stable" periods. You are given a window size <code>w</code>, a tolerance value <code>T</code>, and a sequence of positive integers terminated by <code>-1</code>.
      </p>
      <p>
        Slide a window of size <code>w</code> across the sequence. A window is valid if the difference between the maximum and minimum value within that window is less than or equal to <code>T</code>. Output the total valid windows.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>4 5
10 12 11 15 16 14 2 -1</pre>
      <b>Output:</b>
      <pre>Enter window size and tolerance: 4 5
Enter data stream (end with -1): 10 12 11 15 16 14 2 -1
Valid Windows: 3</pre>
    `,
    test: genSlidingWindowTolerance(),
  },
  {
    name: "Vowel-Consonant Balance",
    type: "number",
    info: `
      <p>
        Given a string consisting of uppercase English letters, find the length of the longest substring that is balanced. A substring is balanced if it contains an equal number of vowels (A, E, I, O, U) and consonants.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>AEIOUBCDFG</pre>
      <b>Output:</b>
      <pre>Enter string: AEIOUBCDFG
Longest Balanced Substring Length: 10</pre>
    `,
    test: genVowelConsonantBalance(),
  },
  {
    name: "Consecutive Plateaus",
    type: "number",
    info: `
      <p>
        You are given a sequence of integers that ends with a <code>0</code>. Find and count the number of "plateaus" in this sequence. A plateau is a sequence of two or more consecutive numbers that are identical. The terminating 0 is not considered part of the sequence.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>1 2 2 3 3 3 4 5 5 0</pre>
      <b>Output:</b>
      <pre>Enter sequence (end with 0): 1 2 2 3 3 3 4 5 5 0
Plateaus Count: 3</pre>
    `,
    test: genConsecutivePlateaus(),
  },
  {
    name: "Even Median",
    type: "number",
    info: `
      <p>
        Find the median of the given array of numbers. If the median is an even number, display it. If the median is an odd number, add 1 to it to make it even, then display it.
      </p>
      <p><i>Note: The median is the middle number in a sorted, ascending or descending, list of numbers.</i></p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>7
4 6 2 8 3 4 1</pre>
      <b>Output:</b>
      <pre>Enter array length: 7
Enter array values: 4 6 2 8 3 4 1
Even Median: 4</pre>
    `,
    test: genEvenMedian(),
  },
  {
    name: "Find the Spy",
    type: "number",
    info: `
      <p>
        Find the "spy" hidden inside an array of numbers. The spy is the only number that is duplicated in the sequence. All other numbers appear exactly once.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>7
6 7 2 4 8 3 2</pre>
      <b>Output:</b>
      <pre>Enter length of array: 7
Values: 6 7 2 4 8 3 2
Output: 2</pre>
    `,
    test: genFindTheSpy(),
  },
  {
    name: "String Rotation",
    type: "string",
    info: `
      <p>
        Create all possible rotational combinations of a string by moving the first character to the end, step by step. Print all rotations separated by a space.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>Cpe</pre>
      <b>Output:</b>
      <pre>Enter string: Cpe
Rotations: Cpe peC eCp</pre>
    `,
    test: genStringRotation(),
  },
  {
    name: "Hollow Square Pattern",
    type: "string",
    info: `
      <p>
        Print a hollow square pattern of stars (<code>*</code>) based on the given size <code>N</code>. The boundary should be stars, and the inside should be spaces.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>4</pre>
      <b>Output:</b>
      <pre>Enter size: 4
****
* *
* *
****</pre>
    `,
    test: genHollowSquare(),
  },
  {
    name: "Balanced Brackets",
    type: "string",
    info: `
      <p>
        Determine if a given sequence of brackets <code>()</code>, <code>{}</code>, and <code>[]</code> is balanced. Output <code>Valid</code> or <code>Invalid</code>.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>{[()]}</pre>
      <b>Output:</b>
      <pre>Enter brackets: {[()]}
Status: Valid</pre>
    `,
    test: genBalancedBrackets(),
  },
  {
    name: "Kadane's Peak",
    type: "number",
    info: `
      <p>
        Find the maximum contiguous subarray sum within a sequence of integers (which may contain negative numbers).
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>9
-2 1 -3 4 -1 2 1 -5 4</pre>
      <b>Output:</b>
      <pre>Enter array length: 9
Enter array values: -2 1 -3 4 -1 2 1 -5 4
Max Subarray Sum: 6</pre>
    `,
    test: genKadanesPeak(),
  },
  {
    name: "Two Sum Match",
    type: "string",
    info: `
      <p>
        You are given a target number and an array of integers. Find the exactly two numbers in the array that add up to the target. Output them in the order they appear, separated by a space.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>9
4
2 7 11 15</pre>
      <b>Output:</b>
      <pre>Enter target sum: 9
Enter array length: 4
Enter array values: 2 7 11 15
Match: 2 7</pre>
    `,
    test: genTwoSumMatch(),
  },
  {
    name: "Valid Palindrome",
    type: "string",
    info: `
      <p>
        Check if a given single word is a palindrome (reads the same forwards and backwards). Output <code>True</code> or <code>False</code>.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>racecar</pre>
      <b>Output:</b>
      <pre>Enter word: racecar
Is Palindrome: True</pre>
    `,
    test: genValidPalindrome(),
  },
  {
    name: "Anagram Count",
    type: "number",
    info: `
      <p>
        Given a sequence of words separated by spaces, count how many distinct anagram <i>groups</i> exist. An anagram group consists of words that have the exact same characters in different orders.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>eat tea tan ate nat bat</pre>
      <b>Output:</b>
      <pre>Enter words: eat tea tan ate nat bat
Anagram Groups: 3</pre>
      <i>Explanation: The groups are (eat, tea, ate), (tan, nat), and (bat).</i>
    `,
    test: genAnagramCount(),
  },
  {
    name: "IP Address Validator",
    type: "string",
    info: `
      <p>
        Check if a given string is a valid IPv4 address. It must consist of 4 blocks of numbers separated by dots, where each block is between 0 and 255 with no leading zeros (unless the number is exactly 0). Output <code>Valid</code> or <code>Invalid</code>.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>192.168.1.1</pre>
      <b>Output:</b>
      <pre>Enter IP address: 192.168.1.1
Status: Valid</pre>
    `,
    test: genIPAddressValidator(),
  },
  {
    name: "Island Perimeter",
    type: "number",
    info: `
      <p>
        You are given a grid representing a map where <code>1</code> represents land and <code>0</code> represents water. Grid cells are connected horizontally and vertically. Calculate the total perimeter of the island.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>2 2
0 1
1 1</pre>
      <b>Output:</b>
      <pre>Enter rows and cols: 2 2
Enter grid row 1: 0 1
Enter grid row 2: 1 1
Island Perimeter: 8</pre>
    `,
    test: genIslandPerimeter(),
  },
  {
    name: "Longest Increasing Subsequence",
    type: "number",
    info: `
      <p>
        Given an integer array, return the length of the longest strictly increasing subsequence.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>8
10 9 2 5 3 7 101 18</pre>
      <b>Output:</b>
      <pre>Enter array length: 8
Enter array values: 10 9 2 5 3 7 101 18
LIS Length: 4</pre>
      <i>Explanation: The longest increasing subsequence is 2, 3, 7, 101.</i>
    `,
    test: genLIS(),
  },
  {
    name: "Missing Number",
    type: "number",
    info: `
      <p>
        Given an array containing <code>N</code> distinct numbers taken from the range <code>0</code> to <code>N</code>, find the one number that is missing from the array.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>3
3 0 1</pre>
      <b>Output:</b>
      <pre>Enter array length: 3
Enter array values: 3 0 1
Missing Number: 2</pre>
    `,
    test: genMissingNumber(),
  },
  {
    name: "Move Zeroes",
    type: "string",
    info: `
      <p>
        Given an integer array, move all <code>0</code>'s to the end of it while maintaining the relative order of the non-zero elements. Output the modified array as a space-separated string.
      </p>
      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>5
0 1 0 3 12</pre>
      <b>Output:</b>
      <pre>Enter array length: 5
Enter array values: 0 1 0 3 12
Result: 1 3 12 0 0</pre>
    `,
    test: genMoveZeroes(),
  },
];