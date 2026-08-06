$ErrorActionPreference = 'Stop'

$dashboardPath = 'C:\Cipher Core\dashboard'
$dashboardUrl = 'http://127.0.0.1:5173/'
$dashboardPort = 5173

function Test-LocalPort {
    param([int]$Port)

    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $asyncResult = $connection.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $asyncResult.AsyncWaitHandle.WaitOne(250)) {
            return $false
        }

        $connection.EndConnect($asyncResult)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $connection.Dispose()
    }
}

Write-Host ''
Write-Host 'Cipher Core Launcher' -ForegroundColor Cyan
Write-Host '--------------------' -ForegroundColor DarkCyan

if (-not (Test-Path -LiteralPath $dashboardPath -PathType Container)) {
    Write-Host "ERROR: Dashboard folder was not found at $dashboardPath" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: npm.cmd was not found. Install Node.js and ensure it is available in PATH.' -ForegroundColor Red
    exit 1
}

$env:ENABLE_THEME_ACTIONS = 'false'
$env:ENABLE_AIDA64_THEME_ACTIONS = 'false'

Write-Host "Dashboard: $dashboardPath"
Write-Host "URL:       $dashboardUrl"
Write-Host "RGB actions:    $env:ENABLE_THEME_ACTIONS"
Write-Host "AIDA64 actions: $env:ENABLE_AIDA64_THEME_ACTIONS"
Write-Host "Owner access:   $(if ($env:CIPHER_OWNER_PIN) { 'configured' } else { 'not configured' })"
Write-Host 'Startup mode is selected inside Cipher Core.'

if (Test-LocalPort -Port $dashboardPort) {
    Write-Host ''
    Write-Host "Port $dashboardPort is already in use. A second server will not be started." -ForegroundColor Yellow
    Write-Host 'Opening the existing local address.'
    Start-Process $dashboardUrl
    exit 0
}

Set-Location -LiteralPath $dashboardPath
Write-Host ''
Write-Host 'Starting Cipher Core. Press Ctrl+C in this window to stop it.' -ForegroundColor Green

$startupMarkerPath = Join-Path ([System.IO.Path]::GetTempPath()) "cipher-core-launcher-$PID.started"
Remove-Item -LiteralPath $startupMarkerPath -Force -ErrorAction SilentlyContinue

$browserJob = Start-Job -ScriptBlock {
    param($Url, $Port, $StartupMarkerPath)

    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
            if ($result.AsyncWaitHandle.WaitOne(250)) {
                $client.EndConnect($result)
                Set-Content -LiteralPath $StartupMarkerPath -Value ([DateTime]::UtcNow.ToString('o')) -Encoding ASCII
                Start-Process $Url
                return
            }
        }
        catch {
            # The server is still starting.
        }
        finally {
            $client.Dispose()
        }

        Start-Sleep -Milliseconds 250
    }
} -ArgumentList $dashboardUrl, $dashboardPort, $startupMarkerPath

try {
    & npm.cmd run dev -- --port $dashboardPort
    $devServerExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    if ((Test-Path -LiteralPath $startupMarkerPath) -and $devServerExitCode -ne 0) {
        Write-Host ''
        Write-Host 'Cipher Core dev server stopped after startup.' -ForegroundColor Yellow
        exit 0
    }
    exit $devServerExitCode
}
finally {
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $startupMarkerPath -Force -ErrorAction SilentlyContinue
}
