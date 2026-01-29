#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const DEFAULT_TEMPLATE_PATH = path.join('learning', 'journey', 'templates', 'session-note-template.md');
const DEFAULT_NOTES_DIR = path.join('learning', 'journey', 'notes');

function usage(exitCode = 0) {
	const msg = `\
Usage:
  npm run learning:note
  node scripts/new-learning-note.js [--date YYYY-MM-DD] [--topic "short-topic"]

Description:
  Interactive helper to create a new Learning Journey session note from the template.

Options:
  --date <YYYY-MM-DD>   Override note date (default: today)
  --topic <text>        Optional topic slug for filename (e.g. "image-detection")
  --no-input            Create a note with blank sections (no prompts)
  -h, --help            Show help
`;
	process.stdout.write(msg);
	process.exit(exitCode);
}

function parseArgs(argv) {
	const args = {
		date: undefined,
		topic: '',
		noInput: false
	};

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a) continue;
		if (a === '-h' || a === '--help') usage(0);
		if (a === '--no-input') {
			args.noInput = true;
			continue;
		}
		if (a.startsWith('--date=')) {
			args.date = a.slice('--date='.length);
			continue;
		}
		if (a === '--date') {
			args.date = argv[++i];
			continue;
		}
		if (a.startsWith('--topic=')) {
			args.topic = a.slice('--topic='.length);
			continue;
		}
		if (a === '--topic') {
			args.topic = argv[++i] || '';
			continue;
		}
		throw new Error(`Unknown arg: ${a}`);
	}

	return args;
}

function todayYYYYMMDD() {
	const d = new Date();
	const y = String(d.getFullYear());
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function slugifyTopic(topic) {
	const s = String(topic || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return s;
}

function ensureUniquePath(filePath) {
	if (!fs.existsSync(filePath)) return filePath;

	const dir = path.dirname(filePath);
	const ext = path.extname(filePath);
	const base = path.basename(filePath, ext);

	for (let i = 2; i < 1000; i++) {
		const candidate = path.join(dir, `${base}-${i}${ext}`);
		if (!fs.existsSync(candidate)) return candidate;
	}
	throw new Error('Could not find a unique filename after 999 attempts.');
}

async function promptLine(rl, question, { defaultValue = '' } = {}) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			const a = String(answer || '').trim();
			resolve(a ? a : defaultValue);
		});
	});
}

async function promptList(rl, title) {
	process.stdout.write(`\n${title}\n`);
	process.stdout.write('Enter one item per line. Submit an empty line to finish.\n');
	const items = [];
	while (true) {
		const line = await promptLine(rl, '> ');
		if (!line) break;
		items.push(line);
	}
	return items;
}

function formatBullets(items) {
	if (!items || items.length === 0) return '- ';
	return items.map((x) => `- ${x}`).join('\n');
}

function formatCheckboxes(items) {
	if (!items || items.length === 0) return '- [ ] ';
	return items.map((x) => `- [ ] ${x}`).join('\n');
}

function loadTemplate() {
	try {
		return fs.readFileSync(DEFAULT_TEMPLATE_PATH, 'utf8');
	} catch (e) {
		throw new Error(`Could not read template at ${DEFAULT_TEMPLATE_PATH}: ${e && e.message ? e.message : e}`);
	}
}

function fillTemplate({ template, date, learner, coach, goals, discussed, decided, built, takeaways, questions, nextSteps }) {
	let out = String(template);
	out = out.replace('YYYY-MM-DD', date);

	// Very light templating: replace the first placeholder line after each heading.
	out = out.replace(
		/## People\n- Learner:\s*\n- Coach:\s*\n\n/m,
		`## People\n- Learner: ${learner || ''}\n- Coach: ${coach || ''}\n\n`
	);
	out = out.replace(/## Goals for this session\n-\s*\n\n/m, `## Goals for this session\n${formatBullets(goals)}\n\n`);
	out = out.replace(/## What we discussed\n-\s*\n\n/m, `## What we discussed\n${formatBullets(discussed)}\n\n`);
	out = out.replace(/## What we decided\n-\s*\n\n/m, `## What we decided\n${formatBullets(decided)}\n\n`);
	out = out.replace(/## What we built \/ changed\n-\s*\n\n/m, `## What we built / changed\n${formatBullets(built)}\n\n`);
	out = out.replace(/## Key takeaways\n-\s*\n\n/m, `## Key takeaways\n${formatBullets(takeaways)}\n\n`);
	out = out.replace(/## Open questions\n-\s*\n\n/m, `## Open questions\n${formatBullets(questions)}\n\n`);
	out = out.replace(/## Next steps \(concrete\)\n- \[ \] \s*\n/m, `## Next steps (concrete)\n${formatCheckboxes(nextSteps)}\n`);

	if (!out.endsWith('\n')) out += '\n';
	return out;
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
		const date = args.date || todayYYYYMMDD();
		let topic = args.topic || '';
		if (!args.noInput && !topic) {
			topic = await promptLine(rl, 'Optional topic (leave blank for none): ');
		}

		let learner = '';
		let coach = '';
		let goals = [];
		let discussed = [];
		let decided = [];
		let built = [];
		let takeaways = [];
		let questions = [];
		let nextSteps = [];

		if (!args.noInput) {
			learner = await promptLine(rl, 'Learner name (optional): ');
			coach = await promptLine(rl, 'Coach name (optional): ');

			goals = await promptList(rl, '## Goals for this session');
			discussed = await promptList(rl, '## What we discussed');
			decided = await promptList(rl, '## What we decided');
			built = await promptList(rl, '## What we built / changed');
			takeaways = await promptList(rl, '## Key takeaways');
			questions = await promptList(rl, '## Open questions');
			nextSteps = await promptList(rl, '## Next steps (concrete)');
		}

		const template = loadTemplate();
		const content = fillTemplate({
			template,
			date,
			learner,
			coach,
			goals,
			discussed,
			decided,
			built,
			takeaways,
			questions,
			nextSteps
		});

		const topicSlug = slugifyTopic(topic);
		const filename = topicSlug ? `${date}-${topicSlug}.md` : `${date}.md`;
		const outDir = DEFAULT_NOTES_DIR;
		fs.mkdirSync(outDir, { recursive: true });
		const target = ensureUniquePath(path.join(outDir, filename));
		fs.writeFileSync(target, content, 'utf8');

		process.stdout.write(`\nCreated note: ${target}\n`);
		process.stdout.write('Next: open it in your editor and tweak as needed.\n');
		process.stdout.write(`Tip: \`code ${target}\`\n`);
	} finally {
		rl.close();
	}
}

main().catch((e) => {
	process.stderr.write(`${e && e.message ? e.message : e}\n`);
	process.exit(1);
});
