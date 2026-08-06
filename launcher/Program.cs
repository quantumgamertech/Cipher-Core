using System.Diagnostics;
using System.Net.Http;
using System.Net.Sockets;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;

namespace CipherCore.Launcher;

internal static class Program
{
    private const string MutexName = @"Local\CipherCoreLauncher";

    [STAThread]
    private static void Main()
    {
        using Mutex mutex = new(false, MutexName, out bool createdNew);
        bool ownsMutex = false;

        if (createdNew)
        {
            ownsMutex = mutex.WaitOne(0);
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new LauncherForm(ownsMutex));

        if (ownsMutex)
        {
            mutex.ReleaseMutex();
        }
    }
}

internal sealed class LauncherForm : Form
{
    private static readonly string RootPath = @"C:\Cipher Core";
    private static readonly string DashboardPath = Path.Combine(RootPath, "dashboard");
    private static readonly string DashboardDistPath = Path.Combine(DashboardPath, "dist");
    private static readonly string DashboardIndexPath = Path.Combine(DashboardDistPath, "index.html");
    private static readonly string LogPath = Path.Combine(RootPath, "logs", "launcher.log");
    private static readonly Uri DashboardUri = new("http://127.0.0.1:5173/");
    private static readonly Uri ReadinessUri = new("http://127.0.0.1:5173/api/startup-gateway/status");
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(500);

    private readonly bool ownsMutex;
    private readonly CancellationTokenSource lifetime = new();
    private readonly Label statusLabel = new();
    private readonly Label detailLabel = new();
    private NotifyIcon? trayIcon;
    private ContextMenuStrip? trayMenu;
    private Process? dashboardProcess;
    private bool dashboardOpened;
    private bool hiddenToTray;
    private bool exitRequested;
    private bool ownsDashboardProcess;
    private DateTimeOffset lastManualDashboardOpen = DateTimeOffset.MinValue;

    public LauncherForm(bool ownsMutex)
    {
        this.ownsMutex = ownsMutex;
        BuildWindow();
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        await RunLauncherAsync();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (hiddenToTray && !exitRequested && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            HideLauncherToTray();
            return;
        }

        lifetime.Cancel();
        Log("shutdown requested");
        if (ownsDashboardProcess)
        {
            StopOwnedDashboardProcess();
        }
        Log("shutdown complete");
        trayIcon?.Dispose();
        trayMenu?.Dispose();
        base.OnFormClosing(e);
    }

    private void BuildWindow()
    {
        Text = "Cipher Core";
        Width = 420;
        Height = 160;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? Icon;
        BackColor = Color.FromArgb(9, 14, 24);
        ForeColor = Color.FromArgb(210, 246, 255);
        ShowInTaskbar = true;

        statusLabel.AutoSize = false;
        statusLabel.Left = 24;
        statusLabel.Top = 26;
        statusLabel.Width = 360;
        statusLabel.Height = 30;
        statusLabel.Font = new Font("Segoe UI", 13, FontStyle.Bold);
        statusLabel.Text = "Starting Cipher Core";

        detailLabel.AutoSize = false;
        detailLabel.Left = 24;
        detailLabel.Top = 66;
        detailLabel.Width = 360;
        detailLabel.Height = 42;
        detailLabel.Font = new Font("Segoe UI", 9, FontStyle.Regular);
        detailLabel.ForeColor = Color.FromArgb(135, 171, 184);
        detailLabel.Text = "Preparing local launcher";

        Controls.Add(statusLabel);
        Controls.Add(detailLabel);
        BuildTrayIcon();
    }

    private void BuildTrayIcon()
    {
        trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("Open Cipher Core", null, (_, _) => OpenDashboardFromTray());
        trayMenu.Items.Add("Exit", null, (_, _) => ExitFromTray());

        trayIcon = new NotifyIcon
        {
            Icon = Icon,
            Text = "Cipher Core",
            ContextMenuStrip = trayMenu,
            Visible = false,
        };
        trayIcon.DoubleClick += (_, _) => OpenDashboardFromTray();
    }

    private async Task RunLauncherAsync()
    {
        Log("launcher start time: " + DateTimeOffset.Now.ToString("O"));
        Log("duplicate-launch mutex acquired: " + ownsMutex);
        SetStatus("Starting Cipher Core", "Checking local dashboard port");

        try
        {
            bool portOpen = await IsPortOpenAsync(5173, lifetime.Token);
            Log("port 5173 open: " + portOpen);

            if (!ownsMutex)
            {
                Log("duplicate-launch detection: another launcher session is active");
                await HandleExistingOrDuplicateLaunchAsync(portOpen);
                return;
            }

            if (portOpen)
            {
                bool ready = await IsCipherReadyAsync(lifetime.Token);
                Log("existing readiness result: " + ready);
                if (ready)
                {
                    SetStatus("Cipher Core ready", "Opening existing dashboard");
                    OpenDashboardOnce();
                    await CloseAfterDelayAsync();
                    return;
                }

                await FailAsync("Startup failed", "Port 5173 is occupied by another process. Cipher Core readiness did not return valid JSON.");
                return;
            }

            await StartDashboardAsync();
            await WaitForDashboardReadyAsync();
        }
        catch (OperationCanceledException)
        {
            Log("launcher operation canceled");
        }
        catch (Exception error)
        {
            await FailAsync("Startup failed", error.Message);
        }
    }

    private async Task HandleExistingOrDuplicateLaunchAsync(bool portOpen)
    {
        SetStatus("Waiting for dashboard", "Another Cipher Core launcher is active");
        if (!portOpen)
        {
            bool becameReady = await WaitForReadinessOnlyAsync();
            if (!becameReady)
            {
                await FailAsync("Startup failed", "Another launcher is active, but Cipher Core did not become ready in time.");
                return;
            }
        }
        else if (!await IsCipherReadyAsync(lifetime.Token))
        {
            await FailAsync("Startup failed", "Another launcher is active, but port 5173 is not serving Cipher Core readiness JSON.");
            return;
        }

        SetStatus("Cipher Core ready", "Opening existing dashboard");
        OpenDashboardOnce();
        await CloseAfterDelayAsync();
    }

    private async Task StartDashboardAsync()
    {
        if (!Directory.Exists(DashboardPath))
        {
            throw new DirectoryNotFoundException($"Dashboard folder was not found: {DashboardPath}");
        }

        if (!File.Exists(DashboardIndexPath))
        {
            throw new FileNotFoundException(
                $"Production dashboard assets were not found: {DashboardIndexPath}. Run npm.cmd run build before launching Cipher Core.");
        }

        SetStatus("Starting local services", "Launching production dashboard server");
        string npmPath = ResolveOnPath("npm.cmd")
            ?? throw new FileNotFoundException("npm.cmd was not found in PATH. Install Node.js or add npm.cmd to PATH.");
        Log("process start: npm.cmd run start:prod");
        Log("npm path: " + npmPath);
        Log("process working directory: " + DashboardPath);

        ProcessStartInfo startInfo = new()
        {
            FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
            Arguments = $"/d /s /c \"\"{npmPath}\" run start:prod\"",
            WorkingDirectory = DashboardPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        dashboardProcess = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true,
        };
        dashboardProcess.OutputDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Log("[dashboard] " + e.Data); };
        dashboardProcess.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) Log("[dashboard:error] " + e.Data); };
        dashboardProcess.Exited += (_, _) => Log("dashboard process exited: " + dashboardProcess.ExitCode);

        if (!dashboardProcess.Start())
        {
            throw new InvalidOperationException("Dashboard process could not be started.");
        }

        ownsDashboardProcess = true;
        Log("dashboard process started pid: " + dashboardProcess.Id);
        dashboardProcess.BeginOutputReadLine();
        dashboardProcess.BeginErrorReadLine();
        await Task.CompletedTask;
    }

    private static string? ResolveOnPath(string fileName)
    {
        string? path = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(path)) return null;

        foreach (string rawDirectory in path.Split(Path.PathSeparator))
        {
            string directory = rawDirectory.Trim();
            if (directory.Length == 0) continue;

            try
            {
                string candidate = Path.Combine(directory, fileName);
                if (File.Exists(candidate)) return candidate;
            }
            catch
            {
                // Ignore malformed PATH entries.
            }
        }

        return null;
    }

    private async Task WaitForDashboardReadyAsync()
    {
        SetStatus("Waiting for dashboard", "Checking Cipher Core readiness");
        bool ready = await WaitForReadinessOnlyAsync();
        if (!ready)
        {
            throw new TimeoutException("Cipher Core did not become ready within 45 seconds.");
        }

        SetStatus("Cipher Core ready", "Opening dashboard");
        OpenDashboardOnce();
        await HideToTrayAfterDelayAsync();
    }

    private async Task<bool> WaitForReadinessOnlyAsync()
    {
        DateTimeOffset deadline = DateTimeOffset.UtcNow.Add(StartupTimeout);
        int attempt = 0;
        while (DateTimeOffset.UtcNow < deadline && !lifetime.IsCancellationRequested)
        {
            attempt += 1;
            bool ready = await IsCipherReadyAsync(lifetime.Token);
            Log($"readiness attempt {attempt}: {ready}");
            if (ready)
            {
                Log("readiness success");
                return true;
            }

            if (dashboardProcess is { HasExited: true })
            {
                throw new InvalidOperationException($"Dashboard process exited before readiness. Exit code: {dashboardProcess.ExitCode}");
            }

            await Task.Delay(PollInterval, lifetime.Token);
        }

        Log("readiness timeout");
        return false;
    }

    private static async Task<bool> IsPortOpenAsync(int port, CancellationToken cancellationToken)
    {
        using TcpClient client = new();
        try
        {
            Task connectTask = client.ConnectAsync("127.0.0.1", port, cancellationToken).AsTask();
            Task completed = await Task.WhenAny(connectTask, Task.Delay(750, cancellationToken));
            if (completed != connectTask) return false;
            await connectTask;
            return client.Connected;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> IsCipherReadyAsync(CancellationToken cancellationToken)
    {
        try
        {
            using HttpClient client = new()
            {
                Timeout = TimeSpan.FromSeconds(3),
            };
            using HttpResponseMessage response = await client.GetAsync(ReadinessUri, cancellationToken);
            if (!response.IsSuccessStatusCode) return false;

            string body = await response.Content.ReadAsStringAsync(cancellationToken);
            using JsonDocument json = JsonDocument.Parse(body);
            return json.RootElement.ValueKind == JsonValueKind.Object
                && json.RootElement.TryGetProperty("mode", out JsonElement mode)
                && mode.ValueKind == JsonValueKind.String;
        }
        catch
        {
            return false;
        }
    }

    private void OpenDashboardOnce()
    {
        if (dashboardOpened) return;
        dashboardOpened = true;
        Log("dashboard open: " + DashboardUri);
        Process.Start(new ProcessStartInfo
        {
            FileName = DashboardUri.ToString(),
            UseShellExecute = true,
        });
    }

    private void OpenDashboardFromTray()
    {
        if (DateTimeOffset.UtcNow - lastManualDashboardOpen < TimeSpan.FromSeconds(2))
        {
            return;
        }

        lastManualDashboardOpen = DateTimeOffset.UtcNow;
        Log("dashboard open requested from tray: " + DashboardUri);
        Process.Start(new ProcessStartInfo
        {
            FileName = DashboardUri.ToString(),
            UseShellExecute = true,
        });
    }

    private void ExitFromTray()
    {
        Log("tray exit requested");
        exitRequested = true;
        Close();
    }

    private async Task HideToTrayAfterDelayAsync()
    {
        await Task.Delay(900, lifetime.Token);
        HideLauncherToTray();
    }

    private async Task CloseAfterDelayAsync()
    {
        await Task.Delay(900, lifetime.Token);
        Close();
    }

    private void HideLauncherToTray()
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            BeginInvoke(HideLauncherToTray);
            return;
        }

        hiddenToTray = true;
        ShowInTaskbar = false;
        Hide();
        if (trayIcon is not null)
        {
            trayIcon.Visible = true;
        }
        Log("launcher hidden to system tray");
    }

    private void StopOwnedDashboardProcess()
    {
        if (dashboardProcess is null)
        {
            return;
        }

        try
        {
            if (!dashboardProcess.HasExited)
            {
                Log("terminating owned dashboard process tree pid: " + dashboardProcess.Id);
                dashboardProcess.Kill(entireProcessTree: true);
                dashboardProcess.WaitForExit(8_000);
            }
        }
        catch (Exception error)
        {
            Log("dashboard process shutdown warning: " + error.Message);
        }
        finally
        {
            dashboardProcess.Dispose();
            dashboardProcess = null;
            ownsDashboardProcess = false;
        }
    }

    private async Task FailAsync(string status, string detail)
    {
        Log("startup failure: " + detail);
        SetStatus(status, detail);
        try
        {
            await Task.Delay(4_000, lifetime.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        Close();
    }

    private void SetStatus(string status, string detail)
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            BeginInvoke(() => SetStatus(status, detail));
            return;
        }

        statusLabel.Text = status;
        detailLabel.Text = detail;
    }

    private static void Log(string message)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
            File.AppendAllText(
                LogPath,
                $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");
        }
        catch
        {
            // The launcher UI must stay usable even if logging is unavailable.
        }
    }
}
