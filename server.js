const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', false);

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const FEEDBACK_TOKEN = process.env.FEEDBACK_TOKEN || '';

const MAX_BODY_BYTES = Number.parseInt(process.env.FEEDBACK_MAX_BODY_BYTES || String(16 * 1024), 10);
const RATE_LIMIT_MAX = Number.parseInt(process.env.FEEDBACK_RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.FEEDBACK_RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10);

app.use(express.json({ limit: MAX_BODY_BYTES }));
app.use((err, req, res, next) => {
	if (err && err.type === 'entity.too.large') {
		return res.status(413).json({ error: 'payload_too_large' });
	}
	if (err instanceof SyntaxError) {
		return res.status(400).json({ error: 'invalid_json' });
	}
	return next(err);
});

app.use(express.static(__dirname, { index: 'index.html' }));

const rateLimitState = new Map();

function normalizeIp(ip) {
	if (!ip) return '';
	if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length);
	return ip;
}

function isPrivateIp(ip) {
	if (!ip) return false;
	if (ip === '127.0.0.1' || ip === '::1') return true;
	if (ip.startsWith('10.')) return true;
	if (ip.startsWith('192.168.')) return true;

	// 172.16.0.0 - 172.31.255.255
	if (ip.startsWith('172.')) {
		const second = Number.parseInt(ip.split('.')[1] || '0', 10);
		if (second >= 16 && second <= 31) return true;
	}

	// IPv6 Unique Local Address (fc00::/7)
	const lower = ip.toLowerCase();
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

	return false;
}

function rateLimitCheck(ip) {
	const now = Date.now();
	const state = rateLimitState.get(ip);
	if (!state || now >= state.resetAt) {
		rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return { ok: true };
	}

	if (state.count >= RATE_LIMIT_MAX) {
		return { ok: false, retryAfterMs: Math.max(0, state.resetAt - now) };
	}

	state.count += 1;
	return { ok: true };
}

function formatLocalDate(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function getLogFilePath(date) {
	return path.join(__dirname, 'feedback', `${formatLocalDate(date)}.jsonl`);
}

app.post('/api/feedback', (req, res) => {
	const rawIp = req.socket.remoteAddress || '';
	const ip = normalizeIp(rawIp);

	if (!isPrivateIp(ip)) {
		return res.status(403).json({ error: 'forbidden' });
	}

	if (FEEDBACK_TOKEN) {
		const token = req.get('X-Feedback-Token') || '';
		if (!token || token !== FEEDBACK_TOKEN) {
			return res.status(401).json({ error: 'token_required' });
		}
	}

	const rate = rateLimitCheck(ip);
	if (!rate.ok) {
		res.set('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000)));
		return res.status(429).json({ error: 'rate_limited', retryAfterMs: rate.retryAfterMs });
	}

	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	const deviceTypeRaw = typeof req.body?.deviceType === 'string' ? req.body.deviceType : 'unknown';
	const deviceType = String(deviceTypeRaw).toLowerCase();

	if (!message) {
		return res.status(400).json({ error: 'message_required' });
	}
	if (message.length > 2000) {
		return res.status(400).json({ error: 'message_too_long' });
	}

	const allowedDeviceTypes = new Set(['desktop', 'tablet', 'mobile', 'unknown']);
	if (!allowedDeviceTypes.has(deviceType)) {
		return res.status(400).json({ error: 'invalid_device_type' });
	}

	const record = {
		ts: new Date().toISOString(),
		deviceType,
		message,
		ua: req.get('User-Agent') || '',
		ip
	};

	const logFile = getLogFilePath(new Date());
	fs.mkdirSync(path.dirname(logFile), { recursive: true });

	fs.appendFile(logFile, `${JSON.stringify(record)}\n`, { encoding: 'utf8' }, (err) => {
		if (err) {
			console.error('Failed to write feedback:', err);
			return res.status(500).json({ error: 'write_failed' });
		}
		return res.json({ ok: true });
	});
});

app.listen(PORT, HOST, () => {
	console.log(`Photo Jumper server running on http://${HOST}:${PORT}`);
	console.log('Open from other devices using: http://<your-lan-ip>:' + PORT);
	if (FEEDBACK_TOKEN) {
		console.log('Feedback token is required (FEEDBACK_TOKEN is set).');
	}
});
