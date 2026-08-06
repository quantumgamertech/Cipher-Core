import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, createReadStream } from 'node:fs';
import net from 'node:net';

export const STARTUP_MODES = Object.freeze({
  SAFE: 'safe',
  LAB: 'lab',
  LIVE: 'live',
});

export const LAB_OPENRGB = Object.freeze({
  executable: String.raw`C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\runtime\OpenRGB.exe`,
  config: String.raw`C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\config`,
  bridgeDll: String.raw`C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\runtime\plugins\OpenRGBEffectsPlugin.dll`,
  bridgeSha256: '0BEF7C41742D2334819F6520EE10D2640DE1975655F12E02B30A20FD3790BF49',
  sdkPort: 6743,
  pipe: String.raw`\\.\pipe\CipherCore.OpenRGBEffects.v1`,
});

const PRODUCTION_OPENRGB = String.raw`C:\Program Files\OpenRGB\OpenRGB.exe`;
const PRODUCTION_PORT = 6742;
const OWNER_SESSION_COOKIE = 'CipherOwnerSession';

function gatewayError(message, code, failedStep) {
  const error = new Error(message);
  error.code = code;
  error.failedStep = failedStep;
  return error;
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    String(cookieHeader)
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=');
        return separator < 0
          ? [entry, '']
          : [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))];
      }),
  );
}

export function createOwnerAccess({
  environment = process.env,
  tokenFactory = () => randomBytes(32).toString('hex'),
} = {}) {
  const configuredPin = String(environment.CIPHER_OWNER_PIN ?? '');
  const sessions = new Set();
  const available = configuredPin.length > 0;

  const unlock = (candidatePin) => {
    if (!available) {
      throw gatewayError(
        'Owner Access is unavailable. Configure CIPHER_OWNER_PIN before launching Cipher Core.',
        'OWNER_ACCESS_UNAVAILABLE',
        'Validate Owner Access configuration',
      );
    }
    const candidate = Buffer.from(String(candidatePin ?? ''), 'utf8');
    const expected = Buffer.from(configuredPin, 'utf8');
    const valid = candidate.length === expected.length
      && timingSafeEqual(candidate, expected);
    if (!valid) {
      throw gatewayError(
        'Invalid Owner PIN.',
        'INVALID_OWNER_PIN',
        'Unlock Owner Access',
      );
    }
    const token = tokenFactory();
    sessions.add(token);
    return token;
  };

  const isAuthorized = (cookieHeader) => {
    const token = parseCookies(cookieHeader)[OWNER_SESSION_COOKIE];
    return Boolean(token && sessions.has(token));
  };

  return {
    available,
    unlock,
    isAuthorized,
    sessionCookie(token) {
      return `${OWNER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict`;
    },
  };
}

function normalizePath(value) {
  return String(value ?? '').replaceAll('/', '\\').toLowerCase();
}

function isHighIntegrity(process) {
  return process?.elevated === true || String(process?.integrityLevel ?? '').toLowerCase() === 'high';
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15_000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message).trim()));
          return;
        }
        resolve(String(stdout).trim());
      },
    );
  });
}

export async function inspectOpenRgbRuntime() {
  const tokenTypeDefinition = [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class CipherToken {',
    '  public const UInt32 PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;',
    '  public const UInt32 TOKEN_QUERY = 0x0008;',
    '  public enum TOKEN_INFORMATION_CLASS { TokenIntegrityLevel = 25 }',
    '  [StructLayout(LayoutKind.Sequential)] public struct SID_AND_ATTRIBUTES { public IntPtr Sid; public UInt32 Attributes; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct TOKEN_MANDATORY_LABEL { public SID_AND_ATTRIBUTES Label; }',
    '  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(UInt32 access, bool inherit, UInt32 pid);',
    '  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool OpenProcessToken(IntPtr processHandle, UInt32 desiredAccess, out IntPtr tokenHandle);',
    '  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool GetTokenInformation(IntPtr tokenHandle, TOKEN_INFORMATION_CLASS tokenInformationClass, IntPtr tokenInformation, UInt32 tokenInformationLength, out UInt32 returnLength);',
    '  [DllImport("advapi32.dll", SetLastError=true)] public static extern IntPtr GetSidSubAuthority(IntPtr sid, UInt32 subAuthority);',
    '  [DllImport("advapi32.dll", SetLastError=true)] public static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);',
    '  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);',
    '}',
  ].join(' ');
  const script = [
    `Add-Type -TypeDefinition '${tokenTypeDefinition.replaceAll("'", "''")}'`,
    'function Get-IntegrityLevel($processId) {',
    '  $processHandle = [CipherToken]::OpenProcess([CipherToken]::PROCESS_QUERY_LIMITED_INFORMATION, $false, [uint32]$processId)',
    "  if ($processHandle -eq [IntPtr]::Zero) { return 'unknown' }",
    '  $tokenHandle = [IntPtr]::Zero',
    '  try {',
    "    if (-not [CipherToken]::OpenProcessToken($processHandle, [CipherToken]::TOKEN_QUERY, [ref]$tokenHandle)) { return 'unknown' }",
    '    $length = [uint32]0',
    '    [void][CipherToken]::GetTokenInformation($tokenHandle, [CipherToken+TOKEN_INFORMATION_CLASS]::TokenIntegrityLevel, [IntPtr]::Zero, 0, [ref]$length)',
    '    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal([int]$length)',
    '    try {',
    "      if (-not [CipherToken]::GetTokenInformation($tokenHandle, [CipherToken+TOKEN_INFORMATION_CLASS]::TokenIntegrityLevel, $buffer, $length, [ref]$length)) { return 'unknown' }",
    '      $label = [Runtime.InteropServices.Marshal]::PtrToStructure($buffer, [type][CipherToken+TOKEN_MANDATORY_LABEL])',
    '      $countPointer = [CipherToken]::GetSidSubAuthorityCount($label.Label.Sid)',
    '      $count = [Runtime.InteropServices.Marshal]::ReadByte($countPointer)',
    '      $ridPointer = [CipherToken]::GetSidSubAuthority($label.Label.Sid, [uint32]($count - 1))',
    '      $rid = [Runtime.InteropServices.Marshal]::ReadInt32($ridPointer)',
    "      if ($rid -ge 12288) { return 'high' }",
    "      if ($rid -ge 8192) { return 'medium' }",
    "      if ($rid -ge 4096) { return 'low' }",
    "      return 'unknown'",
    '    } finally {',
    '      if ($buffer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer) }',
    '    }',
    '  } finally {',
    '    if ($tokenHandle -ne [IntPtr]::Zero) { [void][CipherToken]::CloseHandle($tokenHandle) }',
    '    [void][CipherToken]::CloseHandle($processHandle)',
    '  }',
    '}',
    "$processes = @(Get-CimInstance Win32_Process -Filter \"Name='OpenRGB.exe'\" -ErrorAction SilentlyContinue | ForEach-Object {",
    '  $integrity = Get-IntegrityLevel $_.ProcessId',
    "  [pscustomobject]@{ processId = $_.ProcessId; executablePath = $_.ExecutablePath; commandLine = $_.CommandLine; integrityLevel = $integrity; elevated = ($integrity -eq 'high') }",
    '})',
    '$ports = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 6742,6743 } | ForEach-Object {',
    '  [pscustomobject]@{ port = $_.LocalPort; processId = $_.OwningProcess }',
    '})',
    '[pscustomobject]@{ processes = $processes; ports = $ports } | ConvertTo-Json -Depth 4 -Compress',
  ].join('; ');
  const output = await runPowerShell(script);
  return output ? JSON.parse(output) : { processes: [], ports: [] };
}

export async function stopOpenRgbProcesses(inventory) {
  const processIds = (Array.isArray(inventory?.processes) ? inventory.processes : [])
    .map((process) => Number(process.processId))
    .filter((processId) => Number.isInteger(processId) && processId > 0);
  if (processIds.length === 0) return;

  const ids = processIds.join(',');
  const script = [
    `$ids = @(${ids})`,
    '$processes = @($ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })',
    '$processes | ForEach-Object { [void]$_.CloseMainWindow() }',
    'Start-Sleep -Milliseconds 750',
    '$remaining = @($ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })',
    'if ($remaining.Count -gt 0) {',
    "  $arguments = (($remaining | ForEach-Object { '/PID ' + $_.Id }) -join ' ') + ' /T /F'",
    "  $result = Start-Process -FilePath \"$env:SystemRoot\\System32\\taskkill.exe\" -ArgumentList $arguments -Verb RunAs -Wait -PassThru -WindowStyle Hidden",
    "  if ($result.ExitCode -ne 0) { throw 'OpenRGB shutdown was not approved.' }",
    '  Start-Sleep -Milliseconds 750',
    '}',
  ].join('; ');
  await runPowerShell(script);
}

export function classifyOpenRgbConflict(
  inventory,
  labExecutable = LAB_OPENRGB.executable,
) {
  const processes = Array.isArray(inventory?.processes) ? inventory.processes : [];
  const ports = Array.isArray(inventory?.ports) ? inventory.ports : [];
  const labPath = normalizePath(labExecutable);
  const productionPath = normalizePath(PRODUCTION_OPENRGB);
  const productionPortActive = ports.some((entry) => Number(entry.port) === PRODUCTION_PORT);
  const labPortProcessIds = new Set(
    ports
      .filter((entry) => Number(entry.port) === LAB_OPENRGB.sdkPort)
      .map((entry) => Number(entry.processId))
      .filter((processId) => Number.isInteger(processId) && processId > 0),
  );
  const productionProcessActive = processes.some((process) => {
    const path = normalizePath(process.executablePath);
    const processId = Number(process.processId);
    const labCandidate = labPortProcessIds.has(processId) || path === labPath;
    if (labCandidate) return !isHighIntegrity(process);
    return path === productionPath || (path && path !== labPath);
  });
  const unknownProcessActive = processes.some((process) => {
    if (process.executablePath) return false;
    const processId = Number(process.processId);
    return !(labPortProcessIds.has(processId) && isHighIntegrity(process));
  });

  return {
    productionActive: productionPortActive || productionProcessActive || unknownProcessActive,
    labActive: processes.some((process) => normalizePath(process.executablePath) === labPath)
      || ports.some((entry) => Number(entry.port) === LAB_OPENRGB.sdkPort),
  };
}

function findReusableLabProcess(inventory, labExecutable = LAB_OPENRGB.executable) {
  const processes = Array.isArray(inventory?.processes) ? inventory.processes : [];
  const ports = Array.isArray(inventory?.ports) ? inventory.ports : [];
  const labPath = normalizePath(labExecutable);
  const labPortProcessIds = new Set(
    ports
      .filter((entry) => Number(entry.port) === LAB_OPENRGB.sdkPort)
      .map((entry) => Number(entry.processId))
      .filter((processId) => Number.isInteger(processId) && processId > 0),
  );

  return processes.find((process) => {
    const processId = Number(process.processId);
    const ownsLabPort = labPortProcessIds.has(processId);
    const isLabExecutable = normalizePath(process.executablePath) === labPath;
    return processId > 0 && isHighIntegrity(process) && (ownsLabPort || isLabExecutable);
  });
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
  });
}

export async function launchLabOpenRgb() {
  const executable = LAB_OPENRGB.executable.replaceAll("'", "''");
  const argumentLine = [
    '--config',
    `"${LAB_OPENRGB.config}"`,
    '--server',
    '--server-port',
    String(LAB_OPENRGB.sdkPort),
    '--startminimized',
    '--profile',
    'MASTER',
  ].join(' ').replaceAll("'", "''");
  const script = `$process = Start-Process -FilePath '${executable}' -ArgumentList '${argumentLine}' -Verb RunAs -PassThru; $process.Id`;
  const output = await runPowerShell(script);
  return Number(output);
}

export function isTcpPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (available) => {
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

export function probeOpenRgbBridge(
  pipePath = LAB_OPENRGB.pipe,
  {
    connect = (path) => net.createConnection(path),
    timeoutMs = 1_500,
  } = {},
) {
  return new Promise((resolve) => {
    let socket;
    let settled = false;
    let response = '';
    let timeout;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy?.();
      resolve(available);
    };

    try {
      socket = connect(pipePath);
    } catch {
      finish(false);
      return;
    }

    timeout = setTimeout(() => finish(false), timeoutMs);
    socket.setEncoding?.('utf8');
    socket.once('connect', () => {
      socket.write('LOAD __CIPHER_HEALTHCHECK__\n');
    });
    socket.on('data', (chunk) => {
      response += chunk;
      const newline = response.indexOf('\n');
      if (newline < 0) return;
      finish(/^ERROR INVALID_THEME\b/i.test(response.slice(0, newline).trim()));
    });
    socket.once('error', () => finish(false));
    socket.once('end', () => finish(false));
  });
}

async function waitForLabReady(
  {
    runtimeCheck,
    portCheck,
    bridgeCheck,
    timeoutMs = 30_000,
    intervalMs = 500,
  },
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runtimeReady = await runtimeCheck();
    const portReady = runtimeReady && await portCheck();
    const bridgeReady = portReady && await bridgeCheck();
    if (runtimeReady && portReady && bridgeReady) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export function createStartupGateway({
  inspectRuntime = inspectOpenRgbRuntime,
  pathExists = existsSync,
  hashFile = sha256File,
  stopOpenRgb = stopOpenRgbProcesses,
  launchLab = launchLabOpenRgb,
  portCheck = () => isTcpPortListening(LAB_OPENRGB.sdkPort),
  bridgeCheck = () => probeOpenRgbBridge(LAB_OPENRGB.pipe),
  readinessTimeoutMs = 30_000,
} = {}) {
  let state = {
    selected: false,
    mode: STARTUP_MODES.SAFE,
    rgbActionsEnabled: false,
    labReady: false,
    rgbBridgeStatus: 'offline',
    message: 'Select a startup mode.',
  };
  let selectionInFlight = false;
  let labProcessId = null;
  let healthCheckInFlight = null;

  const status = () => ({ ...state, selectionInFlight });

  const validateLabProcess = async (expectedProcessId) => {
    const inventory = await inspectRuntime();
    const ports = Array.isArray(inventory?.ports) ? inventory.ports : [];
    const productionPortActive = ports.some((entry) => Number(entry.port) === PRODUCTION_PORT);
    const labPort = ports.find((entry) => Number(entry.port) === LAB_OPENRGB.sdkPort);
    return !productionPortActive
      && Number(expectedProcessId) > 0
      && Number(labPort?.processId) === Number(expectedProcessId);
  };

  const checkRgbHealth = async () => {
    if (healthCheckInFlight) return healthCheckInFlight;
    healthCheckInFlight = (async () => {
      if (state.mode !== STARTUP_MODES.LAB || !state.labReady || !labProcessId) {
        return status();
      }
      const runtimeReady = await validateLabProcess(labProcessId);
      const portReady = runtimeReady && await portCheck();
      const bridgeReady = portReady && await bridgeCheck();
      if (!runtimeReady || !portReady || !bridgeReady) {
        state = {
          ...state,
          rgbActionsEnabled: false,
          labReady: false,
          rgbBridgeStatus: 'offline',
          message: 'RGB Bridge Offline. Return to Startup Gateway to retry Lab Mode.',
        };
      }
      return status();
    })().finally(() => {
      healthCheckInFlight = null;
    });
    return healthCheckInFlight;
  };

  const selectMode = async (
    requestedMode,
    { ownerAuthorized = false } = {},
  ) => {
    if (!Object.values(STARTUP_MODES).includes(requestedMode)) {
      throw gatewayError('Unknown startup mode.', 'INVALID_MODE', 'Validate startup mode');
    }
    if (selectionInFlight) {
      throw gatewayError(
        'Startup mode selection is already in progress.',
        'GATEWAY_LOCKED',
        'Acquire Startup Gateway lock',
      );
    }

    selectionInFlight = true;
    try {
      if (requestedMode === STARTUP_MODES.SAFE) {
        state = {
          selected: true,
          mode: STARTUP_MODES.SAFE,
          rgbActionsEnabled: false,
          labReady: false,
          rgbBridgeStatus: 'offline',
          message: 'Safe Mode active. Hardware control is disabled.',
        };
        return status();
      }

      if (requestedMode === STARTUP_MODES.LIVE) {
        state = {
          selected: true,
          mode: STARTUP_MODES.LIVE,
          rgbActionsEnabled: false,
          labReady: false,
          rgbBridgeStatus: 'offline',
          message: 'Live Mode active. Daily local systems are available; external actions remain locked.',
        };
        return status();
      }

      if (!ownerAuthorized) {
        throw gatewayError(
          'Owner Access is required to start Lab Mode.',
          'OWNER_ACCESS_REQUIRED',
          'Authorize Lab Mode',
        );
      }

      state = {
        ...state,
        rgbActionsEnabled: false,
        labReady: false,
        rgbBridgeStatus: 'starting',
        message: 'Lab OpenRGB starting.',
      };

      let inventory = await inspectRuntime();
      let conflict = classifyOpenRgbConflict(inventory);
      if (conflict.productionActive) {
        state = {
          ...state,
          message: 'Closing conflicting OpenRGB runtime.',
        };
        try {
          await stopOpenRgb(inventory);
        } catch {
          throw gatewayError(
            'Administrator approval is required to close production OpenRGB.',
            'PRODUCTION_OPENRGB_ACTIVE',
            'Approve OpenRGB shutdown',
          );
        }
        inventory = await inspectRuntime();
        conflict = classifyOpenRgbConflict(inventory);
        if (conflict.productionActive) {
          throw gatewayError(
            'Production OpenRGB could not be closed. Close it before starting Lab Mode.',
            'PRODUCTION_OPENRGB_ACTIVE',
            'Release production OpenRGB runtime',
          );
        }
      }

      if (!pathExists(LAB_OPENRGB.executable) || !pathExists(LAB_OPENRGB.config)) {
        throw gatewayError(
          'Validated Lab OpenRGB runtime is missing.',
          'LAB_RUNTIME_MISSING',
          'Validate Lab OpenRGB runtime',
        );
      }
      if (!pathExists(LAB_OPENRGB.bridgeDll)) {
        throw gatewayError(
          'Cipher Core RGB bridge DLL is missing from the Lab runtime.',
          'LAB_BRIDGE_MISSING',
          'Validate Lab bridge DLL',
        );
      }

      const bridgeHash = await hashFile(LAB_OPENRGB.bridgeDll);
      if (bridgeHash !== LAB_OPENRGB.bridgeSha256) {
        throw gatewayError(
          'Cipher Core RGB bridge DLL hash does not match the validated build.',
          'LAB_BRIDGE_HASH_MISMATCH',
          'Validate Lab bridge DLL hash',
        );
      }

      const existingLab = findReusableLabProcess(inventory);
      labProcessId = existingLab?.processId ?? null;
      if (!labProcessId) labProcessId = await launchLab();

      const ready = await waitForLabReady({
        runtimeCheck: () => validateLabProcess(labProcessId),
        portCheck,
        bridgeCheck,
        timeoutMs: readinessTimeoutMs,
      });
      if (!ready) {
        throw gatewayError(
          'Lab OpenRGB did not expose port 6743 and the Cipher Core bridge in time.',
          'LAB_NOT_READY',
          'Validate Lab OpenRGB readiness',
        );
      }

      state = {
        selected: true,
        mode: STARTUP_MODES.LAB,
        rgbActionsEnabled: true,
        labReady: true,
        rgbBridgeStatus: 'lab-ready',
        message: 'Lab Mode active. Validated RGB bridge is ready.',
      };
      return status();
    } catch (error) {
      state = {
        ...state,
        rgbActionsEnabled: false,
        labReady: false,
        rgbBridgeStatus: error.code === 'PRODUCTION_OPENRGB_ACTIVE'
          ? 'production-conflict'
          : 'offline',
        message: error.message,
      };
      labProcessId = null;
      throw error;
    } finally {
      selectionInFlight = false;
    }
  };

  return { status, selectMode, checkRgbHealth };
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000) reject(gatewayError('Request body is too large.', 'INVALID_REQUEST'));
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(gatewayError('Request body must be valid JSON.', 'INVALID_REQUEST'));
      }
    });
    request.on('error', reject);
  });
}

function gatewayStatus(error) {
  if (error.code === 'INVALID_MODE' || error.code === 'INVALID_REQUEST') return 400;
  if (error.code === 'GATEWAY_LOCKED') return 409;
  if (error.code === 'PRODUCTION_OPENRGB_ACTIVE') return 409;
  if (error.code === 'INVALID_OWNER_PIN') return 401;
  if (error.code === 'OWNER_ACCESS_REQUIRED') return 403;
  if (error.code === 'OWNER_ACCESS_UNAVAILABLE') return 503;
  if (error.code?.startsWith('LAB_')) return 503;
  return 500;
}

export function startupGatewayApi(
  gateway,
  ownerAccess = createOwnerAccess(),
  { onOwnerUnlocked = () => {} } = {},
) {
  return {
    name: 'cipher-startup-gateway',
    configureServer(server) {
      const sendStatus = async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        sendJson(response, 200, {
          ...await gateway.checkRgbHealth(),
          ownerAccessAvailable: ownerAccess.available,
          ownerUnlocked: ownerAccess.isAuthorized(request.headers.cookie),
        });
      };

      server.middlewares.use('/api/startup-gateway/status', sendStatus);
      server.middlewares.use('/api/startup/status', sendStatus);
      server.middlewares.use('/api/rgb/status', sendStatus);

      server.middlewares.use('/api/startup-gateway/unlock', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        try {
          const payload = await readJson(request);
          const token = ownerAccess.unlock(payload.pin);
          response.setHeader('Set-Cookie', ownerAccess.sessionCookie(token));
          sendJson(response, 200, {
            ...gateway.status(),
            ownerAccessAvailable: ownerAccess.available,
            ownerUnlocked: true,
          });
          queueMicrotask(() => {
            Promise.resolve(onOwnerUnlocked()).catch((error) => {
              console.warn(`[StartupGateway] Owner Access follow-up failed: ${error.message}`);
            });
          });
        } catch (error) {
          sendJson(response, gatewayStatus(error), {
            error: error.message,
            code: error.code,
            failedStep: error.failedStep,
          });
        }
      });

      server.middlewares.use('/api/startup-gateway/select', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        try {
          const payload = await readJson(request);
          console.info(`[StartupGateway] mode request: ${payload.mode ?? '<missing>'}`);
          const result = await gateway.selectMode(payload.mode, {
            ownerAuthorized: ownerAccess.isAuthorized(request.headers.cookie),
          });
          console.info(`[StartupGateway] mode active: ${result.mode} rgb=${result.rgbActionsEnabled}`);
          sendJson(response, 200, result);
        } catch (error) {
          console.error(`[StartupGateway] failed: step=${error.failedStep ?? 'Request validation'} error=${error.message}`);
          sendJson(response, gatewayStatus(error), {
            error: error.message,
            code: error.code,
            failedStep: error.failedStep,
          });
        }
      });
    },
  };
}
