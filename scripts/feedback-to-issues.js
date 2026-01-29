#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');

function usage(exitCode = 0) {
	const msg = `\
Usage:
  npm run feedback:issues -- [path]

Description:
  Step-through triage for local feedback logs (JSONL) that creates GitHub issues.
  - Auto-detects repo from git remote (override with --repo)
  - Ensures minimal labels exist (creates missing labels)
  - Never includes IP or User-Agent in issues (privacy)
  - Adds a hidden dedupe marker to each issue body

Args:
  path                      Optional. A JSONL file or a directory (default: feedback/)

Options:
  --repo <owner/name>       Override detected repository
  --remote <name>           Git remote to inspect (default: origin)
  --state <path>            State file path (default: feedback/.triage-state.json)
	--no-template             Use legacy issue body format (default uses AI Fix template sections)
  --dry-run                 Do not create labels/issues (prints what it would do)
  -h, --help                Show help

Interactive commands:
	y          Create issue for this item
	[Enter]/n  Next item (do not create)
	p          Previous item
	s          Skip (mark as skipped locally)
	j          Jump to item number
	q          Quit
`;
	process.stdout.write(msg);
	process.exit(exitCode);
}

function parseArgs(argv) {
	const args = {
		pathArg: undefined,
		repo: undefined,
		remote: 'origin',
		statePath: path.join('feedback', '.triage-state.json'),
		dryRun: false,
		useTemplateBody: true
	};

	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a) continue;
		if (a === '-h' || a === '--help') usage(0);
		if (a === '--dry-run') {
			args.dryRun = true;
			continue;
		}
		if (a === '--no-template') {
			args.useTemplateBody = false;
			continue;
		}
		if (a.startsWith('--repo=')) {
			args.repo = a.slice('--repo='.length);
			continue;
		}
		if (a === '--repo') {
			args.repo = argv[++i];
			continue;
		}
		if (a.startsWith('--remote=')) {
			args.remote = a.slice('--remote='.length);
			continue;
		}
		if (a === '--remote') {
			args.remote = argv[++i];
			continue;
		}
		if (a.startsWith('--state=')) {
			args.statePath = a.slice('--state='.length);
			continue;
		}
		if (a === '--state') {
			args.statePath = argv[++i];
			continue;
		}
		if (a.startsWith('-')) {
			throw new Error(`Unknown option: ${a}`);
		}
		positional.push(a);
	}

	if (positional.length > 1) {
		throw new Error('Too many positional args. Provide at most one path.');
	}
	args.pathArg = positional[0];
	return args;
}

function run(cmd, args, opts = {}) {
	const res = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...opts
	});
	return res;
}

function runOrThrow(cmd, args, opts = {}) {
	const res = run(cmd, args, opts);
	if (res.status !== 0) {
		const stderr = (res.stderr || '').trim();
		throw new Error(stderr || `${cmd} failed (exit ${res.status})`);
	}
	return (res.stdout || '').trim();
}

function parseGitHubRepoFromRemoteUrl(url) {
	if (!url) return undefined;
	let u = url.trim();
	if (u.endsWith('.git')) u = u.slice(0, -'.git'.length);

	// git@github.com:owner/repo
	const scp = u.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
	if (scp) return `${scp[1]}/${scp[2]}`;

	// https://github.com/owner/repo
	const https = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
	if (https) return `${https[1]}/${https[2]}`;

	// ssh://git@github.com/owner/repo
	const ssh = u.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+)$/i);
	if (ssh) return `${ssh[1]}/${ssh[2]}`;

	return undefined;
}

function detectRepoFromGitRemote(remoteName) {
	try {
		runOrThrow('git', ['rev-parse', '--show-toplevel']);
	} catch {
		return undefined;
	}

	let remoteUrl = '';
	try {
		remoteUrl = runOrThrow('git', ['remote', 'get-url', remoteName]);
	} catch {
		// Fallback: use first remote
		const remotes = runOrThrow('git', ['remote']).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
		if (remotes.length === 0) return undefined;
		remoteUrl = runOrThrow('git', ['remote', 'get-url', remotes[0]]);
	}

	return parseGitHubRepoFromRemoteUrl(remoteUrl);
}

function sha256Hex(s) {
	return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function normalizeMessage(message) {
	return String(message || '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

function redactIps(text) {
	let s = String(text || '');
	// IPv4 (best-effort)
	s = s.replace(/\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g, '[REDACTED IP]');
	// IPv6 (best-effort)
	s = s.replace(/\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b/g, '[REDACTED IP]');
	return s;
}

function sanitizeFeedbackRecordForIssue(record) {
	// Privacy: never include raw IP or User-Agent in issues.
	if (!record || typeof record !== 'object') return {};
	const out = {};
	for (const [k, v] of Object.entries(record)) {
		const key = String(k);
		if (key === 'ip' || key === 'ua' || key === 'userAgent') continue;
		out[key] = v;
	}
	return out;
}

function makeMarkerId({ ts, deviceType, message }) {
	const normalized = normalizeMessage(message);
	const messageHash = sha256Hex(normalized);
	const device = String(deviceType || 'unknown').toLowerCase();
	return `${ts}|${device}|sha256:${messageHash}`;
}

function makeMarkerLine(markerId) {
	return `<!-- pj-feedback-id: ${markerId} -->`;
}

function loadJsonFile(filePath, fallback) {
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function saveJsonFileAtomic(filePath, obj) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
	fs.renameSync(tmp, filePath);
}

function readJsonlFile(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8');
	const lines = raw.split(/\r?\n/);
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || !line.trim()) continue;
		try {
			const record = JSON.parse(line);
			out.push({ record, lineNo: i + 1, rawLine: line });
		} catch (e) {
			out.push({ parseError: String(e && e.message ? e.message : e), lineNo: i + 1, rawLine: line });
		}
	}
	return out;
}

function isJsonlFile(p) {
	return p.toLowerCase().endsWith('.jsonl');
}

async function promptLine(rl, question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => resolve(String(answer || '').trim()));
	});
}

function getMinimalLabels() {
	const deviceColor = 'cfd3d7';
	return [
		{ name: 'feedback', color: '1d76db', description: 'Collected from the in-game local feedback form.' },
		{ name: 'needs-triage', color: 'fbca04', description: 'Needs review and categorization.' },
		{ name: 'ai-fix', color: '5319e7', description: 'AI/Copilot-friendly fix request (treat as a design brief).' },
		{ name: 'gameplay', color: '0e8a16', description: 'Gameplay feel, controls, fairness, or level design.' },
		{ name: 'generation', color: '0052cc', description: 'Photo → platform generation / geometry normalization.' },
		{ name: 'fairness', color: 'd93f0b', description: 'Unfair difficulty spikes, unclear jumps, or trust issues.' },
		{ name: 'collision', color: 'd4c5f9', description: 'Collision/physics mismatch with visuals or unstable edges.' },
		{ name: 'difficulty', color: 'c2e0c6', description: 'Difficulty tuning/normalization issues.' },
		{ name: 'debug', color: 'bfdadc', description: 'Debug overlays, diagnostics, or instrumentation.' },
		{ name: 'device: desktop', color: deviceColor, description: 'Reported from desktop/laptop browser.' },
		{ name: 'device: tablet', color: deviceColor, description: 'Reported from tablet browser.' },
		{ name: 'device: mobile', color: deviceColor, description: 'Reported from mobile browser.' },
		{ name: 'device: unknown', color: deviceColor, description: 'Device type not known / not provided.' }
	];
}

function ghApiJson({ method, endpoint, repo, inputObj, fields }) {
	const repoParts = repo ? String(repo).split('/') : [];
	const owner = repoParts.length === 2 ? repoParts[0] : '';
	const repoName = repoParts.length === 2 ? repoParts[1] : '';
	const expandedEndpoint = endpoint
		.replaceAll('{owner}', owner)
		.replaceAll('{repo}', repoName);

	const args = ['api'];
	if (method) args.push('-X', method);
	args.push(expandedEndpoint);
	if (fields) {
		for (const [k, v] of Object.entries(fields)) {
			args.push('-f', `${k}=${v}`);
		}
	}

	let input = undefined;
	if (inputObj !== undefined) {
		args.push('--input', '-');
		input = JSON.stringify(inputObj);
	}

	const res = spawnSync('gh', args, {
		encoding: 'utf8',
		input,
		stdio: ['pipe', 'pipe', 'pipe']
	});
	if (res.status !== 0) {
		const stderr = (res.stderr || '').trim();
		throw new Error(stderr || `gh api failed (exit ${res.status})`);
	}
	const stdout = (res.stdout || '').trim();
	if (!stdout) return null;
	return JSON.parse(stdout);
}

function ensureLabelsExist({ repo, dryRun }) {
	const desired = getMinimalLabels();
	if (dryRun) {
		process.stdout.write(`(dry-run) Would ensure labels exist in ${repo}:\n`);
		for (const l of desired) process.stdout.write(`  - ${l.name}\n`);
		return;
	}

	const existing = ghApiJson({ method: 'GET', endpoint: 'repos/{owner}/{repo}/labels', repo, fields: { per_page: '100' } }) || [];
	const existingNames = new Set(existing.map((l) => String(l.name || '').toLowerCase()));

	for (const l of desired) {
		if (existingNames.has(l.name.toLowerCase())) continue;
		ghApiJson({
			method: 'POST',
			endpoint: 'repos/{owner}/{repo}/labels',
			repo,
			inputObj: { name: l.name, color: l.color, description: l.description }
		});
		process.stdout.write(`Created label: ${l.name}\n`);
	}
}

function searchExistingIssueByMarker({ repo, markerId }) {
	const q = `repo:${repo} type:issue in:body "pj-feedback-id: ${markerId}"`;
	const res = ghApiJson({ method: 'GET', endpoint: 'search/issues', fields: { q, per_page: '5' } });
	if (!res || !Array.isArray(res.items)) return [];
	return res.items;
}

function makeDefaultTitle(message) {
	const cleaned = String(message || '').replace(/\s+/g, ' ').trim();
	if (!cleaned) return 'Feedback';
	const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
	const short = firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;
	return `Feedback: ${short}`;
}

function deriveLabelsFromMessage(message) {
	const m = String(message || '').toLowerCase();
	const labels = new Set();

	// Broad buckets aligned to .github/ISSUE_TEMPLATE/02-ai-fix-request.md
	labels.add('gameplay');
	labels.add('ai-fix');

	if (/platform|line\b|lines\b|detect|detection|photo|image|generation|geometry|merge|snap/.test(m)) {
		labels.add('generation');
	}
	if (/colli|hitbox|clip|stuck|fall\s?through|ghost|wall\b|floor\b/.test(m)) {
		labels.add('collision');
	}
	if (/unfair|impossible|unwinnable|can\'?t\s+jump|not\s+jumpable|precision\s+jump|trust/.test(m)) {
		labels.add('fairness');
	}
	if (/hard|too\s+hard|difficulty|spike|frustrat|punish/.test(m)) {
		labels.add('difficulty');
	}
	if (/debug|overlay|visualize|log\b|instrument/.test(m)) {
		labels.add('debug');
	}

	return Array.from(labels);
}

function makeIssueBodyTemplate({ ts, deviceType, message, markerId, sourceFile, sourceLine, record }) {
	const safeMessage = redactIps(message);
	const safeRecord = sanitizeFeedbackRecordForIssue(record);
	const recordLines = Object.keys(safeRecord).length
		? ['```json', JSON.stringify(safeRecord, null, 2), '```']
		: ['(no additional safe fields found)'];

	return [
		'# 🤖 AI Fix – Photo Jumper',
		'',
		'This issue was created from the in-game local feedback log.',
		'Treat this as a **design brief**, not just a bug report.',
		'',
		'---',
		'',
		'## 🧩 Problem Statement',
		'',
		safeMessage || '(empty)',
		'',
		'---',
		'',
		'## 🎯 Desired Outcome',
		'',
		'- (fill in) What should the player experience change to?',
		'',
		'---',
		'',
		'## 🧠 Constraints (Non-Negotiable)',
		'',
		'- Gameplay quality overrides image accuracy',
		'- Jump physics must remain unchanged unless explicitly stated',
		'- Platforms must be fair, predictable, and solid',
		'- Visuals must match collision geometry exactly',
		'- The game must remain web-based and performant',
		'',
		'---',
		'',
		'## 📐 Gameplay Rules to Respect',
		'',
		'Confirm applicable limits (edit if they differ in code):',
		'',
		'- Max horizontal jump: **120px**',
		'- Max vertical jump height: **90px**',
		'- Player hitbox: **16px × 24px**',
		'- Landing tolerance: **4px** vertical snap',
		'',
		'Platform generation constraints:',
		'',
		'- Min platform width: **40px**',
		'- Min platform thickness: **12px**',
		'- Snap near-horizontal tolerance: **8°**',
		'- Merge collinear tolerance: **6px**',
		'',
		'If detected geometry violates these rules, it **must be adjusted or discarded**.',
		'',
		'---',
		'',
		'## 📷 Photo → Platform Context (if applicable)',
		'',
		'- [ ] Issue caused by shadows / lighting',
		'- [ ] Issue caused by perspective distortion',
		'- [ ] Issue caused by noisy / short line detection',
		'- [ ] Issue caused by platform thickness',
		'- [ ] Issue caused by platform spacing',
		'- [ ] Other (describe below)',
		'',
		'Additional notes about the photo input:',
		'',
		'---',
		'',
		'## 🛠 Technical Expectations',
		'',
		'- Prefer normalization and filtering over new features',
		'- Avoid adding new libraries unless clearly justified',
		'- Expose tunable values instead of hardcoding numbers',
		'- Add optional debug overlays if it improves clarity',
		'- Keep logic readable and learner-friendly',
		'',
		'---',
		'',
		'## 🧪 Acceptance Criteria',
		'',
		'- [ ] The level remains winnable',
		'- [ ] Platforms feel solid and predictable',
		'- [ ] Player deaths are explainable and fair',
		'- [ ] No accidental precision jumps introduced',
		'- [ ] Visuals and collisions are aligned',
		'- [ ] Performance is not degraded',
		'',
		'---',
		'',
		'## 📎 References',
		'',
		`- Feedback received: ${ts}`,
		`- Device: ${String(deviceType || 'unknown')}`,
		`- Source: ${path.basename(sourceFile)}#L${sourceLine}`,
		'',
		'### Safe extracted context',
		...recordLines,
		'',
		'---',
		'',
		'## 🧭 Guiding Principle',
		'',
		'> **If image accuracy and gameplay quality conflict, gameplay quality wins.**',
		'',
		makeMarkerLine(markerId)
	].join('\n');
}

function makeIssueBodyLegacy({ ts, deviceType, message, markerId, sourceFile, sourceLine }) {
	const safeMessage = redactIps(message);
	return [
		`Feedback received: ${ts}`,
		`Device: ${String(deviceType || 'unknown')}`,
		'',
		'Message:',
		safeMessage || '(empty)',
		'',
		makeMarkerLine(markerId),
		`Source: ${path.basename(sourceFile)}#L${sourceLine}`
	].join('\n');
}

function labelsForDevice(deviceType) {
	const device = String(deviceType || 'unknown').toLowerCase();
	const allowed = new Set(['desktop', 'tablet', 'mobile', 'unknown']);
	const normalized = allowed.has(device) ? device : 'unknown';
	return [`device: ${normalized}`];
}

async function chooseJsonlFileInteractive(rl, dirPath) {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => e.name)
		.filter((n) => isJsonlFile(n))
		.sort();

	if (entries.length === 0) {
		throw new Error(`No .jsonl files found in ${dirPath}`);
	}

	process.stdout.write('Choose a feedback log:\n');
	entries.forEach((name, idx) => {
		process.stdout.write(`  ${idx + 1}) ${name}\n`);
	});
	const answer = await promptLine(rl, `Select 1-${entries.length} (default ${entries.length}): `);
	let choice = entries.length;
	if (answer) {
		const n = Number.parseInt(answer, 10);
		if (!Number.isFinite(n) || n < 1 || n > entries.length) {
			throw new Error('Invalid selection.');
		}
		choice = n;
	}
	return path.join(dirPath, entries[choice - 1]);
}

async function confirmRepoInteractive(rl, repo) {
	process.stdout.write(`Target GitHub repo: ${repo}\n`);
	const answer = await promptLine(rl, 'Continue? (y/N): ');
	return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

function makeInitialState() {
	return { version: 1, created: {}, skipped: {} };
}

function recordKey(markerId) {
	return markerId;
}

async function main() {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (e) {
		process.stderr.write(`${e.message || e}\n\n`);
		usage(2);
		return;
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	try {
		const repo = args.repo || detectRepoFromGitRemote(args.remote);
		if (!repo) {
			throw new Error('Could not detect a GitHub repo from git remotes. Use --repo owner/name.');
		}

		const okRepo = await confirmRepoInteractive(rl, repo);
		if (!okRepo) {
			process.stdout.write('Aborted.\n');
			process.exit(1);
		}

		const inputPath = args.pathArg || 'feedback';
		let feedbackFile = inputPath;
		const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
		if (!stat) {
			throw new Error(`Path not found: ${inputPath}`);
		}
		if (stat.isDirectory()) {
			feedbackFile = await chooseJsonlFileInteractive(rl, inputPath);
		}
		if (!isJsonlFile(feedbackFile)) {
			throw new Error('Please provide a .jsonl file or a directory containing .jsonl files.');
		}

		process.stdout.write(`Using feedback file: ${feedbackFile}\n`);

		// State file is relative to cwd unless absolute
		const statePath = path.isAbsolute(args.statePath) ? args.statePath : path.join(process.cwd(), args.statePath);
		const state = loadJsonFile(statePath, makeInitialState());
		if (!state || typeof state !== 'object') throw new Error('Invalid state file JSON.');
		state.version = 1;
		state.created = state.created && typeof state.created === 'object' ? state.created : {};
		state.skipped = state.skipped && typeof state.skipped === 'object' ? state.skipped : {};

		ensureLabelsExist({ repo, dryRun: args.dryRun });

		const parsed = readJsonlFile(feedbackFile);
		const items = parsed
			.filter((x) => x && x.record && !x.parseError)
			.map((x) => {
				const r = x.record;
				return {
					lineNo: x.lineNo,
					sourceFile: feedbackFile,
					ts: String(r.ts || ''),
					deviceType: String(r.deviceType || 'unknown').toLowerCase(),
					message: typeof r.message === 'string' ? r.message : '',
					record: r
				};
			});

		if (items.length === 0) {
			process.stdout.write('No valid feedback records found.\n');
			return;
		}

		// Keep an eye on parse errors but don’t block.
		const parseErrors = parsed.filter((x) => x.parseError);
		if (parseErrors.length > 0) {
			process.stdout.write(`Warning: ${parseErrors.length} line(s) failed to parse as JSON.\n`);
		}

		let idx = 0;
		while (idx >= 0 && idx < items.length) {
			const item = items[idx];
			const markerId = makeMarkerId(item);
			const key = recordKey(markerId);

			const created = state.created[key];
			const skipped = state.skipped[key];

			process.stdout.write('\n');
			process.stdout.write(`Item ${idx + 1}/${items.length}  (line ${item.lineNo})\n`);
			process.stdout.write(`ts: ${item.ts}\n`);
			process.stdout.write(`device: ${item.deviceType}\n`);
			process.stdout.write(`marker: ${markerId}\n`);
			if (created) {
				process.stdout.write(`status: CREATED → ${created.url || '(url unknown)'}\n`);
			} else if (skipped) {
				process.stdout.write('status: SKIPPED\n');
			} else {
				process.stdout.write('status: NEW\n');
			}
			process.stdout.write('\n');
			process.stdout.write(redactIps(item.message) + '\n');
			process.stdout.write('\n');
			const cmd = await promptLine(
				rl,
				'Create issue? (y/N)  [p prev | s skip | j jump | q quit] : '
			);
			const c = (cmd || 'n').toLowerCase();

			if (c === 'q') break;
			if (c === 'p') {
				idx = Math.max(0, idx - 1);
				continue;
			}
			if (c === 'n' || c === '') {
				idx += 1;
				continue;
			}
			if (c === 'y' || c === 'yes' || c === 'c') {
				// fall through to create logic handled below
			}
			if (c === 'j') {
				const to = await promptLine(rl, `Jump to 1-${items.length}: `);
				const n = Number.parseInt(to, 10);
				if (Number.isFinite(n) && n >= 1 && n <= items.length) {
					idx = n - 1;
				} else {
					process.stdout.write('Invalid jump.\n');
				}
				continue;
			}
			if (c === 's') {
				state.skipped[key] = {
					ts: item.ts,
					deviceType: item.deviceType,
					source: { file: path.basename(item.sourceFile), line: item.lineNo },
					updatedAt: new Date().toISOString()
				};
				saveJsonFileAtomic(statePath, state);
				process.stdout.write('Marked as skipped.\n');
				idx += 1;
				continue;
			}
			if (c === 'y' || c === 'yes' || c === 'c') {
				if (created) {
					process.stdout.write('Already created (local state).\n');
					idx += 1;
					continue;
				}

				// GitHub-side dedupe
				let existing = [];
				if (!args.dryRun) {
					try {
						existing = searchExistingIssueByMarker({ repo, markerId });
					} catch (e) {
						process.stdout.write(`Warning: could not search for duplicates (${e.message || e}).\n`);
					}
				}

				if (existing.length > 0) {
					process.stdout.write(`Duplicate detected on GitHub (${existing.length} match(es)).\n`);
					process.stdout.write(`First match: ${existing[0].html_url || existing[0].url || '(url unknown)'}\n`);
					const ans = await promptLine(rl, 'Mark as created locally and move on? (y/N): ');
					if (ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes') {
						state.created[key] = {
							url: existing[0].html_url || existing[0].url || '',
							issueNumber: existing[0].number,
							createdAt: new Date().toISOString(),
							source: { file: path.basename(item.sourceFile), line: item.lineNo },
							title: existing[0].title || ''
						};
						saveJsonFileAtomic(statePath, state);
						idx += 1;
					} else {
						process.stdout.write('Not creating.\n');
					}
					continue;
				}

				const defaultTitle = makeDefaultTitle(item.message);
				const titleInput = await promptLine(rl, `Title (default: ${defaultTitle}): `);
				const title = titleInput ? titleInput : defaultTitle;
				const body = args.useTemplateBody
					? makeIssueBodyTemplate({
							ts: item.ts,
							deviceType: item.deviceType,
							message: item.message,
							markerId,
							sourceFile: item.sourceFile,
							sourceLine: item.lineNo,
							record: item.record
						})
					: makeIssueBodyLegacy({
					ts: item.ts,
					deviceType: item.deviceType,
					message: item.message,
					markerId,
					sourceFile: item.sourceFile,
					sourceLine: item.lineNo
					});

				const derived = deriveLabelsFromMessage(item.message);
				const labels = Array.from(
					new Set(['feedback', 'needs-triage', ...labelsForDevice(item.deviceType), ...derived])
				);

				if (args.dryRun) {
					process.stdout.write('(dry-run) Would create issue with:\n');
					process.stdout.write(`  title: ${title}\n`);
					process.stdout.write(`  labels: ${labels.join(', ')}\n`);
					process.stdout.write(`  marker: ${markerId}\n`);
					state.created[key] = {
						url: '',
						issueNumber: null,
						createdAt: new Date().toISOString(),
						source: { file: path.basename(item.sourceFile), line: item.lineNo },
						title
					};
					saveJsonFileAtomic(statePath, state);
					idx += 1;
					continue;
				}

				const issue = ghApiJson({
					method: 'POST',
					endpoint: 'repos/{owner}/{repo}/issues',
					repo,
					inputObj: { title, body, labels }
				});

				state.created[key] = {
					url: issue && issue.html_url ? issue.html_url : '',
					issueNumber: issue && issue.number ? issue.number : null,
					createdAt: new Date().toISOString(),
					source: { file: path.basename(item.sourceFile), line: item.lineNo },
					title
				};
				saveJsonFileAtomic(statePath, state);
				process.stdout.write(`Created issue: ${state.created[key].url || '(url unknown)'}\n`);
				idx += 1;
				continue;
			}

			process.stdout.write('Unknown command.\n');
		}

		process.stdout.write('Done.\n');
	} finally {
		rl.close();
	}
}

main().catch((e) => {
	process.stderr.write(`${e && e.message ? e.message : e}\n`);
	process.exit(1);
});
