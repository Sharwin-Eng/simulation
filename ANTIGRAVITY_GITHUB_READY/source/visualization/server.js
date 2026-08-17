/**
 * ANTIGRAVITY — Web Server
 * 
 * Zero-dependency Node.js HTTP server that serves the Web Application dashboard
 * and provides REST API endpoints for running simulations, comparing control strategies,
 * and compiling DSL scripts.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { Compiler } from '../compiler/index.js';
import { ComparisonEngine } from '../analytics/index.js';
import { SimulationEngine } from '../simulation/engine.js';
import { SensorAggregator } from '../simulation/sensors/aggregator.js';
import { AdaptiveController } from '../control/adaptive-controller.js';
import { FixedTimerController } from '../control/fixed-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// Helper: send JSON response
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

// Helper: parse POST JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // API Endpoints
    if (pathname === '/api/compile' && req.method === 'POST') {
      const { source } = await parseBody(req);
      if (!source) {
        return sendJSON(res, { error: 'Source code is required' }, 400);
      }
      const compilationResult = Compiler.compile(source);
      return sendJSON(res, compilationResult);
    }

    if (pathname === '/api/compare' && req.method === 'POST') {
      const { config, duration } = await parseBody(req);
      const scenarioConfig = config || {
        simulation: { tickInterval: 0.1, simulationDuration: duration || 300 },
        arrival: { north: 25, south: 25, east: 25, west: 25 },
        signal: { minGreenTime: 10, maxGreenTime: 60, yellowTime: 3, allRedTime: 2, fixedGreenTime: 30 },
      };

      const ticks = Math.floor((scenarioConfig.simulation?.simulationDuration || 300) / (scenarioConfig.simulation?.tickInterval || 0.1));
      const comparisonReport = ComparisonEngine.compare(scenarioConfig, ticks);
      return sendJSON(res, comparisonReport);
    }

    if (pathname === '/api/scenarios' && req.method === 'GET') {
      const scenariosDir = path.join(__dirname, '../../examples');
      let files = [];
      try {
        files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.json'));
      } catch (e) {
        files = [];
      }
      const scenarios = files.map(file => {
        const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
        return { name: file.replace('.json', ''), data: JSON.parse(content) };
      });
      return sendJSON(res, scenarios);
    }

    // Static File Server & ES Module Router
    const SOURCE_ROOT = path.join(__dirname, '..');
    let filePath;

    if (pathname.startsWith('/simulation/') ||
        pathname.startsWith('/control/') ||
        pathname.startsWith('/compiler/') ||
        pathname.startsWith('/analytics/')) {
      filePath = path.join(SOURCE_ROOT, pathname);
    } else if (pathname.startsWith('/source/')) {
      filePath = path.join(SOURCE_ROOT, pathname.replace('/source/', '/'));
    } else {
      filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    }

    // Safety check against directory traversal outside project source
    if (!filePath.startsWith(SOURCE_ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'text/javascript; charset=UTF-8';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJSON(res, { error: err.message }, 500);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n=================================================`);
    console.log(`  ANTIGRAVITY Server is ALREADY RUNNING!           `);
    console.log(`  Access the web dashboard at: http://localhost:${PORT}`);
    console.log(`=================================================\n`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log(`=================================================`);
  console.log(`  ANTIGRAVITY Traffic Control Simulation Server  `);
  console.log(`  Host PC:   http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`  LAN Devices (Same Wi-Fi):`);
    ips.forEach(ip => console.log(`    👉 http://${ip}:${PORT}`));
  }
  console.log(`=================================================`);
});
