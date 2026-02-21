/**
 * Prosty webhook listener dla GitHub push events.
 * Uruchamia deploy.sh po otrzymaniu push do main/master.
 * 
 * Uruchomienie: pm2 start webhook-server.js --name github-webhook
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'CHANGE_ME_TO_RANDOM_SECRET';
const DEPLOY_SCRIPT = '/var/www/hotel/deploy.sh';
const LOG_FILE = '/var/www/hotel/deploy.log';

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    console.log(line.trim());
    fs.appendFileSync(LOG_FILE, line);
}

function verifySignature(payload, signature) {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function runDeploy() {
    log('Starting deploy...');
    exec(`bash ${DEPLOY_SCRIPT}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            log(`Deploy ERROR: ${error.message}`);
            log(`stderr: ${stderr}`);
        } else {
            log(`Deploy SUCCESS`);
        }
        if (stdout) log(`stdout: ${stdout.slice(-2000)}`);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const signature = req.headers['x-hub-signature-256'];
            
            if (!verifySignature(body, signature)) {
                log('Invalid signature - rejecting request');
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }

            try {
                const payload = JSON.parse(body);
                const ref = payload.ref || '';
                const branch = ref.replace('refs/heads/', '');
                
                if (branch === 'master' || branch === 'main') {
                    log(`Push to ${branch} detected - triggering deploy`);
                    res.writeHead(200);
                    res.end('Deploy triggered');
                    runDeploy();
                } else {
                    log(`Push to ${branch} - ignoring (not master/main)`);
                    res.writeHead(200);
                    res.end('Ignored - not main branch');
                }
            } catch (e) {
                log(`Parse error: ${e.message}`);
                res.writeHead(400);
                res.end('Bad request');
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    log(`Webhook server listening on 127.0.0.1:${PORT}`);
});
