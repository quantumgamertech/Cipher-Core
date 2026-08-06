param(
  [Parameter(Mandatory = $true)]
  [string]$ThemeId,

  [Parameter(Mandatory = $true)]
  [string]$LayoutPath,

  [Parameter(Mandatory = $true)]
  [string]$ResultPath
)

$ErrorActionPreference = 'Stop'

function Complete-Request {
  param(
    [bool]$Ok,
    [string]$Status,
    [string]$Code,
    [string]$Message,
    [hashtable]$Extra = @{}
  )

  $payload = @{
    ok = $Ok
    status = $Status
    code = $Code
    message = $Message
    themeId = $ThemeId
    layoutPath = $LayoutPath
    generatedAt = (Get-Date).ToString('o')
  }
  foreach ($key in $Extra.Keys) {
    $payload[$key] = $Extra[$key]
  }

  $payload | ConvertTo-Json -Depth 4 -Compress | Set-Content -LiteralPath $ResultPath -Encoding UTF8
  if ($Ok) { exit 0 }
  exit 1
}

try {
  if ($ThemeId -ne 'Matrix') {
    Complete-Request $false 'ERROR' 'INVALID_THEME' 'Only Matrix is enabled for this controlled AIDA64 helper test.'
  }
  if (-not (Test-Path -LiteralPath $LayoutPath)) {
    Complete-Request $false 'ERROR' 'MISSING_LAYOUT' "Layout file was not found: $LayoutPath"
  }

  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public class CipherAida64Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public UInt32 type;
    public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public Int32 dx;
    public Int32 dy;
    public UInt32 mouseData;
    public UInt32 dwFlags;
    public UInt32 time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowEnabled(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern bool SetWindowText(IntPtr hWnd, string lpString);
}
'@

  function Get-WindowTextValue([IntPtr]$Handle) {
    $buffer = New-Object System.Text.StringBuilder 512
    [void][CipherAida64Win32]::GetWindowText($Handle, $buffer, $buffer.Capacity)
    $buffer.ToString()
  }

  function Get-ClassNameValue([IntPtr]$Handle) {
    $buffer = New-Object System.Text.StringBuilder 256
    [void][CipherAida64Win32]::GetClassName($Handle, $buffer, $buffer.Capacity)
    $buffer.ToString()
  }

  function Get-WindowRectangle([IntPtr]$Handle) {
    $rect = New-Object CipherAida64Win32+RECT
    [void][CipherAida64Win32]::GetWindowRect($Handle, [ref]$rect)
    $rect
  }

  function Get-TopWindows {
    $windows = New-Object System.Collections.Generic.List[object]
    $callback = [CipherAida64Win32+EnumWindowsProc]{
      param([IntPtr]$Handle, [IntPtr]$Param)
      $windows.Add([pscustomobject]@{
        Handle = $Handle
        Title = Get-WindowTextValue $Handle
        ClassName = Get-ClassNameValue $Handle
        Visible = [CipherAida64Win32]::IsWindowVisible($Handle)
        Enabled = [CipherAida64Win32]::IsWindowEnabled($Handle)
      })
      return $true
    }
    [void][CipherAida64Win32]::EnumWindows($callback, [IntPtr]::Zero)
    $windows
  }

  function Get-ChildWindows([IntPtr]$Parent) {
    $windows = New-Object System.Collections.Generic.List[object]
    $callback = [CipherAida64Win32+EnumWindowsProc]{
      param([IntPtr]$Handle, [IntPtr]$Param)
      $windows.Add([pscustomobject]@{
        Handle = $Handle
        Title = Get-WindowTextValue $Handle
        ClassName = Get-ClassNameValue $Handle
        Visible = [CipherAida64Win32]::IsWindowVisible($Handle)
        Enabled = [CipherAida64Win32]::IsWindowEnabled($Handle)
        Rect = Get-WindowRectangle $Handle
      })
      return $true
    }
    [void][CipherAida64Win32]::EnumChildWindows($Parent, $callback, [IntPtr]::Zero)
    $windows
  }

  function Invoke-Click([IntPtr]$Handle) {
    $rect = Get-WindowRectangle $Handle
    $x = [int](($rect.Left + $rect.Right) / 2)
    $y = [int](($rect.Top + $rect.Bottom) / 2)
    [void][CipherAida64Win32]::SetCursorPos($x, $y)
    Start-Sleep -Milliseconds 120
    $down = New-Object CipherAida64Win32+INPUT
    $down.type = 0
    $down.mi.dwFlags = 0x0002
    $up = New-Object CipherAida64Win32+INPUT
    $up.type = 0
    $up.mi.dwFlags = 0x0004
    $inputs = [CipherAida64Win32+INPUT[]]@($down, $up)
    [void][CipherAida64Win32]::SendInput(2, $inputs, [Runtime.InteropServices.Marshal]::SizeOf([type][CipherAida64Win32+INPUT]))
  }

  function Wait-Until {
    param(
      [scriptblock]$Probe,
      [int]$TimeoutMs = 5000,
      [int]$IntervalMs = 150
    )
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    do {
      $result = & $Probe
      if ($result) { return $result }
      Start-Sleep -Milliseconds $IntervalMs
    } while ([DateTime]::UtcNow -lt $deadline)
    $null
  }

  function Get-WindowHash([IntPtr]$Handle) {
    $rect = Get-WindowRectangle $Handle
    $width = [Math]::Max(1, $rect.Right - $rect.Left)
    $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
      $stream = New-Object System.IO.MemoryStream
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $sha = [System.Security.Cryptography.SHA256]::Create()
      try {
        [BitConverter]::ToString($sha.ComputeHash($stream.ToArray())).Replace('-', '')
      } finally {
        $sha.Dispose()
        $stream.Dispose()
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }

  function Get-Aida64IniPath {
    $candidate = 'C:\Program Files\FinalWire\AIDA64 Extreme\aida64.ini'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    $null
  }

  $preferences = Get-TopWindows |
    Where-Object { $_.Visible -and $_.ClassName -eq 'TForm_Preferences' -and $_.Title -eq 'Preferences - AIDA64' } |
    Select-Object -First 1
  if (-not $preferences) {
    Complete-Request $false 'ERROR' 'PREFERENCES_NOT_VISIBLE' 'AIDA64 Preferences/LCD Items window is not visible.'
  }

  $children = Get-ChildWindows $preferences.Handle
  $lcdItems = $children |
    Where-Object { $_.Visible -and $_.ClassName -eq 'TTabSheet' -and $_.Title -eq 'LCD Items' } |
    Select-Object -First 1
  if (-not $lcdItems) {
    Complete-Request $false 'ERROR' 'LCD_ITEMS_NOT_VISIBLE' 'AIDA64 Preferences is visible, but LCD Items is not the active page.'
  }

  $importButton = $children |
    Where-Object { $_.Visible -and $_.Enabled -and $_.ClassName -eq 'TButton' -and $_.Title -in @('&Import', 'Import') } |
    Select-Object -First 1
  if (-not $importButton) {
    Complete-Request $false 'ERROR' 'IMPORT_BUTTON_NOT_FOUND' 'AIDA64 Import button was not visible and enabled.'
  }

  $beforeHash = Get-WindowHash $preferences.Handle
  [void][CipherAida64Win32]::SetForegroundWindow($preferences.Handle)
  Start-Sleep -Milliseconds 250
  Invoke-Click $importButton.Handle

  $dialog = Wait-Until -TimeoutMs 5000 -Probe {
    Get-TopWindows |
      Where-Object {
        $_.Visible -and $_.Enabled -and $_.Handle -ne $preferences.Handle -and (
          $_.Title -match 'Import' -or $_.Title -match 'Open'
        )
      } |
      Select-Object -First 1
  }
  if (-not $dialog) {
    Complete-Request $false 'ERROR' 'IMPORT_DIALOG_NOT_OPENED' 'Clicking Import did not open the AIDA64 import file dialog.'
  }

  [void][CipherAida64Win32]::SetForegroundWindow($dialog.Handle)
  Start-Sleep -Milliseconds 250
  $dialogChildren = Get-ChildWindows $dialog.Handle
  $fileNameField = $dialogChildren |
    Where-Object { $_.Visible -and $_.Enabled -and $_.ClassName -eq 'Edit' } |
    Sort-Object { $_.Rect.Top } -Descending |
    Select-Object -First 1
  if (-not $fileNameField) {
    Complete-Request $false 'ERROR' 'FILENAME_FIELD_NOT_FOUND' 'The import dialog filename field was not available.'
  }

  [void][CipherAida64Win32]::SetWindowText($fileNameField.Handle, $LayoutPath)
  Start-Sleep -Milliseconds 200
  $openButton = $dialogChildren |
    Where-Object { $_.Visible -and $_.Enabled -and $_.ClassName -eq 'Button' -and $_.Title -match 'Open' } |
    Select-Object -First 1
  if ($openButton) {
    Invoke-Click $openButton.Handle
  } else {
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  }

  $dialogClosed = Wait-Until -TimeoutMs 8000 -Probe {
    $stillOpen = Get-TopWindows |
      Where-Object { $_.Visible -and $_.Handle -eq $dialog.Handle } |
      Select-Object -First 1
    -not $stillOpen
  }
  if (-not $dialogClosed) {
    Complete-Request $false 'ERROR' 'IMPORT_DIALOG_STILL_OPEN' 'The AIDA64 import dialog did not close after selecting the Matrix layout.'
  }

  Start-Sleep -Milliseconds 1000
  $childrenAfterImport = Get-ChildWindows $preferences.Handle
  $applyButton = $childrenAfterImport |
    Where-Object { $_.Visible -and $_.Enabled -and $_.ClassName -eq 'TButton' -and $_.Title -eq 'Apply' } |
    Select-Object -First 1
  if ($applyButton) {
    [void][CipherAida64Win32]::SetForegroundWindow($preferences.Handle)
    Start-Sleep -Milliseconds 150
    Invoke-Click $applyButton.Handle
    Start-Sleep -Milliseconds 1200
  }

  $afterHash = Get-WindowHash $preferences.Handle
  $iniPath = Get-Aida64IniPath
  $iniContainsMatrix = $false
  if ($iniPath) {
    $iniContainsMatrix = Select-String -LiteralPath $iniPath -Pattern 'QGT_Matrix_Green\.png' -Quiet
  }

  if ($beforeHash -eq $afterHash) {
    Complete-Request $false 'ERROR' 'VISIBLE_VERIFICATION_FAILED' 'AIDA64 Preferences preview/list did not visibly change after Matrix import.' @{
      iniContainsMatrix = $iniContainsMatrix
    }
  }
  if (-not $iniContainsMatrix) {
    Complete-Request $false 'ERROR' 'MATRIX_CONFIG_NOT_CONFIRMED' 'AIDA64 visible UI changed, but active Matrix LCD configuration could not be confirmed.' @{
      visibleChanged = $true
      iniPath = $iniPath
    }
  }

  Complete-Request $true 'OK APPLIED' 'OK' 'Matrix layout was imported through the elevated AIDA64 UI and visibly verified.' @{
    preferencesWindow = 'Preferences - AIDA64'
    importButton = '&Import'
    visibleChanged = $true
    iniContainsMatrix = $true
  }
} catch {
  Complete-Request $false 'ERROR' 'HELPER_EXCEPTION' $_.Exception.Message
}
