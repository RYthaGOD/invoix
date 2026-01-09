import 'dotenv/config';
import dns from 'dns';
import net from 'net';
import { logger } from './logger';
import { URL } from 'url';

async function check() {
    logger.debug("Starting network diagnostics", "network");
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ DATABASE_URL is missing!");
        return;
    }

    console.log(`original URL (masked): ${dbUrl.replace(/:[^:@]*@/, ':****@')}`);

    let hostname, port;
    try {
        const u = new URL(dbUrl);
        hostname = u.hostname;
        port = u.port || '5432';
        console.log(`Parsed: Host=${hostname}, Port=${port}`);
    } catch (e: any) {
        console.error("❌ URL Parsing Failed:", e.message);
        // Try manual regex extraction if URL class fails
        const match = dbUrl.match(/@([^:/]+)(?::(\d+))?/);
        if (match) {
            hostname = match[1];
            port = match[2] || '5432';
            console.log(`Regex Parsed: Host=${hostname}, Port=${port}`);
        } else {
            return;
        }
    }

    logger.debug("DNS Resolution Test", "network");
    try {
        const ipv4 = await dns.promises.resolve4(hostname).catch(e => `Failed: ${e.message}`);
        console.log(`IPv4:`, ipv4);
    } catch (e) { console.log('IPv4 Error:', e); }

    try {
        const ipv6 = await dns.promises.resolve6(hostname).catch(e => `Failed: ${e.message}`);
        console.log(`IPv6:`, ipv6);
    } catch (e) { console.log('IPv6 Error:', e); }

    logger.debug("TCP Connectivity Test", "network");
    const tryConnect = (host: string, family: string) => {
        return new Promise(resolve => {
            console.log(`Attempting ${family} Connect to ${host}:${port}...`);
            const start = Date.now();
            const socket = net.createConnection({ host, port: parseInt(port), timeout: 5000 }, () => {
                console.log(`✅ Connected to ${host} (${family}) in ${Date.now() - start}ms`);
                socket.end();
                resolve(true);
            });
            socket.on('error', (err) => {
                console.log(`❌ Connection failed to ${host} (${family}): ${err.message}`);
                resolve(false);
            });
            socket.on('timeout', () => {
                console.log(`❌ Timeout connecting to ${host} (${family})`);
                socket.destroy();
                resolve(false);
            });
        });
    }

    // Resolve IP manually first to force test
    let targetIp;
    try {
        const ips = await dns.promises.resolve4(hostname);
        targetIp = ips[0];
        console.log(`Targeting resolved IPv4: ${targetIp}`);
        await tryConnect(targetIp, 'IPv4');
    } catch (e) {
        console.log("Skipping IPv4 connect test due to DNS failure");
    }


}

check();
