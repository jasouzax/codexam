#!/usr/bin/env -S deno run -A --watch
import { TextLineStream } from "https://deno.land/std@0.224.0/streams/text_line_stream.ts";

interface ProblemScore {
  /** Maximum score achieved for the problem */
  max_score: number;
  /** Current submission score */
  current_score: number;
  /** Time when max score was achieved */
  achieve_time: Date | null;
}

interface Participant {
  /** Participant's name */
  name: string;
  /** Programming language chosen */
  lang: string;
  /** Whether the application was accepted */
  accepted: boolean;
  /** Scores for each problem */
  problem_scores: Array<ProblemScore>;
  /** Total maximum score achieved */
  total_max: number;
  /** Total current score from latest submissions */
  total_current: number;
  /** Time when total max score was achieved */
  total_achieve_time: Date | null;
}

interface PendingApplicant {
  name: string;
  lang: string;
  ws: WebSocket;
}

interface ChallengeTestCase {
  input: string;
  output: string;
  points: number;
}

interface Challenge {
  name: string;
  info: string;
  test: Array<ChallengeTestCase>;
}
// #region Configurations - Developer can modify
/** Unit of the interface in Pixels */
const unit: number = 50;
/** Challenges */
import { challenges } from './challenges.ts';
/*const challenges: Array<Challenge> = [
  {
    name: "FizzBuzz",
    info: `<p>Write a program that reads an integer n from standard input and prints the numbers from 1 to n, each on a new line. For multiples of 3, print "Fizz" instead of the number. For multiples of 5, print "Buzz". For numbers that are multiples of both 3 and 5, print "FizzBuzz".</p>`,
    test: [
      { input: "5\n", output: "1\n2\nFizz\n4\nBuzz", points: 10 },
      { input: "15\n", output: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", points: 20 },
      { input: "1\n", output: "1", points: 5 },
      { input: "30\n", output: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz\n26\nFizz\n28\n29\nFizzBuzz", points: 30 },
    ],
  },
  {
    name: "Trailing Zeros",
    info: `<p>Write a program that reads an integer n from standard input and outputs the number of trailing zeros in n! (factorial of n).</p>`,
    test: [
      { input: "5\n", output: "1", points: 10 },
      { input: "10\n", output: "2", points: 15 },
      { input: "25\n", output: "6", points: 20 },
      { input: "100\n", output: "24", points: 30 },
    ],
  },
  {
    name: "Digital Root",
    info: `<p>The digital root of a number is obtained by repeatedly summing its digits until a single digit is reached. Write a program that reads an integer n from standard input and outputs its digital root.</p>`,
    test: [
      { input: "16\n", output: "7", points: 10 },
      { input: "942\n", output: "6", points: 15 },
      { input: "132189\n", output: "6", points: 20 },
      { input: "493193\n", output: "2", points: 25 },
    ],
  },
  {
    name: "Diamond Elegance",
    info: `<p>Write a program that reads an odd integer n from standard input and prints a diamond shape made of '*' characters, centered, with height and width n. Use spaces for alignment, no trailing spaces on lines.</p><p>Example for n=3:</p><pre> *\n***\n *</pre>`,
    test: [
      { input: "1\n", output: "*", points: 10 },
      { input: "3\n", output: " *\n***\n *", points: 15 },
      { input: "5\n", output: "  *\n ***\n*****\n ***\n  *", points: 20 },
      { input: "7\n", output: "   *\n  ***\n *****\n******\n *****\n  ***\n   *", points: 25 },
    ],
  },
  {
    name: "Roman Numeral",
    info: `<p>Write a program that reads an integer n (1 <= n <= 3999) from standard input and outputs its Roman numeral representation.</p>`,
    test: [
      { input: "3\n", output: "III", points: 10 },
      { input: "58\n", output: "LVIII", points: 15 },
      { input: "1994\n", output: "MCMXCIV", points: 20 },
      { input: "3999\n", output: "MMMCMXCIX", points: 30 },
    ],
  },
];*/
// #endregion
const red: string = "\x1b[31m";
const green: string = "\x1b[32m";
const yellow: string = "\x1b[33m";
const reset: string = "\x1b[0m";
const encoder: TextEncoder = new TextEncoder();

// #region System variables - Modifed on runtime
/** Current phase of competition */
let phase: 'start' | 'ongoing' | 'ended' = 'start';
/** Starting date of competition */
let time_start: Date | null = null;
/** Ending date of competition */
let time_end: Date | null = null;
/** Scheduled start date */
let scheduled_start: Date | null = null;
/** Scheduled end date */
let scheduled_end: Date | null = null;
/** Total possible points */
const total_points: number = challenges.reduce((sum: number, ch: Challenge) => sum + ch.test.reduce((s: number, tc: ChallengeTestCase) => s + tc.points, 0), 0);
/** Participants */
const participants: Map<string, Participant> = new Map();
/** Websocket to participant name */
const connections: Map<WebSocket, string> = new Map();
/** Pending participant applications */
const pending: Array<PendingApplicant> = [];
/** Current pending applicant being processed */
let current_pending: PendingApplicant | null = null;
// #endregion
// #region Action - Functions
/** Process the next pending applicant */
function process_next_pending(): void {
  if (current_pending || pending.length === 0) return;
  current_pending = pending.shift()!;
  Deno.stdout.writeSync(encoder.encode(`${yellow}New application: ${current_pending.name} (${current_pending.lang}). Accept? (y/n)${reset} `));
}

/** Reset all participant scores */
function reset_scores(): void {
  for (const p of participants.values()) {
    p.problem_scores = challenges.map(() => ({ max_score: 0, current_score: 0, achieve_time: null }));
    p.total_max = 0;
    p.total_current = 0;
    p.total_achieve_time = null;
  }
}

/** Parse time string to Date */
function parse_time(time_str: string): Date | null {
  const [h, m] = time_str.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
}

/** Start the competition */
function start_competition(): void {
  phase = 'ongoing';
  time_start = new Date();
  time_end = null;
  if (scheduled_end && scheduled_end > time_start) time_end = scheduled_end;
  scheduled_start = null;
  scheduled_end = null;
  broadcast({ type: 'phase', phase });
  broadcast_time();
  Deno.stdout.writeSync(encoder.encode(`${green}Competition started.${reset}\n`));
}

/** End the competition */
function end_competition(): void {
  phase = 'ended';
  scheduled_end = null;
  broadcast({ type: 'phase', phase });
  Deno.stdout.writeSync(encoder.encode(`${green}Competition ended.${reset}\n`));
}

/** Broadcast message to all connections */
function broadcast(msg:
    {type: 'phase', phase:"start" | "ongoing" | "ended"} |
    {type: 'time_update',time_start:number|null, time_end:number|null, scheduled_start:number|null} |
    { type: 'leaderboard', data: {
        [lang: string]: {
            name: string;
            points: number;
        }[];
    }}
): void {
  const str = JSON.stringify(msg);
  for (const ws of connections.keys()) ws.send(str);
}

/** Broadcast time updates */
function broadcast_time(): void {
  broadcast({
    type: 'time_update',
    time_start: time_start?.getTime() ?? null,
    time_end: time_end?.getTime() ?? null,
    scheduled_start: scheduled_start?.getTime() ?? null,
  });
}

/** Handle CLI inputs */
async function cli_input(): Promise<void> {
  const readable = Deno.stdin.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream());
  for await (const line of readable) {
    const trimmed = line.trim().toLowerCase();
    if (current_pending) {
      if (trimmed === 'y') {
        if (participants.has(current_pending.name)) {
          current_pending.ws.send(JSON.stringify({ type: 'declined', msg: 'Name already taken' }));
        } else {
          participants.set(current_pending.name, {
            name: current_pending.name,
            lang: current_pending.lang,
            accepted: true,
            problem_scores: challenges.map(() => ({ max_score: 0, current_score: 0, achieve_time: null })),
            total_max: 0,
            total_current: 0,
            total_achieve_time: null,
          });
          connections.set(current_pending.ws, current_pending.name);
          current_pending.ws.send(JSON.stringify({ type: 'accepted' }));
        Deno.stdout.writeSync(encoder.encode(`${green}Accepted participant${reset}\n`));
        }
        current_pending = null;
        process_next_pending();
      } else if (trimmed === 'n') {
        current_pending.ws.send(JSON.stringify({ type: 'declined' }));
        current_pending = null;
        process_next_pending();
      } else {
        Deno.stdout.writeSync(encoder.encode(`${red}Invalid input.${reset} ${yellow}Accept? (y/n)${reset} `));
      }
    } else {
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0];
      const now = new Date();
      if (cmd === 'start') {
        let target_time = null;
        if (parts.length > 1) {
          target_time = parse_time(parts[1]);
          if (!target_time) {
            Deno.stdout.writeSync(encoder.encode(`${red}Invalid time format. Use HH:MM${reset}\n`));
            continue;
          }
        } else {
          target_time = now;
        }
        if (phase === 'start') {
          if (target_time <= now) {
            start_competition();
          } else {
            scheduled_start = target_time;
            broadcast_time();
            Deno.stdout.writeSync(encoder.encode(`${green}Competition scheduled to start at ${target_time.toLocaleTimeString()}.${reset}\n`));
          }
        } else if (phase === 'ongoing') {
          if (target_time > now) {
            phase = 'start';
            scheduled_start = target_time;
            time_start = null;
            time_end = null;
            reset_scores();
            broadcast({ type: 'phase', phase });
            broadcast_time();
            Deno.stdout.writeSync(encoder.encode(`${green}Competition rescheduled to start at ${target_time.toLocaleTimeString()}. Scores reset.${reset}\n`));
          } else {
            Deno.stdout.writeSync(encoder.encode(`${red}Cannot reschedule to past or present during ongoing.${reset}\n`));
          }
        }
      } else if (cmd === 'end' && (phase === 'start' || phase === 'ongoing')) {
        let target_time = null;
        if (parts.length > 1) {
          target_time = parse_time(parts[1]);
          if (!target_time) {
            Deno.stdout.writeSync(encoder.encode(`${red}Invalid time format. Use HH:MM${reset}\n`));
            continue;
          }
        } else {
          target_time = now;
        }
        if (target_time <= now) {
          end_competition();
        } else {
          if (phase === 'start') {
            scheduled_end = target_time;
            Deno.stdout.writeSync(encoder.encode(`${green}End scheduled at ${target_time.toLocaleTimeString()}.${reset}\n`));
          } else {
            time_end = target_time;
            broadcast_time();
            Deno.stdout.writeSync(encoder.encode(`${green}End time updated to ${target_time.toLocaleTimeString()}.${reset}\n`));
          }
        }
      } else {
        Deno.stdout.writeSync(encoder.encode(`${red}Unknown command or invalid phase.${reset}\n`));
      }
    }
  }
}

/** Run code in specified language */
async function run_code(lang: string, code: string, input: string): Promise<{output: string, error: string}> {
  let output = '';
  let error = '';
  let temp_dir = '';
  try {
    temp_dir = await Deno.makeTempDir();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let cmd;
    let file;
    switch (lang) {
      case 'Python': {
        file = `${temp_dir}/main.py`;
        await Deno.writeTextFile(file, code);
        cmd = ['python', file];
        break;
      }
      case 'Java': {
        file = `${temp_dir}/Main.java`;
        await Deno.writeTextFile(file, code);
        const javac_cmd = new Deno.Command('javac', { args: ['Main.java'], cwd: temp_dir, stderr: 'piped' });
        const javac_proc = javac_cmd.spawn();
        const javac_out = await javac_proc.output();
        if (!javac_out.success) {
          error = decoder.decode(javac_out.stderr);
          return { output, error };
        }
        cmd = ['java', '-cp', temp_dir, 'Main'];
        break;
      }
      case 'C++': {
        file = `${temp_dir}/main.cpp`;
        await Deno.writeTextFile(file, code);
        const gpp_cmd = new Deno.Command('g++', { args: ['main.cpp', '-o', 'main'], cwd: temp_dir, stderr: 'piped' });
        const gpp_proc = gpp_cmd.spawn();
        const gpp_out = await gpp_proc.output();
        if (!gpp_out.success) {
          error = decoder.decode(gpp_out.stderr);
          return { output, error };
        }
        cmd = [`${temp_dir}/main`];
        break;
      }
      case 'C': {
        file = `${temp_dir}/main.c`;
        await Deno.writeTextFile(file, code);
        const gcc_cmd = new Deno.Command('gcc', { args: ['main.c', '-o', 'main'], cwd: temp_dir, stderr: 'piped' });
        const gcc_proc = gcc_cmd.spawn();
        const gcc_out = await gcc_proc.output();
        if (!gcc_out.success) {
          error = decoder.decode(gcc_out.stderr);
          return { output, error };
        }
        cmd = [`${temp_dir}/main`];
        break;
      }
      default: {
        error = 'Unsupported language';
        return { output, error };
      }
    }
    const proc_cmd = new Deno.Command(cmd[0], { args: cmd.slice(1), cwd: temp_dir, stdin: 'piped', stdout: 'piped', stderr: 'piped' });
    const proc = proc_cmd.spawn();
    const writer = proc.stdin.getWriter();
    await writer.write(encoder.encode(input));
    await writer.close();
    const proc_out = await proc.output();
    if (!proc_out.success) {
      error = decoder.decode(proc_out.stderr);
    } else {
      output = decoder.decode(proc_out.stdout);
    }
  } catch (e) {
    if (e instanceof Error) error = e.message;
  } finally {
    if (temp_dir) await Deno.remove(temp_dir, { recursive: true }).catch(() => {});
  }
  return { output, error };
}

/** Normalize line endings */
function normalize(str: string): string {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Generate HTML for output display with differences highlighted */
function output_html(expected: string, actual: string): string {
  const exp_norm = normalize(expected);
  const act_norm = normalize(actual);
  const exp_lines = exp_norm.split('\n');
  const act_lines = act_norm.split('\n');
  let html = '';
  const max_len = Math.max(exp_lines.length, act_lines.length);
  for (let i = 0; i < max_len; i++) {
    const exp = exp_lines[i] ?? '';
    const act = act_lines[i] ?? '';
    if (exp === act) {
      html += `${act}<br>`;
    } else {
      let line_html = '';
      const line_max = Math.max(exp.length, act.length);
      for (let j = 0; j < line_max; j++) {
        if (exp[j] === act[j]) {
          line_html += act[j] ?? ' ';
        } else {
          line_html += `<span class="diff-error">${act[j] ?? ' '}</span>`;
        }
      }
      html += `${line_html}<br>`;
    }
  }
  return `<pre style="margin:0;">${html}</pre>`;
}

/** Handle WebSocket messages */
function handle_message(ws: WebSocket, data: string): void {
  const msg = JSON.parse(data);
  const name = connections.get(ws);
  switch (msg.type) {
    case 'apply': {
      if (phase !== 'start') {
        ws.send(JSON.stringify({ type: 'error', msg: 'Registration closed' }));
        return;
      }
      pending.push({ name: msg.name, lang: msg.lang, ws });
      process_next_pending();
      break;
    }
    case 'reconnect': {
      if (participants.has(msg.name) && participants.get(msg.name)!.accepted) {
        connections.set(ws, msg.name);
        ws.send(JSON.stringify({
          type: 'status',
          phase,
          accepted: true,
          lang: participants.get(msg.name)!.lang,
          time_start: time_start?.getTime() ?? null,
          time_end: time_end?.getTime() ?? null,
          scheduled_start: scheduled_start?.getTime() ?? null,
          total_points,
        }));
      } else {
        ws.send(JSON.stringify({ type: 'not_registered' }));
      }
      break;
    }
    case 'test': {
      if (!name || phase !== 'ongoing') return;
      (async () => {
        const p = participants.get(name)!;
        const ch = challenges[msg.problem];
        const tc = ch.test[msg.case];
        const { output, error } = await run_code(p.lang, msg.code, tc.input);
        const actual = normalize(output || '').trim();
        const exp = normalize(tc.output).trim();
        const passed = !error && actual === exp;
        const display = error ? `<pre style="margin:0;color:red;">${error}</pre>` : output_html(tc.output, output || '');
        ws.send(JSON.stringify({
          type: 'test_result',
          problem: msg.problem,
          case: msg.case,
          passed,
          display,
        }));
      })();
      break;
    }
    case 'submit': {
      if (!name || phase !== 'ongoing') return;
      (async () => {
        const p = participants.get(name)!;
        const ch = challenges[msg.problem];
        const passed_arr = [];
        const displays = [];
        let current_score = 0;
        for (const tc of ch.test) {
          const { output, error } = await run_code(p.lang, msg.code, tc.input);
          const actual = normalize(output || '').trim();
          const exp = normalize(tc.output).trim();
          const passed = !error && actual === exp;
          passed_arr.push(passed);
          const display = error ? `<pre style="margin:0;color:red;">${error}</pre>` : output_html(tc.output, output || '');
          displays.push(display);
          if (passed) current_score += tc.points;
        }
        const ps = p.problem_scores[msg.problem];
        ps.current_score = current_score;
        if (current_score > ps.max_score) {
          ps.max_score = current_score;
          ps.achieve_time = new Date();
          const new_total_max = p.problem_scores.reduce((sum, score) => sum + score.max_score, 0);
          if (new_total_max > p.total_max) {
            p.total_max = new_total_max;
            p.total_achieve_time = new Date();
          }
        }
        p.total_current = p.problem_scores.reduce((sum, score) => sum + score.current_score, 0);
        ws.send(JSON.stringify({
          type: 'submit_result',
          problem: msg.problem,
          passed: passed_arr,
          displays,
          current_score: ps.current_score,
          max_score: ps.max_score,
          total_current: p.total_current,
          total_points,
        }));
        broadcast_leaderboard();
      })();
      break;
    }
    case 'get_leaderboard': {
      ws.send(JSON.stringify({ type: 'leaderboard', data: get_leaderboard() }));
      break;
    }
  }
}

/** Get current leaderboard data */
function get_leaderboard() {
  const lb:{[lang:string]:{ name: string; points: number; }[]} = {};
  ['Python', 'Java', 'C++', 'C'].forEach(lang => {
    lb[lang] = Array.from(participants.values())
      .filter(p => p.lang === lang && p.accepted)
      .sort((a, b) => b.total_max - a.total_max || (a.total_achieve_time?.getTime() ?? Infinity) - (b.total_achieve_time?.getTime() ?? Infinity))
      .map(p => ({ name: p.name, points: p.total_max }));
  });
  return lb;
}

/** Broadcast leaderboard to all */
function broadcast_leaderboard(): void {
  broadcast({ type: 'leaderboard', data: get_leaderboard() });
}

/** Client-side challenges data without test cases */
const client_challenges: string = JSON.stringify(challenges.map((c: Challenge) => ({
  name: c.name,
  info: c.info,
  num_testcases: c.test.length,
})));

// #endregion

/** Interval for time checks */
setInterval(() => {
  const now = new Date();
  if (scheduled_start && now >= scheduled_start) start_competition();
  if (phase === 'ongoing' && time_end && now > time_end) end_competition();
}, 1000);

/** Serve the application */
Deno.serve({ port: 80 }, async (req) => {
  const path = new URL(req.url).pathname.split('/');
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'status',
        phase,
        time_start: time_start?.getTime() ?? null,
        time_end: time_end?.getTime() ?? null,
        scheduled_start: scheduled_start?.getTime() ?? null,
        total_points,
      }));
    };
    socket.onmessage = (e) => handle_message(socket, e.data);
    socket.onclose = () => connections.delete(socket);
    socket.onerror = (e) => Deno.stdout.writeSync(encoder.encode(`${red}WS error: ${e}${reset}\n`));
    return response;
  }
  if (path[1] == 'hljs') {
    try {
        return new Response(await Deno.readFile(`hljs/${path[2]??''}`), {
            status: 200,
            headers: { "content-type": (path[2].split(".").pop()?.toLowerCase() ?? "") == 'js' ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8' },
        });
    } catch (_e) {
        return new Response("Not found", { status: 404 });
    }
  }

  const u = unit;
  return new Response(/*html*/`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Coder's Arena</title>
        <link rel="stylesheet" href="/hljs/default.min.css">
        <script src="/hljs/highlight.min.js"></script>
        <script src="/hljs/python.min.js"></script>
        <script src="/hljs/java.min.js"></script>
        <script src="/hljs/cpp.min.js"></script>
        <script src="/hljs/c.min.js"></script>
        <style>
          :focus {outline:none}
          html {height:100%; background-color: black; color: white;}
          body {
            display: grid;
            height: calc(100% - ${0.2 * u}px);
            grid-template: ${0.75 * u}px ${u}px auto ${0.5 * u}px ${0.5 * u}px / 1fr ${0.2 * u}px 2fr ${0.2 * u}px 1fr;
            margin: 0;
            padding: ${0.1 * u}px;
            background-color: black;
            color: white;
            font-family: Arial, sans-serif;
          }
          #div-l {grid-area:3/2; cursor: col-resize;}
          #div-r {grid-area:3/4; cursor: col-resize;}
          #div-l,#div-r {
            z-index: 2;
            background-color: #111;
          }
          #title {
            grid-area:1/1/span 1/span 5;
            text-align: center;
            font-size: ${0.6 * u}px;
            color: red;
            font-weight: bold;
          }
          #tabs {
            display: flex;
            grid-area:2/1/span 1/span 5;
          }
          #tabs button {
            flex-grow: 1;
            background-color: red;
            color: white;
            border: none;
            font-size: ${0.3 * u}px;
            cursor: pointer;
          }
          #tabs button:first-child { border-top-left-radius: ${0.2*u}px}
          #tabs button:last-child { border-top-right-radius: ${0.2*u}px}
          #tabs button:hover {
            background-color: #cc0000;
          }
          #info {
            grid-area:3/1;
            background-color: #222;
            padding: ${0.2 * u}px;
            overflow: auto;
          }
          #info code, #info pre {
            background-color: #333;
            border: ${0.02 * u}px solid #444;
            border-radius: ${0.05 * u}px;
            padding: 0 ${0.05*u}px;
            font-family: Courier;
          }
          #code-wrapper {
            grid-area:3/3;
            position: relative;
            background-color: #333;
          }
          #code {
            position: absolute;
            top: 0;
            left: 0;
            width: calc(100% - ${0.4*u}px);
            height: calc(100% - ${0.4*u}px);
            font: ${0.3 * u}px monospace;
            line-height: ${0.375 * u}px;
            color: transparent;
            background: transparent;
            caret-color: white;
            border: none;
            padding: ${0.2 * u}px;
            resize: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow: auto;
            z-index: 1;
          }
          #code-highlight {
            position: absolute;
            top: 0;
            left: 0;
            width: calc(100% - ${0.4*u}px);
            height: calc(100% - ${0.4*u}px);
            font: ${0.3 * u}px 'Courier New', monospace;
            padding: ${0.2 * u}px;
            pointer-events: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow: hidden;
            margin: 0;
            z-index: 0;
          }
          #result {
            display: grid;
            grid-template: ${1.2*u}px auto ${u}px / 1fr;
            grid-area:3/5;
            background-color: #222;
            padding: ${0.2 * u}px;
          }
          #cases {
            display: flex;
          }
          #cases button {
            height: 100%;
            background-color: #555;
            color: white;
            border: none;
            cursor: pointer;
            margin: 0;
            flex-grow: 1;
            font-weight: bold;
            font-size: ${0.4*u}px;
          }
          #cases button::before {
            content: '?';
            display: block;
            background-color: #aa0;
            aspect-ratio: 1/1;
            width: ${0.4*u}px;
            line-height: ${0.4*u}px;
            border-radius: 50%;
            font-weight: bold;
            margin: 0 auto;
            font-size: ${0.3*u}px;
            margin-bottom: ${0.1*u}px;
          }
          #cases button:first-child { border-top-left-radius: ${0.2*u}px}
          #cases button:last-child { border-top-right-radius: ${0.2*u}px}
          #cases button:not(:first-child) { border-left: ${0.05*u}px solid #444 }
          #cases button.passed::before {
            content: '\\2713';
            background-color: #0a0;
          }
          #cases button.failed::before {
            content: '\\2A09';
            background-color: #a00;
          }
          #cases button.focus {
            background-color: #111;
          }
          #match {
            overflow: auto;
            padding: ${0.1 * u}px;
            background-color: #111;
          }
          .diff-error {
            background-color: red;
            color: white;
          }
          #action {
            display: flex;
          }
          #action button {
            background-color: red;
            color: white;
            border: none;
            padding: ${0.2 * u}px;
            cursor: pointer;
            flex-grow: 1;
          }
          #action button:hover {
            background-color: #cc0000;
          }
          #action button:first-child { border-bottom-left-radius: ${0.2*u}px}
          #action button:last-child { border-bottom-right-radius: ${0.2*u}px}
          #time {
            grid-area:5/1/span 1/span 5;
            text-align: center;
            font-size: ${0.4 * u}px;
            color: white;
          }
          #score {
            grid-area:4/1/span 1/span 5;
            text-align: center;
            font-size: ${0.4 * u}px;
            color: white;
          }
          #home, #over, #wait {
            grid-area: 2/1/span 3/span 5;
            background-color: black;
            padding: ${u}px;
            text-align: center;
            display: none;
          }
          #home input, #home select {
            background-color: #333;
            color: white;
            border: 1px solid #555;
            padding: ${0.1 * u}px;
            margin: ${0.1 * u}px;
          }
          #home button, #wait button, #refresh-lb {
            background-color: red;
            color: white;
            border: none;
            padding: ${0.2 * u}px ${0.4 * u}px;
            cursor: pointer;
            margin-top: ${0.2 * u}px;
          }
          #over table {
            width: 80%;
            margin: 0 auto;
            border-collapse: collapse;
          }
          #over th, #over td {
            border: 1px solid #555;
            padding: ${0.1 * u}px;
            text-align: left;
          }
          #over th {
            background-color: red;
            color: white;
          }
          #over h3 {
            color: red;
          }
          #waiting-text { display: none; }

          /* Keywords / Built-ins */
            .hljs-keyword,
            .hljs-built_in,
            .hljs-literal,
            .hljs-variable.language,
            .hljs-meta.keyword {
            color: #c678dd;
            }

            /* Strings */
            .hljs-string,
            .hljs-meta.string,
            .hljs-regexp,
            .hljs-char.escape,
            .hljs-template-variable {
            color: #98c379;
            }

            /* Numbers / Constants */
            .hljs-number,
            .hljs-variable.constant,
            .hljs-symbol,
            .hljs-bullet {
            color: #d19a66;
            }

            /* Functions */
            .hljs-function,
            .hljs-title.function,
            .hljs-title.function.invoke,
            .hljs-title,
            .hljs-title.function,
            .hljs-title.function.invoke {
            color: #61afef;
            }

            /* Operators / Punctuation */
            .hljs-operator,
            .hljs-punctuation,
            .hljs-subst {
            color: #56b6c2;
            }

            /* Comments */
            .hljs-comment,
            .hljs-quote,
            .hljs-doctag {
            color: #9ca3af;
            font-style: italic;
            }

            /* Types / Classes */
            .hljs-type,
            .hljs-class,
            .hljs-title.class,
            .hljs-title.class.inherited {
            color: #e5c07b;
            }

            /* Properties, attributes, tags */
            .hljs-property,
            .hljs-attr,
            .hljs-attribute,
            .hljs-name,
            .hljs-section,
            .hljs-tag,
            .hljs-selector-tag,
            .hljs-selector-id,
            .hljs-selector-class,
            .hljs-selector-attr,
            .hljs-selector-pseudo {
            color: #e5c07b;
            }

            /* Meta */
            .hljs-meta,
            .hljs-meta.prompt {
            color: #61afef;
            }

            /* Text markup */
            .hljs-code { color: #abb2bf; }
            .hljs-emphasis { font-style: italic; }
            .hljs-strong { font-weight: bold; }
            .hljs-formula { color: #98c379; }
            .hljs-link { color: #61afef; text-decoration: underline; }

            /* Templates */
            .hljs-template-tag { color: #c678dd; }
            .hljs-template-variable { color: #98c379; }

            /* Diff */
            .hljs-addition { color: #98c379; background: rgba(152, 195, 121, 0.15); }
            .hljs-deletion { color: #e06c75; background: rgba(224, 108, 117, 0.15); }

            /* Reserved (ReasonML, etc.) */
            .hljs-pattern-match,
            .hljs-typing,
            .hljs-constructor,
            .hljs-module-access,
            .hljs-module {
            color: #e5c07b;
            }
        </style>
      </head>
      <body>
        <!-- Title -->
        <div id="title">Coder's Arena</div>
        <!-- Draggable vertical markers -->
        <div id="div-l"></div>
        <div id="div-r"></div>
        <!-- Problems -->
        <div id="tabs"></div>
        <!-- Problem Statement -->
        <div id="info"></div>
        <!-- Code -->
        <div id="code-wrapper">
          <textarea id="code" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off"></textarea>
          <pre id="code-highlight"><code></code></pre>
        </div>
        <!-- Running -->
        <div id="result">
          <div id="cases"></div>
          <div id="match"></div>
          <div id="action">
            <button id="test-btn">Test</button>
            <button id="submit-btn">Submit</button>
            <button id="finish-btn">Finish</button>
          </div>
        </div>
        <!-- Score -->
        <div id="score">Total Current Score: 0 / ${total_points}</div>
        <!-- Time limit -->
        <div id="time">Waiting for start</div>
        <!-- Registering -->
        <div id="home">
          <h1 style="color: red;">Welcome to Coder's Arena 2025!</h1>
          <p>Enter Name:</p>
          <input id="name-input" placeholder="Participant's Name"></input>
          <p>Select Language:</p>
          <select id="lang-select">
            <option>Python</option>
            <option>Java</option>
            <option>C++</option>
            <option>C</option>
          </select>
          <br>
          <button id="apply-btn">Apply!</button>
          <p id="waiting-text">Okay, you're registered! Wait for the competition to start.</p>
          <button id="spectate-btn">Spectate</button>
        </div>
        <!-- Waiting -->
        <div id="wait">
          <h1 style="color: red;">You submitted, wait for competition to end</h1>
          <button id="go-back-btn">Go back</button>
        </div>
        <!-- Over -->
        <div id="over">
          <h1 id="over-h1" style="color: red;">The Coder's Arena is finished!</h1>
          <p>Here are the winners!</p>
          <h3>Python</h3>
          <table id="lb-python">
            <tr><th>Name</th><th>Points</th></tr>
          </table>
          <h3>Java</h3>
          <table id="lb-java">
            <tr><th>Name</th><th>Points</th></tr>
          </table>
          <h3>C++</h3>
          <table id="lb-cpp">
            <tr><th>Name</th><th>Points</th></tr>
          </table>
          <h3>C</h3>
          <table id="lb-c">
            <tr><th>Name</th><th>Points</th></tr>
          </table>
          <button id="refresh-lb">Refresh Leaderboard</button>
        </div>
        <script>
          const unit = ${unit}; const challenges = ${client_challenges.toString()};
          let ws;
          let current_problem = 0;
          let current_case = 0;
          let passed = challenges.map(c => Array(c.num_testcases).fill(null));
          let displays = challenges.map(c => Array(c.num_testcases).fill(''));
          let name = localStorage.getItem('name');
          let lang = localStorage.getItem('lang');
          let accepted = false;
          let phase = 'start';
          let time_start = null;
          let time_end = null;
          let scheduled_start = null;
          let timer_interval = null;
          let total_current = 0;
          let total_points = 0;
          let hljs_lang = 'plaintext';
          let poll_interval = null;

          const $ = id => document.getElementById(id);
          const home = $('home');
          const wait = $('wait');
          const over = $('over');
          const score = $('score');
          const time_div = $('time');
          const over_h1 = $('over-h1');
          const name_input = $('name-input');
          const lang_select = $('lang-select');
          const apply_btn = $('apply-btn');
          const waiting_text = $('waiting-text');
          const spectate_btn = $('spectate-btn');
          const test_btn = $('test-btn');
          const submit_btn = $('submit-btn');
          const finish_btn = $('finish-btn');
          const go_back_btn = $('go-back-btn');
          const refresh_lb = $('refresh-lb');
          const info = $('info');
          const code = $('code');
          const code_highlight = $('code-highlight').querySelector('code');
          const match = $('match');
          const cases_div = $('cases');
          const tabs = $('tabs');
          const arena_elements = [tabs, info, $('code-wrapper'), $('result'), $('div-l'), $('div-r')];

          let left_fr = 1, code_fr = 2, result_fr = 1;
          const body = document.body;
          function update_grid() {
            body.style.gridTemplateColumns = \`\${left_fr}fr \${0.2 * unit}px \${code_fr}fr \${0.2 * unit}px \${result_fr}fr\`;
          }
          update_grid();

          function make_draggable(div, is_left) {
            div.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const start_x = e.clientX;
              const start_left = left_fr;
              const start_code = code_fr;
              const start_result = result_fr;
              const container_width = body.getBoundingClientRect().width - 2 * (0.2 * unit); // subtract dividers
              const total_fr = left_fr + code_fr + result_fr;
              const pixel_per_fr = container_width / total_fr;
              function move(e) {
                const pixel_delta = e.clientX - start_x;
                const fr_delta = pixel_delta / pixel_per_fr;
                if (is_left) {
                  left_fr = Math.max(0.1, start_left + fr_delta);
                  code_fr = Math.max(0.1, start_code - fr_delta);
                } else {
                  code_fr = Math.max(0.1, start_code + fr_delta);
                  result_fr = Math.max(0.1, start_result - fr_delta);
                }
                update_grid();
              }
              document.addEventListener('mousemove', move);
              document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), { once: true });
            });
          }

          make_draggable($('div-l'), true);
          make_draggable($('div-r'), false);

          function connect() {
            ws = new WebSocket('ws://' + location.host);
            ws.onopen = () => {
              time_div.textContent = 'Connected';
              if (name) ws.send(JSON.stringify({ type: 'reconnect', name }));
            };
            ws.onmessage = (e) => {
              const msg = JSON.parse(e.data);
              switch (msg.type) {
                case 'status':
                case 'phase': {
                  phase = msg.phase;
                  time_start = msg.time_start ?? time_start;
                  time_end = msg.time_end ?? time_end;
                  scheduled_start = msg.scheduled_start ?? scheduled_start;
                  total_points = msg.total_points ?? total_points;
                  if (msg.accepted) {
                    accepted = true;
                    lang = msg.lang;
                    hljs_lang = {Python: 'python', Java: 'java', 'C++': 'cpp', C: 'c'}[lang] || 'plaintext';
                  }
                  update_ui();
                  break;
                }
                case 'time_update': {
                  time_start = msg.time_start ?? time_start;
                  time_end = msg.time_end ?? time_end;
                  scheduled_start = msg.scheduled_start ?? scheduled_start;
                  update_ui();
                  break;
                }
                case 'accepted': {
                  accepted = true;
                  name = name_input.value;
                  lang = lang_select.value;
                  hljs_lang = {Python: 'python', Java: 'java', 'C++': 'cpp', C: 'c'}[lang] || 'plaintext';
                  localStorage.setItem('name', name);
                  localStorage.setItem('lang', lang);
                  update_ui();
                  break;
                }
                case 'declined': {
                  alert('Application declined.');
                  apply_btn.textContent = 'Declined, Apply again?';
                  apply_btn.disabled = false;
                  break;
                }
                case 'test_result': {
                  test_btn.textContent = 'Test';
                  test_btn.disabled = false;
                  passed[msg.problem][msg.case] = msg.passed;
                  displays[msg.problem][msg.case] = msg.display;
                  if (current_problem === msg.problem) update_cases();
                  if (current_case === msg.case && current_problem === msg.problem) update_match();
                  break;
                }
                case 'submit_result': {
                  submit_btn.textContent = 'Submit';
                  submit_btn.disabled = false;
                  msg.passed.forEach((p, i) => {
                    passed[msg.problem][i] = p;
                    displays[msg.problem][i] = msg.displays[i];
                  });
                  total_current = msg.total_current;
                  total_points = msg.total_points;
                  score.textContent = \`Total Current Score: \${total_current} / \${total_points}\`;
                  if (current_problem === msg.problem) {
                    update_cases();
                    update_match();
                  }
                  break;
                }
                case 'leaderboard': {
                  populate_leaderboard(msg.data);
                  break;
                }
                case 'error': {
                  alert(msg.msg);
                  break;
                }
              }
            };
            ws.onclose = () => {
              if (timer_interval) clearInterval(timer_interval);
              time_div.textContent = 'Disconnected...';
              setTimeout(connect, 5000);
            };
            ws.onerror = () => {
              ws.close();
            };
          }

          function update_ui() {
            home.style.display = 'none';
            wait.style.display = 'none';
            over.style.display = 'none';
            score.style.display = 'none';
            arena_elements.forEach(el => el.style.display = '');
            spectate_btn.style.display = phase === 'start' && !accepted ? '' : 'none';
            if (phase === 'start') {
              if (scheduled_start) {
                time_div.textContent = \`Competition starts at \${new Date(scheduled_start).toLocaleTimeString()}\`;
              } else {
                time_div.textContent = 'Waiting for start';
              }
              if (accepted) {
                home.style.display = 'block';
                name_input.style.display = 'none';
                lang_select.style.display = 'none';
                apply_btn.style.display = 'none';
                waiting_text.style.display = 'block';
                arena_elements.forEach(el => el.style.display = 'none');
              } else {
                home.style.display = 'block';
                name_input.style.display = '';
                lang_select.style.display = '';
                apply_btn.style.display = '';
                waiting_text.style.display = 'none';
                arena_elements.forEach(el => el.style.display = 'none');
              }
            } else if (phase === 'ongoing') {
              start_timer();
              if (accepted) {
                home.style.display = 'none';
                score.style.display = '';
              } else {
                over.style.display = 'block';
                over_h1.textContent = 'Competition Ongoing';
                arena_elements.forEach(el => el.style.display = 'none');
                ws.send(JSON.stringify({ type: 'get_leaderboard' }));
                if (poll_interval) clearInterval(poll_interval);
                poll_interval = setInterval(() => ws.send(JSON.stringify({ type: 'get_leaderboard' })), 10000);
              }
            } else if (phase === 'ended') {
              over.style.display = 'block';
              over_h1.textContent = 'The Coder\\'s Arena is finished!';
              arena_elements.forEach(el => el.style.display = 'none');
              time_div.textContent = 'Competition Over';
              ws.send(JSON.stringify({ type: 'get_leaderboard' }));
              if (poll_interval) clearInterval(poll_interval);
            }
          }

          function start_timer() {
            if (timer_interval) clearInterval(timer_interval);
            timer_interval = setInterval(() => {
              if (time_end) {
                const now = Date.now();
                let remaining = time_end - now;
                if (remaining <= 0) {
                  remaining = 0;
                  clearInterval(timer_interval);
                  phase = 'ended';
                  update_ui();
                }
                const hours = Math.floor(remaining / 3600000);
                const mins = Math.floor((remaining % 3600000) / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                time_div.textContent = \`\${hours.toString().padStart(2, '0')}:\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')} left\`;
              } else {
                time_div.textContent = 'No time limit';
              }
            }, 1000);
          }

          function select_problem(index) {
            current_problem = index;
            info.innerHTML = challenges[index].info;
            code.value = localStorage.getItem(\`code_\${index}\`) || '';
            update_highlight();
            update_cases();
            update_match();
            tabs.querySelectorAll('button').forEach((b, i) => b.style.backgroundColor = i === index ? '#990000' : 'red');
          }

          function update_cases() {
            cases_div.innerHTML = '';
            for (let i = 0; i < challenges[current_problem].num_testcases; i++) {
              const btn = document.createElement('button');
              btn.textContent = i.toString().padStart(2, '0');
              if (passed[current_problem][i] === true) btn.classList.add('passed');
              else if (passed[current_problem][i] === false) btn.classList.add('failed');
              if (current_case == i) btn.classList.add('focus');
              btn.onclick = () => {
                current_case = i;
                update_match();
              };
              cases_div.appendChild(btn);
            }
          }

          function update_match() {
            match.innerHTML = displays[current_problem][current_case] || '';
            Array.from(document.querySelectorAll('#cases button')).map((x,n) => {
                if (current_case == n) x.classList.add('focus');
                else x.classList.remove('focus');
            });
          }

          function update_highlight() {
            code_highlight.innerHTML = hljs.highlight(code.value, { language: hljs_lang }).value;
          }

          function populate_leaderboard(data) {
            const langs = { Python: 'lb-python', Java: 'lb-java', 'C++': 'lb-cpp', C: 'lb-c' };
            for (const [lang, table_id] of Object.entries(langs)) {
              const table = $(table_id);
              table.innerHTML = '<tr><th>Name</th><th>Points</th></tr>';
              (data[lang] || []).forEach(entry => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`<td>\${entry.name}</td><td>\${entry.points}</td>\`;
                table.appendChild(tr);
              });
            }
          }

          apply_btn.onclick = () => {
            const n = name_input.value.trim();
            const l = lang_select.value;
            if (!n) return alert('Enter name');
            ws.send(JSON.stringify({ type: 'apply', name: n, lang: l }));
            apply_btn.textContent = 'Waiting...';
            apply_btn.disabled = true;
          };

          spectate_btn.onclick = () => {
            over.style.display = 'block';
            over_h1.textContent = 'Competition Not Started Yet';
            home.style.display = 'none';
            ws.send(JSON.stringify({ type: 'get_leaderboard' }));
          };

          test_btn.onclick = () => {
            if (phase !== 'ongoing' || !accepted) return;
            test_btn.textContent = 'Loading...';
            test_btn.disabled = true;
            ws.send(JSON.stringify({ type: 'test', problem: current_problem, case: current_case, code: code.value }));
          };

          submit_btn.onclick = () => {
            if (phase !== 'ongoing' || !accepted) return;
            submit_btn.textContent = 'Loading...';
            submit_btn.disabled = true;
            ws.send(JSON.stringify({ type: 'submit', problem: current_problem, code: code.value }));
          };

          finish_btn.onclick = () => {
            wait.style.display = 'block';
            arena_elements.forEach(el => el.style.display = 'none');
            score.style.display = 'none';
          };

          go_back_btn.onclick = () => {
            wait.style.display = 'none';
            arena_elements.forEach(el => el.style.display = '');
            if (phase === 'ongoing' && accepted) score.style.display = '';
          };

          refresh_lb.onclick = () => {
            ws.send(JSON.stringify({ type: 'get_leaderboard' }));
          };

          code.addEventListener('input', () => {
            localStorage.setItem(\`code_\${current_problem}\`, code.value);
            update_highlight();
          });
          code.addEventListener('scroll', () => {
            code_highlight.parentElement.scrollTop = code.scrollTop;
            code_highlight.parentElement.scrollLeft = code.scrollLeft;
          });

          // Init tabs
          challenges.forEach((ch, i) => {
            const btn = document.createElement('button');
            btn.textContent = ch.name;
            btn.onclick = () => select_problem(i);
            tabs.appendChild(btn);
          });
          select_problem(0);

          connect();
          update_ui();
        </script>
      </body>
    </html>
  `, {
    headers: { 'content-type': 'text/html' },
  });
});

cli_input();