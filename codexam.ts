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
/** Unit of the interface in Pixels (Kept for backwards compatibility but design is now relative) */
const unit: number = 50;
/** Challenges */
import { challenges } from './challenges.ts';

// #endregion
const red: string = "\x1b[31m";
const green: string = "\x1b[32m";
const yellow: string = "\x1b[33m";
const reset: string = "\x1b[0m";
const encoder: TextEncoder = new TextEncoder();

// #region System variables - Modifed on runtime
/** Current phase of competition */
let phase: 'start' | 'ongoing' | 'ended' = 'start';
/** Practice toggle */
let is_practice: boolean = false;
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
  broadcast({ type: 'phase', phase, is_practice });
  broadcast_time();
  Deno.stdout.writeSync(encoder.encode(`${green}Competition started.${reset}\n`));
}

/** End the competition */
function end_competition(): void {
  phase = 'ended';
  scheduled_end = null;
  broadcast({ type: 'phase', phase, is_practice });
  Deno.stdout.writeSync(encoder.encode(`${green}Competition ended.${reset}\n`));
}

/** Broadcast message to all connections */
function broadcast(msg:
    {type: 'phase', phase:"start" | "ongoing" | "ended", is_practice: boolean} |
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
      
      if (cmd === 'help') {
        const helpMsg = `
${green}Available Commands:${reset}
  ${yellow}start [HH:MM]${reset}  - Start competition now or schedule it.
  ${yellow}end [HH:MM]${reset}    - End competition now or schedule it.
  ${yellow}practice${reset}       - Toggle practice mode (no time limits, auto-accepts, viewable rankings).
  ${yellow}help${reset}           - Show this help message.
  ${yellow}y / n${reset}          - Accept or decline pending applicant.
`;
        Deno.stdout.writeSync(encoder.encode(helpMsg));
      } else if (cmd === 'practice') { // Changed from 'freestyle'
        is_practice = !is_practice;
        if (is_practice) {
          phase = 'ongoing';
          time_start = null;
          time_end = null;
          scheduled_start = null;
          scheduled_end = null;
          broadcast({ type: 'phase', phase, is_practice });
          broadcast_time();
          Deno.stdout.writeSync(encoder.encode(`${green}Practice mode enabled. Competition set to ongoing with no time limits.${reset}\n`));
        } else {
          phase = 'start';
          broadcast({ type: 'phase', phase, is_practice });
          Deno.stdout.writeSync(encoder.encode(`${yellow}Practice mode disabled. Competition reset to start phase.${reset}\n`));
        }
      } else if (cmd === 'start') {
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
            broadcast({ type: 'phase', phase, is_practice });
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
        Deno.stdout.writeSync(encoder.encode(`${red}Unknown command or invalid phase. Type 'help' for commands.${reset}\n`));
      }
    }
  }
}

function withTimeout<T>(fn: () => Promise<T>, timeout: number, arg: any[] = []) {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout exceeded")), timeout)
  );

  return Promise.race([fn(...(arg as [])), timeoutPromise]);
}

/** Run code in specified language */
async function run_code(lang: string, code: string, input: string): Promise<{ output: string, error: string }> {
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

    console.log('RUNNING', cmd[0]);
    const proc_cmd = new Deno.Command(cmd[0], { args: cmd.slice(1), cwd: temp_dir, stdin: 'piped', stdout: 'piped', stderr: 'piped' });
    const proc = proc_cmd.spawn();
    let timeout_reached = false;

    const timeout = setTimeout(() => {
      try {
        timeout_reached = true;
        proc.kill('SIGTERM');
      } catch (e) {}
    }, 5000);

    const writer = proc.stdin.getWriter();

    await withTimeout(() => writer.write(encoder.encode(input)), 5000);
    await withTimeout(() => writer.close(), 5000);

    const proc_out = await withTimeout(() => proc.output(), 5000);

    clearTimeout(timeout);

    if (timeout_reached) {
      error = 'Execution exceeded time limit (5 seconds).';
    } else if (!proc_out.success) {
      error = decoder.decode(proc_out.stderr);
    } else {
      output = decoder.decode(proc_out.stdout);
    }

    console.log('ENDED', cmd[0]);
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
      if (phase !== 'start' && !is_practice) {
        ws.send(JSON.stringify({ type: 'error', msg: 'Registration closed' }));
        return;
      }
      
      if (is_practice) {
        // Auto-accept the participant
        participants.set(msg.name, {
          name: msg.name,
          lang: msg.lang,
          accepted: true,
          problem_scores: challenges.map(() => ({ max_score: 0, current_score: 0, achieve_time: null })),
          total_max: 0,
          total_current: 0,
          total_achieve_time: null,
        });
        connections.set(ws, msg.name);
        ws.send(JSON.stringify({ type: 'accepted' }));
        Deno.stdout.writeSync(encoder.encode(`${green}Auto-accepted participant ${msg.name} (Practice Mode)${reset}\n`));
      } else {
        // Normal queue flow
        pending.push({ name: msg.name, lang: msg.lang, ws });
        process_next_pending();
      }
      break;
    }
    case 'reconnect': {
      if (participants.has(msg.name) && participants.get(msg.name)!.accepted) {
        connections.set(ws, msg.name);
        ws.send(JSON.stringify({
          type: 'status',
          phase,
          is_practice,
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
        const display = error ? `<pre style="margin:0;color:#ef4444;">${error}</pre>` : output_html(tc.output, output || '');
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
          const display = error ? `<pre style="margin:0;color:#ef4444;">${error}</pre>` : output_html(tc.output, output || '');
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
Deno.serve({ port: 8080 }, async (req) => {
  const path = new URL(req.url).pathname.split('/');
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'status',
        phase,
        is_practice,
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

  return new Response(/*html*/`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Coder's Arena</title>
        <link rel="stylesheet" href="/hljs/default.min.css">
        <script src="/hljs/highlight.min.js"></script>
        <script src="/hljs/python.min.js"></script>
        <script src="/hljs/java.min.js"></script>
        <script src="/hljs/cpp.min.js"></script>
        <script src="/hljs/c.min.js"></script>
        <style>
          :root {
            --primary: #06b6d4;
            --primary-hover: #0891b2;
            --bg-base: #09090b;
            --bg-panel: #18181b;
            --border: #27272a;
            --text-main: #fafafa;
            --text-muted: #a1a1aa;
            --success: #10b981;
            --danger: #ef4444;
            --pending: #eab308;
            
            --left-fr: 1;
            --code-fr: 2;
            --result-fr: 1;
          }

          * { box-sizing: border-box; }
          :focus { outline: 2px solid var(--primary); outline-offset: -2px; }
          
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: var(--bg-base); }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow: hidden;
          }

          body {
            display: grid;
            grid-template-rows: 60px 48px minmax(0, 1fr) 40px 40px;
            /* Columns manipulated by JS drag */
            grid-template-columns: var(--left-fr)fr 4px var(--code-fr)fr 4px var(--result-fr)fr;
          }

          #title {
            grid-column: 1 / -1; grid-row: 1;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.25rem; font-weight: 700;
            color: var(--primary);
            border-bottom: 1px solid var(--border);
            background-color: var(--bg-base);
          }

          #tabs {
            grid-column: 1 / -1; grid-row: 2;
            display: flex; overflow-x: auto; flex-wrap: nowrap;
            background-color: var(--bg-panel);
            border-bottom: 1px solid var(--border);
            padding: 0 1rem; gap: 0.5rem; align-items: center;
          }
          #tabs button {
            flex: 0 0 auto;
            background: transparent; color: var(--text-muted);
            border: none; padding: 0.35rem 0.75rem;
            font-size: 0.875rem; font-weight: 500;
            cursor: pointer; border-radius: 6px;
            transition: all 0.2s; white-space: nowrap;
          }
          #tabs button.active, #tabs button:hover {
            background-color: var(--border); color: var(--primary);
          }

          #info {
            grid-column: 1; grid-row: 3;
            background-color: var(--bg-panel);
            padding: 1rem; overflow-y: auto;
            line-height: 1.6; color: var(--text-main);
          }
          #info code, #info pre {
            background-color: var(--bg-base);
            border: 1px solid var(--border); border-radius: 6px;
            padding: 0.2rem 0.4rem; font-family: ui-monospace, monospace; font-size: 0.875rem;
          }

          #div-l { grid-column: 2; grid-row: 3; cursor: col-resize; background-color: var(--border); transition: background-color 0.2s; z-index: 10; }
          #div-r { grid-column: 4; grid-row: 3; cursor: col-resize; background-color: var(--border); transition: background-color 0.2s; z-index: 10; }
          #div-l:hover, #div-r:hover { background-color: var(--primary); }

          #code-wrapper {
            grid-column: 3; grid-row: 3;
            position: relative; background-color: var(--bg-panel);
          }
          #code, #code-highlight {
            position: absolute; inset: 0; width: 100%; height: 100%;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14px; line-height: 1.5; padding: 1rem; margin: 0;
            box-sizing: border-box; border: none; white-space: pre-wrap; word-wrap: break-word;
          }
          #code {
            color: transparent; background: transparent;
            caret-color: var(--primary); resize: none; z-index: 1; outline: none; overflow: auto;
          }
          #code-highlight {
            color: #e4e4e7; z-index: 0; pointer-events: none; overflow: hidden;
          }

          #result {
            grid-column: 5; grid-row: 3;
            display: flex; flex-direction: column;
            background-color: var(--bg-panel);
            overflow: hidden;
          }
          #cases {
            flex: 0 0 auto; display: flex; overflow-x: auto; flex-wrap: nowrap;
            padding: 0.75rem; gap: 0.5rem;
            background-color: var(--bg-base); border-bottom: 1px solid var(--border);
          }
          #cases button {
            flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem;
            background-color: var(--border); color: var(--text-muted);
            border: 1px solid transparent; border-radius: 6px;
            padding: 0.4rem 0.75rem; cursor: pointer; font-weight: 500;
            transition: all 0.2s; font-size: 0.875rem;
          }
          #cases button::before {
            content: ''; display: inline-block; width: 8px; height: 8px;
            border-radius: 50%; background-color: var(--pending);
          }
          #cases button.passed::before { background-color: var(--success); }
          #cases button.failed::before { background-color: var(--danger); }
          #cases button.focus {
            background-color: var(--bg-base); color: var(--text-main); border-color: var(--primary);
          }

          #match {
            flex: 1 1 auto; overflow: auto; padding: 1rem;
            font-family: ui-monospace, monospace; font-size: 13px;
          }
          .diff-error {
            background-color: rgba(239, 68, 68, 0.15); color: var(--danger); border-radius: 2px;
          }

          #action {
            flex: 0 0 auto; display: flex; gap: 0.5rem; padding: 0.75rem;
            background-color: var(--bg-base); border-top: 1px solid var(--border);
          }
          #action button {
            flex: 1; background-color: var(--border); color: var(--text-main);
            border: 1px solid #3f3f46; border-radius: 6px;
            padding: 0.5rem; font-weight: 500; cursor: pointer; transition: 0.2s;
          }
          #action button:hover { background-color: #3f3f46; }
          #action button#submit-btn {
            background-color: var(--primary); color: var(--bg-base); border-color: var(--primary);
          }
          #action button#submit-btn:hover { background-color: var(--primary-hover); }

          #score {
            grid-column: 1 / -1; grid-row: 4;
            display: flex; align-items: center; justify-content: center;
            background-color: var(--bg-base); border-top: 1px solid var(--border);
            font-size: 0.875rem; color: var(--text-muted); font-weight: 500;
          }
          #time {
            grid-column: 1 / -1; grid-row: 5;
            display: flex; align-items: center; justify-content: center;
            background-color: var(--border); color: var(--primary);
            font-weight: 600; font-size: 1rem; letter-spacing: 0.5px;
          }

          /* Modal / Overlays */
          #home, #over, #wait {
            position: fixed; inset: 0; z-index: 50;
            background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(4px);
            display: none; align-items: center; justify-content: center; padding: 1rem;
          }
          .modal-content {
            background: var(--bg-panel); border: 1px solid var(--border);
            border-radius: 12px; padding: 2.5rem; width: 100%; max-width: 500px;
            text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            max-height: 90vh; overflow-y: auto;
          }
          .modal-content h1 { color: var(--primary); font-size: 1.5rem; margin-top: 0; }
          .modal-content p { color: var(--text-muted); margin-bottom: 0.5rem; font-size: 0.875rem; text-align: left;}
          .modal-content input, .modal-content select {
            width: 100%; background-color: var(--bg-base); color: var(--text-main);
            border: 1px solid var(--border); padding: 0.6rem; border-radius: 6px;
            margin-bottom: 1.25rem; font-size: 1rem;
          }
          .modal-content button {
            width: 100%; background-color: var(--primary); color: var(--bg-base);
            border: none; padding: 0.6rem; border-radius: 6px; cursor: pointer;
            font-weight: 600; font-size: 1rem; margin-top: 0.5rem; transition: 0.2s;
          }
          .modal-content button:hover { background-color: var(--primary-hover); }
          .modal-content button.secondary {
            background-color: var(--border); color: var(--text-main); margin-top: 0.75rem;
          }
          .modal-content button.secondary:hover { background-color: #3f3f46; }
          
          #over .modal-content { max-width: 700px; }
          #over table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem; }
          #over th, #over td { border-bottom: 1px solid var(--border); padding: 0.75rem; text-align: left; }
          #over th { color: var(--primary); font-weight: 600; }
          #over h3 { color: var(--text-main); text-align: left; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
          #waiting-text { display: none; color: var(--success) !important; text-align: center !important; margin: 1rem 0; font-weight: 500; }

          /* Syntax Highlighting overrides */
          .hljs-keyword, .hljs-built_in, .hljs-literal, .hljs-variable.language, .hljs-meta.keyword { color: #c678dd; }
          .hljs-string, .hljs-meta.string, .hljs-regexp, .hljs-char.escape, .hljs-template-variable { color: #98c379; }
          .hljs-number, .hljs-variable.constant, .hljs-symbol, .hljs-bullet { color: #d19a66; }
          .hljs-function, .hljs-title.function, .hljs-title.function.invoke, .hljs-title { color: #61afef; }
          .hljs-operator, .hljs-punctuation, .hljs-subst { color: #56b6c2; }
          .hljs-comment, .hljs-quote, .hljs-doctag { color: #9ca3af; font-style: italic; }
          .hljs-type, .hljs-class, .hljs-title.class, .hljs-title.class.inherited { color: #e5c07b; }
          .hljs-property, .hljs-attr, .hljs-attribute, .hljs-name, .hljs-section, .hljs-tag, .hljs-selector-tag, .hljs-selector-id, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo { color: #e5c07b; }
          .hljs-meta, .hljs-meta.prompt { color: #61afef; }
          .hljs-code { color: #abb2bf; } .hljs-emphasis { font-style: italic; } .hljs-strong { font-weight: bold; } .hljs-formula { color: #98c379; } .hljs-link { color: #61afef; text-decoration: underline; }
          .hljs-template-tag { color: #c678dd; } .hljs-addition { color: #98c379; background: rgba(152, 195, 121, 0.15); } .hljs-deletion { color: #e06c75; background: rgba(224, 108, 117, 0.15); }
        </style>
      </head>
      <body>
        <div id="title">Coder's Arena</div>
        <div id="tabs"></div>
        <div id="info"></div>
        <div id="div-l"></div>
        <div id="code-wrapper">
          <textarea id="code" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off"></textarea>
          <pre id="code-highlight"><code></code></pre>
        </div>
        <div id="div-r"></div>
        <div id="result">
          <div id="cases"></div>
          <div id="match"></div>
          <div id="action">
            <button id="test-btn">Test</button>
            <button id="submit-btn">Submit</button>
            <button id="lb-btn" style="display:none;">Rankings</button>
            <button id="finish-btn">Finish</button>
          </div>
        </div>
        <div id="score">Total Current Score: 0 / ${total_points}</div>
        <div id="time">Waiting for start</div>
        
        <div id="home">
          <div class="modal-content">
            <h1>Welcome to Coder's Arena 2025!</h1>
            <p>Participant's Name</p>
            <input id="name-input" placeholder="Enter Name..." autocomplete="off"></input>
            <p>Select Language</p>
            <select id="lang-select">
              <option>Python</option>
              <option>Java</option>
              <option>C++</option>
              <option>C</option>
            </select>
            <button id="apply-btn">Apply!</button>
            <p id="waiting-text">Registration successful! Waiting for the competition to start...</p>
            <button id="spectate-btn" class="secondary">Spectate Rankings</button>
          </div>
        </div>
        
        <div id="wait">
          <div class="modal-content">
            <h1>Submission Complete</h1>
            <p style="text-align:center;">You have submitted your code. Please wait for the competition to officially end.</p>
            <button id="go-back-btn" class="secondary">Go Back to Editor</button>
          </div>
        </div>
        
        <div id="over">
          <div class="modal-content">
            <h1 id="over-h1">The Coder's Arena is finished!</h1>
            <p style="text-align:center; margin-bottom: 1.5rem;">Here are the final rankings.</p>
            <h3>Python</h3>
            <table id="lb-python"><tr><th>Name</th><th>Points</th></tr></table>
            <h3>Java</h3>
            <table id="lb-java"><tr><th>Name</th><th>Points</th></tr></table>
            <h3>C++</h3>
            <table id="lb-cpp"><tr><th>Name</th><th>Points</th></tr></table>
            <h3>C</h3>
            <table id="lb-c"><tr><th>Name</th><th>Points</th></tr></table>
            <button id="refresh-lb">Refresh Leaderboard</button>
            <button id="back-arena-btn" class="secondary" style="display:none;">Back to Arena</button>
          </div>
        </div>
        
        <script>
          const challenges = ${client_challenges.toString()};
          let ws;
          let current_problem = 0;
          let current_case = 0;
          let passed = challenges.map(c => Array(c.num_testcases).fill(null));
          let displays = challenges.map(c => Array(c.num_testcases).fill(''));
          let name = localStorage.getItem('name');
          let lang = localStorage.getItem('lang');
          let accepted = false;
          let phase = 'start';
          let is_practice = false;
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
          const lb_btn = $('lb-btn');
          const finish_btn = $('finish-btn');
          const go_back_btn = $('go-back-btn');
          const back_arena_btn = $('back-arena-btn');
          const refresh_lb = $('refresh-lb');
          const info = $('info');
          const code = $('code');
          const code_highlight = $('code-highlight').querySelector('code');
          const match = $('match');
          const cases_div = $('cases');
          const tabs = $('tabs');

          let left_fr = 1, code_fr = 2, result_fr = 1;
          const body = document.body;
          function update_grid() {
            body.style.gridTemplateColumns = \`\${left_fr}fr 4px \${code_fr}fr 4px \${result_fr}fr\`;
          }
          update_grid();

          function make_draggable(div, is_left) {
            div.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const start_x = e.clientX;
              const start_left = left_fr;
              const start_code = code_fr;
              const start_result = result_fr;
              const container_width = body.getBoundingClientRect().width - 8; 
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
            ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
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
                  if (msg.is_practice !== undefined) is_practice = msg.is_practice;
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
            
            spectate_btn.style.display = phase === 'start' && !accepted ? 'block' : 'none';
            lb_btn.style.display = is_practice ? 'block' : 'none';

            if (is_practice) {
              time_div.textContent = 'Practice Mode';
              start_timer();
            }

            if (phase === 'start') {
              if (scheduled_start && !is_practice) {
                start_timer();
              } else if (!is_practice) {
                time_div.textContent = 'Waiting for start';
              }
              if (accepted) {
                home.style.display = 'flex';
                name_input.style.display = 'none';
                name_input.previousElementSibling.style.display = 'none';
                lang_select.style.display = 'none';
                lang_select.previousElementSibling.style.display = 'none';
                apply_btn.style.display = 'none';
                waiting_text.style.display = 'block';
              } else {
                home.style.display = 'flex';
                name_input.style.display = '';
                name_input.previousElementSibling.style.display = '';
                lang_select.style.display = '';
                lang_select.previousElementSibling.style.display = '';
                apply_btn.style.display = '';
                waiting_text.style.display = 'none';
              }
            } else if (phase === 'ongoing') {
              if (!is_practice) start_timer();
              if (!accepted) {
                if (is_practice) {
                  home.style.display = 'flex';
                  name_input.style.display = '';
                  lang_select.style.display = '';
                  apply_btn.style.display = '';
                  spectate_btn.style.display = 'block';
                } else {
                  over.style.display = 'flex';
                  over_h1.textContent = 'Competition Ongoing';
                  ws.send(JSON.stringify({ type: 'get_leaderboard' }));
                  if (poll_interval) clearInterval(poll_interval);
                  poll_interval = setInterval(() => ws.send(JSON.stringify({ type: 'get_leaderboard' })), 10000);
                }
              }
            } else if (phase === 'ended') {
              over.style.display = 'flex';
              over_h1.textContent = 'The Coder\\'s Arena is finished!';
              time_div.textContent = 'Competition Over';
              ws.send(JSON.stringify({ type: 'get_leaderboard' }));
              if (poll_interval) clearInterval(poll_interval);
            }
          }

          function start_timer() {
            if (timer_interval) clearInterval(timer_interval);
            timer_interval = setInterval(() => {
              if (is_practice) {
                time_div.textContent = 'Practice Mode';
                return;
              }
              if (phase == 'start' && scheduled_start || phase == 'ongoing' && time_end) {
                const now = Date.now();
                let remaining = (phase == 'start' ? scheduled_start : time_end) - now;
                if (remaining <= 0) {
                  remaining = 0;
                  clearInterval(timer_interval);
                  phase = 'ended';
                  update_ui();
                }
                const hours = Math.floor(remaining / 3600000);
                const mins = Math.floor((remaining % 3600000) / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                time_div.textContent = \`\${hours.toString().padStart(2, '0')}:\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')} left\${phase == 'start' ? ' to start' : ''}\`;
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
            tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index));
          }

          function update_cases() {
            cases_div.innerHTML = '';
            for (let i = 0; i < challenges[current_problem].num_testcases; i++) {
              const btn = document.createElement('button');
              btn.textContent = 'Test ' + i.toString().padStart(2, '0');
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
            over.style.display = 'flex';
            over_h1.textContent = is_practice ? 'Practice Rankings' : 'Competition Not Started Yet';
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

          lb_btn.onclick = () => {
            over.style.display = 'flex';
            over_h1.textContent = 'Practice Rankings';
            back_arena_btn.style.display = 'inline-block';
            ws.send(JSON.stringify({ type: 'get_leaderboard' }));
          };

          finish_btn.onclick = () => {
            wait.style.display = 'flex';
          };

          go_back_btn.onclick = () => {
            wait.style.display = 'none';
          };
          
          back_arena_btn.onclick = () => {
            over.style.display = 'none';
            back_arena_btn.style.display = 'none';
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