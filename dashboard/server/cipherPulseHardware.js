import { execFile, spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HELPER_PATH = path.join(
  SERVER_DIRECTORY,
  'helpers',
  'cipher-pulse-hardware',
  'src',
  'bin',
  'Debug',
  'net8.0-windows',
  'CipherPulse.Hardware.exe',
);
const SAMPLE_MAX_AGE_MS = 5_000;

function validTemperature(value) {
  return Number.isFinite(Number(value))
    && Number(value) > 0
    && Number(value) <= 125;
}

export function normalizeHardwareSample(sample, now = Date.now()) {
  const sampledAt = Date.parse(sample?.sampledAt);
  if (
    sample?.status !== 'live'
    || !validTemperature(sample?.cpuTemperature)
    || !Number.isFinite(sampledAt)
    || now - sampledAt > SAMPLE_MAX_AGE_MS
  ) {
    return null;
  }

  return {
    cpuTemperature: Number(sample.cpuTemperature),
    sampledAt: sample.sampledAt,
    source: String(sample.source || 'librehardwaremonitor'),
    sensor: sample.sensor ? String(sample.sensor) : null,
  };
}

function executeFile(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim()));
        return;
      }
      resolve(String(stdout).trim());
    });
  });
}

export class CipherPulseHardware {
  constructor({
    helperPath = process.env.CIPHER_PULSE_HARDWARE_PATH || DEFAULT_HELPER_PATH,
    cachePath = path.join(os.tmpdir(), `cipher-pulse-hardware-${process.pid}.json`),
    spawnProcess = spawn,
    runProcess = executeFile,
    readText = (file) => readFile(file, 'utf8'),
    removeFile = (file) => unlink(file),
    now = () => Date.now(),
    logger = console,
  } = {}) {
    this.helperPath = helperPath;
    this.cachePath = cachePath;
    this.spawnProcess = spawnProcess;
    this.runProcess = runProcess;
    this.readText = readText;
    this.removeFile = removeFile;
    this.now = now;
    this.logger = logger;
    this.normalProcess = null;
    this.normalResult = null;
    this.elevationRequested = false;
  }

  start() {
    if (process.platform !== 'win32' || this.normalProcess) return;

    this.normalProcess = this.spawnProcess(
      this.helperPath,
      [
        '--watch',
        '--output-file',
        this.cachePath,
        '--parent-pid',
        String(process.pid),
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let buffer = '';
    this.normalProcess.stdout?.setEncoding('utf8');
    this.normalProcess.stdout?.on('data', (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const sample = JSON.parse(line);
          this.normalResult = normalizeHardwareSample(sample, this.now())
            ? 'live'
            : 'elevation-required';
        } catch {
          // Ignore non-JSON helper output.
        }
      }
    });
    this.normalProcess.stderr?.setEncoding('utf8');
    this.normalProcess.stderr?.on('data', (chunk) => {
      const message = String(chunk).trim();
      if (message) this.logger.warn(`[CipherPulse] hardware helper warning: ${message}`);
    });
    this.normalProcess.once('error', (error) => {
      this.normalResult = 'unavailable';
      this.normalProcess = null;
      this.logger.warn(`[CipherPulse] hardware helper unavailable: ${error.message}`);
    });
    this.normalProcess.once('exit', () => {
      this.normalProcess = null;
    });
  }

  async enableElevatedAccess() {
    if (
      process.platform !== 'win32'
      || this.elevationRequested
      || this.normalResult !== 'elevation-required'
    ) {
      return false;
    }

    this.elevationRequested = true;
    this.normalProcess?.kill();
    this.normalProcess = null;

    const script = [
      '$arguments = \'--watch --output-file "\'',
      '+ $env:CIPHER_PULSE_OUTPUT',
      '+ \'" --parent-pid \'',
      '+ $env:CIPHER_PULSE_PARENT_PID;',
      '$process = Start-Process',
      '-FilePath $env:CIPHER_PULSE_HELPER',
      '-ArgumentList $arguments',
      '-Verb RunAs',
      '-PassThru',
      '-WindowStyle Hidden;',
      '$process.Id',
    ].join(' ');

    try {
      await this.runProcess(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          script,
        ],
        {
          windowsHide: true,
          timeout: 60_000,
          env: {
            ...process.env,
            CIPHER_PULSE_HELPER: this.helperPath,
            CIPHER_PULSE_OUTPUT: this.cachePath,
            CIPHER_PULSE_PARENT_PID: String(process.pid),
          },
        },
      );
      this.logger.info('[CipherPulse] elevated hardware helper authorized by Owner Access.');
      return true;
    } catch (error) {
      this.elevationRequested = false;
      this.logger.warn(`[CipherPulse] elevated hardware helper was not started: ${error.message}`);
      return false;
    }
  }

  async sample() {
    try {
      const raw = await this.readText(this.cachePath);
      return normalizeHardwareSample(JSON.parse(raw), this.now());
    } catch {
      return null;
    }
  }

  stop() {
    this.normalProcess?.kill();
    this.normalProcess = null;
    this.removeFile(this.cachePath).catch(() => {});
  }
}
