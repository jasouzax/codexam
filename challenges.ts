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

function generateFizzBuzzTests(): TestCase[] {
  return [1, 3, 5, 10, 15, 7, 8, 20, 25, 30].map((n) => ({
    input: `${n}\n`,
    output: Array.from({ length: n }, (_, i) => {
      const num = i + 1;
      if (num % 15 === 0) return "FizzBuzz";
      if (num % 3 === 0) return "Fizz";
      if (num % 5 === 0) return "Buzz";
      return String(num);
    }).join("\n"),
    points: 1,
  }));
}

function generateTrailingZerosTests(): TestCase[] {
  const trailingZeros = (n: number): string => {
    if (n === 0) return "1";
    let count = 0;
    while (n % 10 === 0) {
      count++;
      n = Math.floor(n / 10);
    }
    return String(count);
  };
  return [0, 10, 100, 24100, 100002, 7, 9000, 450, 50005, 600000].map((n) => ({
    input: `${n}\n`,
    output: trailingZeros(n),
    points: 1.5,
  }));
}

function generateDigitalRootTests(): TestCase[] {
  const digitalRoot = (n: number): string => {
    while (n >= 10) {
      n = String(n)
        .split("")
        .reduce((a, b) => a + Number(b), 0);
    }
    return String(n);
  };
  return [0, 5, 10, 55, 364, 9875, 99999, 4444, 123456, 87654321].map((n) => ({
    input: `${n}\n`,
    output: digitalRoot(n),
    points: 2,
  }));
}

function generateDiamondTests(): TestCase[] {
  const diamond = (n: number): string => {
    const lines: string[] = [];
    for (let i = 1; i <= n; i += 2) {
      lines.push(" ".repeat((n - i) / 2) + "*".repeat(i));
    }
    for (let i = n - 2; i > 0; i -= 2) {
      lines.push(" ".repeat((n - i) / 2) + "*".repeat(i));
    }
    return lines.join("\n");
  };
  return [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((n) => ({
    input: `${n}\n`,
    output: diamond(n),
    points: 2.5,
  }));
}

function generateRomanNumeralTests(): TestCase[] {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
    [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"],
    [5, "V"], [4, "IV"], [1, "I"],
  ];
  const roman = (n: number): string => {
    let res = "";
    for (const [val, sym] of map) {
      while (n >= val) {
        res += sym;
        n -= val;
      }
    }
    return res;
  };
  return [1, 4, 9, 14, 44, 58, 99, 145, 399, 944].map((n) => ({
    input: `${n}\n`,
    output: roman(n),
    points: 3,
  }));
}


export const challenges: Challenge[] = [
  {
    name: "FizzBuzz",
    type: "string",
    info: `
      <p>
        Implement the classic <b>FizzBuzz</b> problem. The program receives an integer <code>n</code>.
        Starting from 1 up to <code>n</code>, you will print each number on its own line, with the following rules:
      </p>
      <ul>
        <li>If a number is divisible by 3, print <b>Fizz</b> instead of the number.</li>
        <li>If a number is divisible by 5, print <b>Buzz</b> instead of the number.</li>
        <li>If a number is divisible by both 3 and 5, print <b>FizzBuzz</b>.</li>
        <li>If none of these conditions are met, print the number itself.</li>
      </ul>
      <p>
        This exercise tests your ability to handle loops and conditional logic.
      </p>

      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>5</pre>
      <b>Output:</b>
      <pre>1
2
Fizz
4
Buzz</pre>

      <h3>Sample #2</h3>
      <b>Input:</b>
      <pre>3</pre>
      <b>Output:</b>
      <pre>1
2
Fizz</pre>

      <h3>Sample #3</h3>
      <b>Input:</b>
      <pre>15</pre>
      <b>Output:</b>
      <pre>1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz</pre>
    `,
    test: generateFizzBuzzTests(),
  },
  {
    name: "Trailing Zeros",
    type: "number",
    info: `
      <p>
        Given a single integer number, determine how many trailing zeroes appear at the end of the number.
        Trailing zeroes are consecutive zero digits found at the rightmost side of the number.
      </p>
      <p>
        For example, the number 24100 ends with two zeros, so the output is 2.
        If the input is 0, it is considered to have one trailing zero.
        If the number does not end with zero, the output is 0.
      </p>

      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>24100</pre>
      <b>Output:</b>
      <pre>2</pre>

      <h3>Sample #2</h3>
      <b>Input:</b>
      <pre>0</pre>
      <b>Output:</b>
      <pre>1</pre>

      <h3>Sample #3</h3>
      <b>Input:</b>
      <pre>100002</pre>
      <b>Output:</b>
      <pre>0</pre>
    `,
    test: generateTrailingZerosTests(),
  },
  {
    name: "Digital Root",
    type: "number",
    info: `
      <p>
        A <b>digital root</b> is obtained by repeatedly adding the digits of an integer until only one digit remains.
        Write a program that accepts a non-negative integer and outputs its digital root.
      </p>
      <p>
        For example, 9875 becomes 9+8+7+5 = 29, then 2+9 = 11, then 1+1 = 2.
        The final result is 2.
      </p>

      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>10</pre>
      <b>Output:</b>
      <pre>1</pre>

      <h3>Sample #2</h3>
      <b>Input:</b>
      <pre>55</pre>
      <b>Output:</b>
      <pre>1</pre>

      <h3>Sample #3</h3>
      <b>Input:</b>
      <pre>364</pre>
      <b>Output:</b>
      <pre>4</pre>
    `,
    test: generateDigitalRootTests(),
  },
  {
    name: "Diamond Elegance",
    type: "string",
    info: `
      <p>
        Write a program that prints a diamond-shaped pattern of stars.
        The input is an odd integer <code>n</code>, representing the width of the diamond's widest row.
      </p>
      <p>
        The output should be a symmetrical diamond made of asterisks (<code>*</code>), centered with spaces.
      </p>

      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>5</pre>
      <b>Output:</b>
      <pre>  *
 ***
*****
 ***
  *</pre>

      <h3>Sample #2</h3>
      <b>Input:</b>
      <pre>3</pre>
      <b>Output:</b>
      <pre> *
***
 *</pre>

      <h3>Sample #3</h3>
      <b>Input:</b>
      <pre>7</pre>
      <b>Output:</b>
      <pre>   *
  ***
 *****
*******
 *****
  ***
   *</pre>
    `,
    test: generateDiamondTests(),
  },
  {
    name: "Roman Numeral",
    type: "string",
    info: `
      <p>
        Convert an integer into its Roman numeral representation.
        The input will be a positive integer, and the output should be its Roman numeral string.
      </p>
      <p>
        Roman numerals use the following symbols:
        <code>I (1), V (5), X (10), L (50), C (100), D (500), M (1000)</code>.
        Numbers are formed by combining these symbols with rules for subtraction (e.g., IV = 4).
      </p>

      <h3>Sample #1</h3>
      <b>Input:</b>
      <pre>9</pre>
      <b>Output:</b>
      <pre>IX</pre>

      <h3>Sample #2</h3>
      <b>Input:</b>
      <pre>14</pre>
      <b>Output:</b>
      <pre>XIV</pre>

      <h3>Sample #3</h3>
      <b>Input:</b>
      <pre>44</pre>
      <b>Output:</b>
      <pre>XLIV</pre>
    `,
    test: generateRomanNumeralTests(),
  },
];


