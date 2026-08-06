import net from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const PIPE_PATH = String.raw`\\.\pipe\CipherCore.AIDA64.v1`;
const QGT_THEME_DIR = resolve(process.cwd(), '..', 'QGT_Themes');
const HELPER_PATH = resolve(process.cwd(), 'scripts', 'aida64-apply-layout.ps1');
const execFileAsync = promisify(execFile);

const LAYOUTS = Object.freeze({
  Default: String.raw`Permanent_Master\QGT_Inferno_RedOrange.ralcd`,
  PurpleBlue: 'QGT_Neon_PurpleBlue.ralcd',
  Inferno: 'QGT_Inferno_RedOrange.ralcd',
  Ice: 'QGT_Ice_WhiteCyan.ralcd',
  Matrix: 'QGT_Matrix_Green.ralcd',
  Stealth: 'QGT_Stealth_White.ralcd',
});

function parseCommand(input) {
  if (input.trim() === 'STATUS') return 'STATUS';
  const [verb, themeId, ...extra] = input.trim().split(/\s+/);
  if (verb !== 'LOAD' || extra.length > 0 || !Object.hasOwn(LAYOUTS, themeId)) {
    return null;
  }
  return themeId;
}

function psSingleQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function commandLineQuote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

async function runElevatedHelper(themeId, layoutPath) {
  if (themeId !== 'Matrix') {
    return `ERROR AUTOMATION_UNAVAILABLE ${themeId} is not enabled in the controlled Matrix-only helper`;
  }
  if (!existsSync(HELPER_PATH)) {
    return 'ERROR HELPER_MISSING';
  }

  const requestDir = mkdtempSync(resolve(tmpdir(), 'cipher-aida64-'));
  const resultPath = resolve(requestDir, 'result.json');
  const helperArgs = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    HELPER_PATH,
    '-ThemeId',
    themeId,
    '-LayoutPath',
    layoutPath,
    '-ResultPath',
    resultPath,
  ];
  const argumentList = psSingleQuote(helperArgs.map(commandLineQuote).join(' '));
  const command = [
    'try {',
    '$process = Start-Process',
    '-FilePath "powershell.exe"',
    `-ArgumentList ${argumentList}`,
    '-Verb RunAs',
    '-Wait',
    '-PassThru;',
    'if ($null -eq $process) { throw "Elevated helper process was not created." }',
    'exit $process.ExitCode',
    '} catch {',
    'Write-Error $_.Exception.Message;',
    'exit 125',
    '}',
  ].join(' ');

  const readHelperResult = () => {
    if (!existsSync(resultPath)) return null;
    const result = JSON.parse(readFileSync(resultPath, 'utf8'));
    if (result.ok === true && result.status === 'OK APPLIED') {
      return 'OK APPLIED';
    }
    return `ERROR ${result.code ?? 'AIDA64_HELPER_FAILED'} ${result.message ?? 'AIDA64 helper failed'}`;
  };

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        timeout: 120_000,
        windowsHide: false,
      },
    );

    if (!existsSync(resultPath)) {
      return 'ERROR HELPER_NO_RESULT elevated helper did not return a result';
    }

    return readHelperResult();
  } catch (error) {
    const helperResult = readHelperResult();
    if (helperResult) return helperResult;
    const detail = [
      String(error.stderr || '').trim(),
      String(error.stdout || '').trim(),
      error.code ? `exit=${error.code}` : '',
      String(error.message || '').trim(),
    ].filter(Boolean).join(' | ');
    return `ERROR ELEVATION_FAILED ${detail || 'AIDA64 helper elevation was not approved or failed'}`;
  } finally {
    rmSync(requestDir, { recursive: true, force: true });
  }
}

const server = net.createServer((socket) => {
  socket.setEncoding('utf8');
  let buffer = '';

  socket.on('data', async (chunk) => {
    buffer += chunk;
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;

    const command = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    const themeId = parseCommand(command);
    if (themeId === 'STATUS') {
      socket.end(existsSync(HELPER_PATH) ? 'OK READY\n' : 'ERROR HELPER_MISSING\n');
      return;
    }

    if (!themeId) {
      socket.end('ERROR INVALID_THEME\n');
      return;
    }

    const layoutPath = resolve(QGT_THEME_DIR, LAYOUTS[themeId]);
    if (!existsSync(layoutPath)) {
      socket.end(`ERROR MISSING_LAYOUT ${LAYOUTS[themeId]}\n`);
      return;
    }

    console.info(`[AIDA64Bridge] applying ${themeId}: ${layoutPath}`);
    const response = await runElevatedHelper(themeId, layoutPath);
    socket.end(`${response}\n`);
  });
});

server.on('error', (error) => {
  console.error(`[AIDA64Bridge] failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PIPE_PATH, () => {
  console.info(`[AIDA64Bridge] listening on ${PIPE_PATH}`);
  console.info(`[AIDA64Bridge] helper: ${HELPER_PATH}`);
  console.info('[AIDA64Bridge] controlled mode: Matrix-only elevated AIDA64 UI import.');
});
