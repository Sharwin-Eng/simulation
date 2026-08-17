/**
 * ANTIGRAVITY — Interactive Visualization & Studio Application
 * 
 * Features:
 * - HTML5 Canvas 2D interactive traffic rendering with vector graphics
 * - Real-time telemetry dashboard & metrics updates
 * - Traffic DSL live editor & compiler inspector (Lexer, Parser, Semantic, IR, Execution)
 * - Benchmark Comparative Analysis runner (Adaptive vs Fixed-Timer)
 */

import { SimulationEngine } from '../../simulation/engine.js';
import { SensorAggregator } from '../../simulation/sensors/aggregator.js';
import { AdaptiveController } from '../../control/adaptive-controller.js';
import { FixedTimerController } from '../../control/fixed-controller.js';
import { Compiler } from '../../compiler/compiler.js';
import { Direction, VehicleType, SignalState } from '../../simulation/constants.js';

// ─── Application State ────────────────────────────────────

let engine = null;
let sensors = null;
let controller = null;
let animationFrameId = null;
let isPlaying = false;
let speedMultiplier = 5;
let controllerMode = 'adaptive';
let currentScenario = 'normal';

// Canvas rendering context
let canvas = null;
let ctx = null;

// Preset Scenarios
const PRESETS = {
  normal: {
    simulation: { tickInterval: 0.1, simulationDuration: 300 },
    arrival: { north: 20, south: 20, east: 20, west: 20 },
    signal: { minGreenTime: 10, maxGreenTime: 60, yellowTime: 3, allRedTime: 2, fixedGreenTime: 30 },
  },
  rush_hour: {
    simulation: { tickInterval: 0.1, simulationDuration: 300 },
    arrival: { north: 45, south: 45, east: 12, west: 12 },
    signal: { minGreenTime: 10, maxGreenTime: 60, yellowTime: 3, allRedTime: 2, fixedGreenTime: 30 },
  },
  emergency: {
    simulation: { tickInterval: 0.1, simulationDuration: 300 },
    arrival: { north: 25, south: 25, east: 25, west: 25 },
    signal: { minGreenTime: 10, maxGreenTime: 60, yellowTime: 3, allRedTime: 2, fixedGreenTime: 30 },
  },
};

// Global Scope Window Exports (Immediate module evaluation binding)
window.switchTab = switchTab;
window.switchInspectorTab = switchInspectorTab;
window.togglePlayPause = togglePlayPause;
window.stepSimulation = stepSimulation;
window.resetSimulation = resetSimulation;
window.changeSpeed = changeSpeed;
window.changeControllerMode = changeControllerMode;
window.loadPresetScenario = loadPresetScenario;
window.compileDSL = compileDSL;
window.loadSampleDSL = loadSampleDSL;
window.runComparisonBenchmark = runComparisonBenchmark;

// ─── Initialization ───────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('trafficCanvas');
  ctx = canvas.getContext('2d');

  // Canvas roundRect Polyfill
  if (!ctx.roundRect) {
    ctx.roundRect = function(x, y, w, h, r = 0) {
      if (typeof r === 'number') r = [r, r, r, r];
      ctx.beginPath();
      ctx.moveTo(x + r[0], y);
      ctx.lineTo(x + w - r[1], y);
      ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
      ctx.lineTo(x + w, y + h - r[2]);
      ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
      ctx.lineTo(x + r[3], y + h);
      ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
      ctx.lineTo(x, y + r[0]);
      ctx.arcTo(x, y, x + r[0], y, r[0]);
      ctx.closePath();
    };
  }

  // Bind explicit event listeners to DOM elements
  document.getElementById('tab-btn-simulation')?.addEventListener('click', () => switchTab('simulation'));
  document.getElementById('tab-btn-dsl')?.addEventListener('click', () => switchTab('dsl'));
  document.getElementById('tab-btn-compare')?.addEventListener('click', () => switchTab('compare'));
  
  document.getElementById('btn-play')?.addEventListener('click', togglePlayPause);
  document.getElementById('btn-step')?.addEventListener('click', stepSimulation);
  document.getElementById('btn-reset')?.addEventListener('click', resetSimulation);
  document.getElementById('btn-compile')?.addEventListener('click', compileDSL);
  document.getElementById('btn-run-compare')?.addEventListener('click', runComparisonBenchmark);

  document.getElementById('speed-select')?.addEventListener('change', (e) => changeSpeed(e.target.value));
  document.getElementById('mode-select')?.addEventListener('change', (e) => changeControllerMode(e.target.value));
  document.getElementById('scenario-select')?.addEventListener('change', (e) => loadPresetScenario(e.target.value));

  // Initialize Simulation Engine
  initSimulation(PRESETS.normal);

  // Initial draw
  drawIntersection();
});

function initSimulation(config) {
  engine = new SimulationEngine(config);
  sensors = new SensorAggregator(engine.intersection, engine.spawner);

  if (controllerMode === 'adaptive') {
    controller = new AdaptiveController(engine.intersection, config.signal);
  } else {
    controller = new FixedTimerController(engine.intersection, config.signal);
  }

  updateDashboardUI();
}

// ─── Simulation Loop ──────────────────────────────────────

let lastAnimTime = 0;
function animLoop(timestamp) {
  if (!isPlaying) return;

  if (!lastAnimTime) lastAnimTime = timestamp;
  const elapsedMs = timestamp - lastAnimTime;

  // Run ticks according to speed multiplier
  const intervalMs = (100 / speedMultiplier);
  if (elapsedMs >= intervalMs) {
    const ticksToRun = Math.floor(elapsedMs / intervalMs);
    for (let i = 0; i < Math.min(ticksToRun, 5); i++) {
      runSingleTick();
    }
    lastAnimTime = timestamp;
  }

  drawIntersection();
  updateDashboardUI();

  animationFrameId = requestAnimationFrame(animLoop);
}

function runSingleTick() {
  engine.tick();
  sensors.update(engine.currentTime);
  const snap = sensors.snapshot(engine.currentTime);
  controller.update(engine.clock.tickInterval, snap);
}

// ─── Playback Controls ────────────────────────────────────

function togglePlayPause() {
  isPlaying = !isPlaying;
  const text = document.getElementById('play-text');
  const btn = document.getElementById('btn-play');
  const svgIcon = document.getElementById('play-svg-icon');

  if (isPlaying) {
    text.textContent = 'Pause';
    svgIcon.innerHTML = `<use href="#icon-pause"></use>`;
    btn.classList.replace('primary', 'secondary');
    lastAnimTime = 0;
    animationFrameId = requestAnimationFrame(animLoop);
  } else {
    text.textContent = 'Play';
    svgIcon.innerHTML = `<use href="#icon-play"></use>`;
    btn.classList.replace('secondary', 'primary');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  }
}

function stepSimulation() {
  if (isPlaying) togglePlayPause();
  runSingleTick();
  drawIntersection();
  updateDashboardUI();
}

function resetSimulation() {
  if (isPlaying) togglePlayPause();
  initSimulation(PRESETS[currentScenario] || PRESETS.normal);
  drawIntersection();
  updateDashboardUI();
}

function changeSpeed(val) {
  speedMultiplier = parseFloat(val);
}

function changeControllerMode(mode) {
  controllerMode = mode;
  const badge = document.getElementById('controller-badge');
  if (mode === 'adaptive') {
    badge.textContent = 'Mode: Adaptive Controller';
    badge.className = 'badge badge-adaptive';
  } else {
    badge.textContent = 'Mode: Fixed-Timer Controller';
    badge.className = 'badge badge-fixed';
  }
  resetSimulation();
}

function loadPresetScenario(presetKey) {
  currentScenario = presetKey;
  const cfg = PRESETS[presetKey] || PRESETS.normal;

  if (presetKey === 'emergency') {
    resetSimulation();
    // Spawn an emergency vehicle in the East direction
    engine.spawner.spawnVehicle(engine.intersection, Direction.EAST, VehicleType.EMERGENCY, 40);
    drawIntersection();
    updateDashboardUI();
    return;
  }

  resetSimulation();
}

// ─── UI Telemetry Updates ─────────────────────────────────

function updateDashboardUI() {
  document.getElementById('sim-clock-display').textContent = engine.clock.formattedTime;

  const activeCount = engine.activeVehicles.length;
  const departedCount = engine.departedVehicles.length;
  const snap = sensors.snapshot(engine.currentTime);

  document.getElementById('val-active-vehicles').textContent = activeCount;
  document.getElementById('val-departed-vehicles').textContent = departedCount;

  let totalWaitSum = 0;
  let totalQueued = 0;
  for (const dir of ['north', 'south', 'east', 'west']) {
    totalWaitSum += snap[dir].avgWaitTime * snap[dir].queueLength;
    totalQueued += snap[dir].queueLength;
    
    document.getElementById(`q-${dir}`).textContent = snap[dir].queueLength;
    document.getElementById(`arr-${dir}`).textContent = `${snap[dir].arrivalRate} vpm`;
    document.getElementById(`wait-${dir}`).textContent = `${snap[dir].avgWaitTime}s`;

    const sigState = engine.intersection.getSignal(dir).state;
    const sigTag = document.getElementById(`sig-${dir}`);
    sigTag.textContent = sigState.toUpperCase();
    sigTag.className = `signal-tag ${sigState}`;
  }

  const overallAvgWait = totalQueued > 0 ? (totalWaitSum / totalQueued).toFixed(1) : '0.0';
  document.getElementById('val-avg-wait').textContent = `${overallAvgWait}s`;

  const totalCapacity = 40;
  const congestion = Math.min(100, (totalQueued / totalCapacity) * 100).toFixed(1);
  document.getElementById('val-congestion').textContent = `${congestion}%`;

  const ctrlJSON = controller.toJSON();
  document.getElementById('val-current-phase').textContent = ctrlJSON.currentPhase.toUpperCase();
  document.getElementById('val-phase-state').textContent = ctrlJSON.phaseState.toUpperCase();

  const gTimes = controller.getGreenTimes();
  document.getElementById('val-green-ns').textContent = `${gTimes.phaseNS}s`;
  document.getElementById('val-green-ew').textContent = `${gTimes.phaseEW}s`;
}

// ─── HTML5 Canvas Renderer ────────────────────────────────

function drawIntersection() {
  const width = canvas.width;
  const height = canvas.height;
  const center = width / 2;
  const roadWidth = 110;
  const halfRoad = roadWidth / 2;

  // Background
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, width, height);

  // Surroundings (Surrounding Grounds)
  ctx.fillStyle = '#121824';
  ctx.fillRect(0, 0, center - halfRoad, center - halfRoad);
  ctx.fillRect(center + halfRoad, 0, center - halfRoad, center - halfRoad);
  ctx.fillRect(0, center + halfRoad, center - halfRoad, center - halfRoad);
  ctx.fillRect(center + halfRoad, center + halfRoad, center - halfRoad, center - halfRoad);

  // Asphalt Roads
  ctx.fillStyle = '#1c212c';
  ctx.fillRect(center - halfRoad, 0, roadWidth, height);
  ctx.fillRect(0, center - halfRoad, width, roadWidth);

  // Sidewalk Curbs (Thick Line Borders)
  ctx.strokeStyle = '#2d3548';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, center - halfRoad, center - halfRoad);
  ctx.strokeRect(center + halfRoad, 0, center - halfRoad, center - halfRoad);
  ctx.strokeRect(0, center + halfRoad, center - halfRoad, center - halfRoad);
  ctx.strokeRect(center + halfRoad, center + halfRoad, center - halfRoad, center - halfRoad);

  // Lane Markings (Dashed Yellow Centerlines)
  ctx.strokeStyle = '#e3b341';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 12]);

  // Centerlines
  ctx.beginPath();
  ctx.moveTo(center, 0); ctx.lineTo(center, center - halfRoad - 25);
  ctx.moveTo(center, center + halfRoad + 25); ctx.lineTo(center, height);
  ctx.moveTo(0, center); ctx.lineTo(center - halfRoad - 25, center);
  ctx.moveTo(center + halfRoad + 25, center); ctx.lineTo(width, center);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosswalk Zebra Stripes
  drawCrosswalk(center - halfRoad, center - halfRoad - 22, roadWidth, 20, true);
  drawCrosswalk(center - halfRoad, center + halfRoad + 2, roadWidth, 20, true);
  drawCrosswalk(center - halfRoad - 22, center - halfRoad, 20, roadWidth, false);
  drawCrosswalk(center + halfRoad + 2, center - halfRoad, 20, roadWidth, false);

  // Stop Lines (Solid Thick White Lines)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  
  // North Stop Line
  ctx.beginPath(); ctx.moveTo(center - halfRoad, center - halfRoad - 24); ctx.lineTo(center, center - halfRoad - 24); ctx.stroke();
  // South Stop Line
  ctx.beginPath(); ctx.moveTo(center, center + halfRoad + 24); ctx.lineTo(center + halfRoad, center + halfRoad + 24); ctx.stroke();
  // East Stop Line
  ctx.beginPath(); ctx.moveTo(center + halfRoad + 24, center - halfRoad); ctx.lineTo(center + halfRoad + 24, center); ctx.stroke();
  // West Stop Line
  ctx.beginPath(); ctx.moveTo(center - halfRoad - 24, center); ctx.lineTo(center - halfRoad - 24, center + halfRoad); ctx.stroke();

  // Approach Labels & Arrows
  drawApproachLabels(center, halfRoad);

  // 3-Aspect Traffic Signal Posts
  drawSignalPost(center - halfRoad - 24, center - halfRoad - 35, engine.intersection.getSignal(Direction.NORTH).state, 'south');
  drawSignalPost(center + halfRoad + 24, center + halfRoad + 35, engine.intersection.getSignal(Direction.SOUTH).state, 'north');
  drawSignalPost(center + halfRoad + 35, center - halfRoad - 24, engine.intersection.getSignal(Direction.EAST).state, 'west');
  drawSignalPost(center - halfRoad - 35, center + halfRoad + 24, engine.intersection.getSignal(Direction.WEST).state, 'east');

  // Vehicles
  const roadLength = 300;
  const scale = (center - halfRoad - 24) / roadLength;

  const snap = sensors.snapshot(engine.currentTime);

  for (const v of engine.activeVehicles) {
    drawVehicle(v, center, halfRoad, scale);
  }

  // Draw Queue Length Pill Badges on Canvas
  drawQueueBadge(center - halfRoad / 2, center - halfRoad - 45, snap.north.queueLength, 'North');
  drawQueueBadge(center + halfRoad / 2, center + halfRoad + 45, snap.south.queueLength, 'South');
  drawQueueBadge(center + halfRoad + 45, center - halfRoad / 2, snap.east.queueLength, 'East');
  drawQueueBadge(center - halfRoad - 45, center + halfRoad / 2, snap.west.queueLength, 'West');
}

function drawCrosswalk(x, y, w, h, isHorizontal) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  const numStripes = 6;
  if (isHorizontal) {
    const stripeWidth = w / numStripes;
    for (let i = 0; i < numStripes; i += 2) {
      ctx.fillRect(x + i * stripeWidth + 2, y, stripeWidth - 2, h);
    }
  } else {
    const stripeHeight = h / numStripes;
    for (let i = 0; i < numStripes; i += 2) {
      ctx.fillRect(x, y + i * stripeHeight + 2, w, stripeHeight - 2);
    }
  }
}

function drawApproachLabels(center, halfRoad) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'center';

  ctx.fillText('SOUTHBOUND ↓', center - halfRoad / 2, 40);
  ctx.fillText('NORTHBOUND ↑', center + halfRoad / 2, center * 2 - 30);
  ctx.fillText('WESTBOUND ←', center * 2 - 50, center - halfRoad / 2 - 10);
  ctx.fillText('EASTBOUND →', 50, center + halfRoad / 2 + 15);
}

function drawSignalPost(x, y, state, facingDir) {
  ctx.save();
  ctx.translate(x, y);

  // Box background
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 40, 4);
  ctx.fill();
  ctx.stroke();

  // 3 Bulbs (Red top, Yellow middle, Green bottom)
  const bulbs = [
    { color: '#f85149', glow: 'rgba(248, 81, 73, 0.8)', isLit: state === SignalState.RED, y: -12 },
    { color: '#d29922', glow: 'rgba(210, 153, 34, 0.8)', isLit: state === SignalState.YELLOW, y: 0 },
    { color: '#3fb950', glow: 'rgba(63, 185, 80, 0.8)', isLit: state === SignalState.GREEN, y: 12 },
  ];

  for (const b of bulbs) {
    ctx.beginPath();
    ctx.arc(0, b.y, 4.5, 0, Math.PI * 2);
    if (b.isLit) {
      ctx.shadowColor = b.glow;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c212c';
    }
    ctx.fill();
  }

  ctx.restore();
}

function drawQueueBadge(x, y, queueCount, label) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.fillStyle = queueCount > 0 ? 'rgba(248, 81, 73, 0.85)' : 'rgba(28, 33, 44, 0.85)';
  ctx.strokeStyle = queueCount > 0 ? '#f85149' : '#30363d';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.roundRect(-30, -10, 60, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Q: ${queueCount}`, 0, 0);

  ctx.restore();
}

function drawVehicle(v, center, halfRoad, scale) {
  const vLen = Math.max(16, v.length * scale * 2.8);
  const vWidth = 14;
  let vx = 0, vy = 0, angle = 0;

  const stopPosPixels = center - halfRoad - 24;

  switch (v.direction) {
    case Direction.NORTH:
      vx = center - halfRoad / 2;
      vy = v.position * scale;
      angle = Math.PI / 2;
      break;

    case Direction.SOUTH:
      vx = center + halfRoad / 2;
      vy = center * 2 - (v.position * scale);
      angle = -Math.PI / 2;
      break;

    case Direction.EAST:
      vx = center * 2 - (v.position * scale);
      vy = center - halfRoad / 2;
      angle = Math.PI;
      break;

    case Direction.WEST:
      vx = v.position * scale;
      vy = center + halfRoad / 2;
      angle = 0;
      break;
  }

  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(angle);

  const isEmergency = v.type === VehicleType.EMERGENCY;

  // Vehicle Body Fill
  if (isEmergency) {
    ctx.fillStyle = '#f85149'; // Emergency Red Chassis
    ctx.shadowColor = 'rgba(248, 81, 73, 0.9)';
    ctx.shadowBlur = 14;
  } else {
    const colors = { north: '#58a6ff', south: '#39d353', east: '#f0883e', west: '#bc8cff' };
    ctx.fillStyle = colors[v.direction] || '#58a6ff';
    ctx.shadowBlur = 0;
  }

  // Draw Vehicle Chassis
  ctx.beginPath();
  ctx.roundRect(-vLen / 2, -vWidth / 2, vLen, vWidth, 3);
  ctx.fill();

  // Roof / Cabin Box
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-vLen / 6, -vWidth / 2 + 2, vLen / 3, vWidth - 4);

  // Windshield (Front)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(vLen / 6, -vWidth / 2 + 3, 2, vWidth - 6);

  // Headlights (Front Glowing White)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(vLen / 2 - 2, -vWidth / 2 + 2, 2, 3);
  ctx.fillRect(vLen / 2 - 2, vWidth / 2 - 5, 2, 3);

  // Tail Lights (Rear Red)
  ctx.fillStyle = '#ff7b72';
  ctx.fillRect(-vLen / 2, -vWidth / 2 + 2, 2, 3);
  ctx.fillRect(-vLen / 2, vWidth / 2 - 5, 2, 3);

  // Emergency Siren Lights (Blinking Blue/Red)
  if (isEmergency) {
    const timeNow = Date.now();
    const flashBlue = Math.floor(timeNow / 150) % 2 === 0;

    ctx.fillStyle = flashBlue ? '#58a6ff' : '#f85149';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Tab Switching ────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabId}`);
  const sec = document.getElementById(`view-${tabId}`);
  if (btn) btn.classList.add('active');
  if (sec) sec.classList.add('active');
}

function switchInspectorTab(subTabId) {
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));

  const btn = document.getElementById(`insp-tab-${subTabId}`);
  const cnt = document.getElementById(`insp-content-${subTabId}`);
  if (btn) btn.classList.add('active');
  if (cnt) cnt.classList.add('active');
}

// ─── DSL Studio & Compiler Inspector ─────────────────────

function compileDSL() {
  const code = document.getElementById('dsl-code-input').value;
  // Pass current simulation context (engine, sensors) so DSL scripts update live simulation
  const result = Compiler.compile(code, { engine, sensors });

  // 1. Lexer Tokens
  const tokensElem = document.getElementById('output-tokens');
  tokensElem.textContent = result.stages.lexer.tokens
    .map(t => t.toString())
    .join('\n');

  // 2. AST Tree
  const astElem = document.getElementById('output-ast');
  astElem.textContent = JSON.stringify(result.stages.parser.ast, null, 2);

  // 3. Semantic Analysis
  const semElem = document.getElementById('output-semantic');
  if (result.stages.semantic.errors.length === 0) {
    semElem.innerHTML = `
      <div class="alert alert-success">
        <strong>✓ Semantic Validation Passed</strong>
        <p>Found ${result.stages.semantic.symbols.scenarios.size} scenario(s), ${result.stages.semantic.symbols.intersections.size} intersection(s).</p>
      </div>
    `;
  } else {
    semElem.innerHTML = `
      <div class="alert alert-error">
        <strong>✖ Semantic Errors:</strong>
        <ul>
          ${result.stages.semantic.errors.map(e => `<li>Line ${e.line}:${e.column} — ${e.message}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // 4. IR & Optimizer
  const rawIRElem = document.getElementById('output-ir-raw');
  const optIRElem = document.getElementById('output-ir-opt');

  rawIRElem.textContent = result.stages.irGenerator.instructions
    .map((instr, idx) => `${idx.toString().padStart(3, ' ')}: ${instr.toString()}`)
    .join('\n');

  optIRElem.textContent = result.stages.optimizer.instructions
    .map((instr, idx) => `${idx.toString().padStart(3, ' ')}: ${instr.toString()}`)
    .join('\n') + `\n\n// Optimizations:\n` + result.stages.optimizer.optimizations.join('\n');

  // 5. IR Execution
  const execElem = document.getElementById('output-exec');
  execElem.textContent = JSON.stringify(result.stages.executor, null, 2);

  drawIntersection();
  updateDashboardUI();
  switchInspectorTab('tokens');
}

function loadSampleDSL(type) {
  if (type === 'emergency') {
    document.getElementById('dsl-code-input').value = `// Emergency Priority DSL Script
scenario EmergencyPriority {
  config speed = 1
  config duration = 300s

  spawn vehicle at north rate 25vpm
  spawn vehicle at east  rate 40vpm

  when emergency at north {
    print "EMERGENCY: Priority Green forced for North"
    set signal north to green
  }
}`;
  } else {
    document.getElementById('dsl-code-input').value = `// Adaptive Rush Hour Script
scenario AdaptiveRushHour {
  config speed = 1
  config duration = 300s

  spawn vehicle at north rate 45vpm
  spawn vehicle at south rate 45vpm
  spawn vehicle at east  rate 15vpm
  spawn vehicle at west  rate 15vpm

  when queue north > 15 and wait north > 25s {
    extend green north by 15s
  }
}`;
  }
}

// ─── Comparative Benchmark ────────────────────────────────

async function runComparisonBenchmark() {
  const loading = document.getElementById('compare-loading');
  const results = document.getElementById('compare-results');

  loading.classList.remove('hidden');
  results.classList.add('hidden');

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: 300 }),
    });
    const data = await res.json();

    // Populate improvement cards
    document.getElementById('imp-wait-val').textContent = `-${data.improvement.avgWaitTimeReduction}%`;
    document.getElementById('imp-throughput-val').textContent = `+${data.improvement.throughputIncrease}%`;
    document.getElementById('imp-congestion-val').textContent = `-${data.improvement.congestionReduction}%`;

    // Populate comparison table
    const f = data.fixed;
    const a = data.adaptive;

    document.getElementById('comp-fixed-total').textContent = f.totalVehicles;
    document.getElementById('comp-adapt-total').textContent = a.totalVehicles;
    document.getElementById('comp-diff-total').textContent = `${a.totalVehicles - f.totalVehicles}`;

    document.getElementById('comp-fixed-departed').textContent = f.totalDeparted;
    document.getElementById('comp-adapt-departed').textContent = a.totalDeparted;
    document.getElementById('comp-diff-departed').textContent = `+${a.totalDeparted - f.totalDeparted}`;

    document.getElementById('comp-fixed-wait').textContent = `${f.overallAvgWaitTime}s`;
    document.getElementById('comp-adapt-wait').textContent = `${a.overallAvgWaitTime}s`;
    document.getElementById('comp-diff-wait').textContent = `-${(f.overallAvgWaitTime - a.overallAvgWaitTime).toFixed(1)}s`;

    document.getElementById('comp-fixed-maxwait').textContent = `${f.overallMaxWaitTime}s`;
    document.getElementById('comp-adapt-maxwait').textContent = `${a.overallMaxWaitTime}s`;
    document.getElementById('comp-diff-maxwait').textContent = `-${(f.overallMaxWaitTime - a.overallMaxWaitTime).toFixed(1)}s`;

    document.getElementById('comp-fixed-throughput').textContent = `${f.overallThroughput} vpm`;
    document.getElementById('comp-adapt-throughput').textContent = `${a.overallThroughput} vpm`;
    document.getElementById('comp-diff-throughput').textContent = `+${(a.overallThroughput - f.overallThroughput).toFixed(1)} vpm`;

    document.getElementById('comp-fixed-congestion').textContent = f.congestionIndex;
    document.getElementById('comp-adapt-congestion').textContent = a.congestionIndex;
    document.getElementById('comp-diff-congestion').textContent = `-${(f.congestionIndex - a.congestionIndex).toFixed(3)}`;

    document.getElementById('comp-fixed-cycles').textContent = f.cyclesCompleted;
    document.getElementById('comp-adapt-cycles').textContent = a.cyclesCompleted;
    document.getElementById('comp-diff-cycles').textContent = `${a.cyclesCompleted - f.cyclesCompleted}`;

    loading.classList.add('hidden');
    results.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    alert(`Benchmark execution failed: ${err.message}`);
  }
}
