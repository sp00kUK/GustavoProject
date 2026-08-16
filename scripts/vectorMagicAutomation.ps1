param(
  [Parameter(Mandatory = $true)]
  [string]$Executable,

  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [string]$StatusPath,

  [Parameter(Mandatory = $true)]
  [string]$CancelPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$nativeSource = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class VectorMagicNative
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    private const uint WM_CLOSE = 0x0010;
    private const uint WM_COMMAND = 0x0111;
    private const uint WM_SETTEXT = 0x000C;
    private const uint WM_LBUTTONDOWN = 0x0201;
    private const uint WM_LBUTTONUP = 0x0202;
    private const uint BM_CLICK = 0x00F5;
    private const uint CB_GETCOUNT = 0x0146;
    private const uint CB_GETLBTEXT = 0x0148;
    private const uint CB_GETLBTEXTLEN = 0x0149;
    private const uint CB_SETCURSEL = 0x014E;
    private const int CBN_SELCHANGE = 1;
    private const int CBN_EDITCHANGE = 5;
    private const int EN_CHANGE = 0x0300;
    private const int SW_HIDE = 0;
    private const int SW_SHOWNOACTIVATE = 4;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder value, int maximum);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder value, int maximum);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessageText(IntPtr hWnd, uint message, IntPtr wParam, string value);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
    private static extern IntPtr SendMessageBuffer(IntPtr hWnd, uint message, IntPtr wParam, StringBuilder value);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDlgItem(IntPtr dialog, int controlId);

    [DllImport("user32.dll")]
    private static extern int GetDlgCtrlID(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetParent(IntPtr hWnd);

    public static IntPtr FindTopLevelWindow(int processId, string className, string titleFragment)
    {
        IntPtr result = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hWnd, IntPtr ignored)
        {
            uint owner;
            GetWindowThreadProcessId(hWnd, out owner);
            string title = WindowText(hWnd);
            if (owner == (uint)processId &&
                ClassName(hWnd) == className &&
                (String.IsNullOrEmpty(titleFragment) ||
                 title.IndexOf(titleFragment, StringComparison.OrdinalIgnoreCase) >= 0))
            {
                result = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }

    public static bool WindowExists(IntPtr hWnd)
    {
        return hWnd != IntPtr.Zero && IsWindow(hWnd);
    }

    public static string WindowText(IntPtr hWnd)
    {
        StringBuilder value = new StringBuilder(2048);
        GetWindowText(hWnd, value, value.Capacity);
        return value.ToString();
    }

    public static void HideWindow(IntPtr hWnd)
    {
        if (WindowExists(hWnd))
            ShowWindow(hWnd, SW_HIDE);
    }

    public static void ShowOffscreen(IntPtr hWnd)
    {
        Rect rect;
        if (!WindowExists(hWnd) || !GetWindowRect(hWnd, out rect))
            return;
        int width = Math.Max(640, rect.Right - rect.Left);
        int height = Math.Max(480, rect.Bottom - rect.Top);
        SetWindowPos(
            hWnd,
            IntPtr.Zero,
            -32000,
            -32000,
            width,
            height,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        ShowWindow(hWnd, SW_SHOWNOACTIVATE);
    }

    // Every wizard page used by the automatic path places its primary action
    // at this fixed offset from the right edge. Using the client width keeps it
    // correct whether Vector Magic restores a normal or maximised window.
    public static bool ClickWizardAction(IntPtr hWnd)
    {
        Rect rect;
        if (!WindowExists(hWnd) || !GetClientRect(hWnd, out rect))
            return false;

        int width = Math.Max(1, rect.Right - rect.Left);
        int height = Math.Max(1, rect.Bottom - rect.Top);
        int x = Math.Max(20, width - 190);
        int y = Math.Min(Math.Max(20, 100), height - 20);
        IntPtr point = new IntPtr((y << 16) | (x & 0xffff));
        PostMessage(hWnd, WM_LBUTTONDOWN, new IntPtr(1), point);
        PostMessage(hWnd, WM_LBUTTONUP, IntPtr.Zero, point);
        return true;
    }

    public static bool SelectSvgFormat(IntPtr dialog)
    {
        List<IntPtr> candidates = new List<IntPtr>();
        IntPtr standardTypeCombo = GetDlgItem(dialog, 0x0470);
        if (standardTypeCombo != IntPtr.Zero)
            candidates.Add(standardTypeCombo);

        foreach (IntPtr child in Descendants(dialog))
        {
            if (ClassName(child).StartsWith("ComboBox", StringComparison.OrdinalIgnoreCase) &&
                !candidates.Contains(child))
                candidates.Add(child);
        }

        foreach (IntPtr combo in candidates)
        {
            int count = SendMessage(combo, CB_GETCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
            for (int index = 0; index < count; index++)
            {
                int length = SendMessage(combo, CB_GETLBTEXTLEN, new IntPtr(index), IntPtr.Zero).ToInt32();
                if (length < 0)
                    continue;
                StringBuilder item = new StringBuilder(length + 2);
                SendMessageBuffer(combo, CB_GETLBTEXT, new IntPtr(index), item);
                string text = item.ToString();
                if (text.IndexOf("SVG", StringComparison.OrdinalIgnoreCase) < 0 &&
                    text.IndexOf("*.svg", StringComparison.OrdinalIgnoreCase) < 0)
                    continue;

                SendMessage(combo, CB_SETCURSEL, new IntPtr(index), IntPtr.Zero);
                int controlId = GetDlgCtrlID(combo);
                IntPtr command = new IntPtr((CBN_SELCHANGE << 16) | (controlId & 0xffff));
                SendMessage(GetParent(combo), WM_COMMAND, command, combo);
                return true;
            }
        }
        return false;
    }

    public static bool SetOutputPath(IntPtr dialog, string outputPath)
    {
        // cmb13 is the filename field in the native Windows Save dialog.
        IntPtr filename = GetDlgItem(dialog, 0x047c);
        if (filename != IntPtr.Zero)
        {
            SetControlText(filename, outputPath);
            foreach (IntPtr child in Descendants(filename))
            {
                if (ClassName(child).Equals("Edit", StringComparison.OrdinalIgnoreCase))
                {
                    SetControlText(child, outputPath);
                    return true;
                }
            }
            return true;
        }

        // Older common dialogs expose edt1 directly.
        IntPtr edit = GetDlgItem(dialog, 0x0480);
        if (edit != IntPtr.Zero)
        {
            SetControlText(edit, outputPath);
            return true;
        }

        // Vista-style dialogs expose the filename edit as control 1001 under
        // an id-less ComboBox. The address bar uses 41477, so exclude it.
        foreach (IntPtr child in Descendants(dialog))
        {
            IntPtr parent = GetParent(child);
            if (ClassName(child).Equals("Edit", StringComparison.OrdinalIgnoreCase) &&
                GetDlgCtrlID(child) == 1001 &&
                ClassName(parent).StartsWith("ComboBox", StringComparison.OrdinalIgnoreCase) &&
                GetDlgCtrlID(parent) != 41477)
            {
                SetControlText(parent, outputPath);
                SetControlText(child, outputPath);
                return true;
            }
        }
        return false;
    }

    public static void ConfirmSave(IntPtr dialog)
    {
        IntPtr saveButton = GetDlgItem(dialog, 1);
        if (saveButton != IntPtr.Zero)
            SendMessage(saveButton, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
        else
            SendMessage(dialog, WM_COMMAND, new IntPtr(1), IntPtr.Zero);
    }

    public static void CloseWindow(IntPtr hWnd)
    {
        if (WindowExists(hWnd))
            PostMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
    }

    private static string ClassName(IntPtr hWnd)
    {
        StringBuilder value = new StringBuilder(256);
        GetClassName(hWnd, value, value.Capacity);
        return value.ToString();
    }

    private static void SetControlText(IntPtr control, string value)
    {
        SendMessageText(control, WM_SETTEXT, IntPtr.Zero, value);
        int controlId = GetDlgCtrlID(control);
        IntPtr parent = GetParent(control);
        IntPtr change = new IntPtr((EN_CHANGE << 16) | (controlId & 0xffff));
        SendMessage(parent, WM_COMMAND, change, control);

        if (ClassName(control).Equals("Edit", StringComparison.OrdinalIgnoreCase) &&
            ClassName(parent).StartsWith("ComboBox", StringComparison.OrdinalIgnoreCase))
        {
            int comboId = GetDlgCtrlID(parent);
            IntPtr editChange = new IntPtr((CBN_EDITCHANGE << 16) | (comboId & 0xffff));
            SendMessage(GetParent(parent), WM_COMMAND, editChange, parent);
        }
    }

    private static List<IntPtr> Descendants(IntPtr parent)
    {
        List<IntPtr> result = new List<IntPtr>();
        EnumChildWindows(parent, delegate(IntPtr hWnd, IntPtr ignored)
        {
            result.Add(hWnd);
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
'@

Add-Type -TypeDefinition $nativeSource

$ownedProcessIds = [Collections.Generic.HashSet[int]]::new()
$mainWindow = [IntPtr]::Zero
$exitCode = 1
$lastReportedProgress = 0.0

function Write-AutomationStatus {
  param(
    [Parameter(Mandatory = $true)][string]$State,
    [Parameter(Mandatory = $true)][double]$Progress,
    [string]$ErrorCode = ''
  )

  $bounded = [Math]::Max(
    [double]0.0,
    [Math]::Min([double]1.0, [double]$Progress)
  )
  if ($State -ne 'error' -and $State -ne 'cancelled') {
    $bounded = [Math]::Max(
      [double]$script:lastReportedProgress,
      [double]$bounded
    )
    $script:lastReportedProgress = $bounded
  }
  $payload = [ordered]@{
    state = $State
    progress = $bounded
    updatedAt = [DateTime]::UtcNow.ToString('o')
  }
  if ($ErrorCode) {
    $payload['error'] = $ErrorCode
  }

  $json = $payload | ConvertTo-Json -Compress
  $temporaryStatus = "$StatusPath.tmp"
  [IO.File]::WriteAllText($temporaryStatus, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporaryStatus -Destination $StatusPath -Force
}

function Assert-NotCancelled {
  if (Test-Path -LiteralPath $CancelPath) {
    throw [OperationCanceledException]::new('VECTOR_MAGIC_CANCELLED')
  }
}

function Get-OwnedProcesses {
  $result = @()
  foreach ($processIdValue in $ownedProcessIds) {
    $candidate = Get-Process -Id $processIdValue -ErrorAction SilentlyContinue
    if ($candidate) {
      $result += $candidate
    }
  }
  return $result
}

try {
  Write-AutomationStatus -State 'launching' -Progress 0.03
  Assert-NotCancelled

  if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
    throw 'VECTOR_MAGIC_NOT_INSTALLED'
  }
  if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw 'VECTOR_MAGIC_INPUT_MISSING'
  }

  # Vector Magic Desktop is a single-instance application. Refuse to take
  # control of a window the user opened independently.
  $existing = @(Get-Process -Name 'vmde' -ErrorAction SilentlyContinue)
  if ($existing.Count -gt 0) {
    throw 'VECTOR_MAGIC_ALREADY_RUNNING'
  }

  $workingDirectory = [IO.Path]::GetDirectoryName($InputPath)
  $startedAt = [DateTime]::Now.AddSeconds(-1)
  $launched = Start-Process `
    -FilePath $Executable `
    -ArgumentList ('"' + $InputPath + '"') `
    -WorkingDirectory $workingDirectory `
    -WindowStyle Hidden `
    -PassThru
  [void]$ownedProcessIds.Add($launched.Id)

  Write-AutomationStatus -State 'launching' -Progress 0.08

  $mainProcess = $null
  $inputLeaf = [IO.Path]::GetFileName($InputPath)
  $windowDeadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $windowDeadline -and $mainWindow -eq [IntPtr]::Zero) {
    Assert-NotCancelled
    $candidates = @(Get-Process -Name 'vmde' -ErrorAction SilentlyContinue | Where-Object {
      $_.StartTime -ge $startedAt
    })
    foreach ($candidate in $candidates) {
      $window = [VectorMagicNative]::FindTopLevelWindow(
        $candidate.Id,
        'QWidget',
        $inputLeaf
      )
      if ($window -eq [IntPtr]::Zero) {
        continue
      }
      $mainProcess = $candidate
      $mainWindow = $window
      [void]$ownedProcessIds.Add($candidate.Id)
      break
    }
    Start-Sleep -Milliseconds 100
  }

  if ($mainWindow -eq [IntPtr]::Zero -or -not $mainProcess) {
    throw 'VECTOR_MAGIC_WINDOW_TIMEOUT'
  }

  [VectorMagicNative]::HideWindow($mainWindow)
  Start-Sleep -Milliseconds 900
  Assert-NotCancelled
  [VectorMagicNative]::HideWindow($mainWindow)

  Write-AutomationStatus -State 'tracing' -Progress 0.14
  if (-not [VectorMagicNative]::ClickWizardAction($mainWindow)) {
    throw 'VECTOR_MAGIC_AUTOMATION_CLICK_FAILED'
  }

  $traceDeadline = [DateTime]::UtcNow.AddMinutes(10)
  $traceStarted = [DateTime]::UtcNow
  $sawTitleProgress = $false
  $idleSamples = 0
  $mainProcess.Refresh()
  $lastCpu = $mainProcess.TotalProcessorTime

  while ([DateTime]::UtcNow -lt $traceDeadline) {
    Start-Sleep -Milliseconds 200
    Assert-NotCancelled
    if (-not [VectorMagicNative]::WindowExists($mainWindow)) {
      throw 'VECTOR_MAGIC_CLOSED'
    }
    [VectorMagicNative]::HideWindow($mainWindow)

    $title = [VectorMagicNative]::WindowText($mainWindow)
    $match = [regex]::Match($title, '(?<!\d)(\d{1,3})%')
    if ($match.Success) {
      $sawTitleProgress = $true
      $idleSamples = 0
      $nativeProgress = [Math]::Min(100, [int]$match.Groups[1].Value)
      Write-AutomationStatus -State 'tracing' -Progress (0.16 + (0.62 * $nativeProgress / 100))
      continue
    }

    $mainProcess.Refresh()
    $currentCpu = $mainProcess.TotalProcessorTime
    $cpuDelta = ($currentCpu - $lastCpu).TotalMilliseconds
    $lastCpu = $currentCpu
    if ($cpuDelta -lt 8) {
      $idleSamples++
    } else {
      $idleSamples = 0
    }

    $elapsed = ([DateTime]::UtcNow - $traceStarted).TotalSeconds
    $estimated = [Math]::Min(0.74, 0.18 + ($elapsed * 0.018))
    Write-AutomationStatus -State 'tracing' -Progress $estimated

    if (($sawTitleProgress -and $idleSamples -ge 2) -or
        (-not $sawTitleProgress -and $elapsed -ge 2 -and $idleSamples -ge 8)) {
      break
    }
  }

  if ([DateTime]::UtcNow -ge $traceDeadline) {
    throw 'VECTOR_MAGIC_TRACE_TIMEOUT'
  }

  Write-AutomationStatus -State 'reviewing' -Progress 0.82
  Start-Sleep -Milliseconds 700
  Assert-NotCancelled
  [VectorMagicNative]::HideWindow($mainWindow)
  if (-not [VectorMagicNative]::ClickWizardAction($mainWindow)) {
    throw 'VECTOR_MAGIC_AUTOMATION_REVIEW_FAILED'
  }

  Write-AutomationStatus -State 'exporting' -Progress 0.88
  Start-Sleep -Milliseconds 700
  Assert-NotCancelled
  [VectorMagicNative]::HideWindow($mainWindow)
  if (-not [VectorMagicNative]::ClickWizardAction($mainWindow)) {
    throw 'VECTOR_MAGIC_AUTOMATION_EXPORT_FAILED'
  }

  $saveDialog = [IntPtr]::Zero
  $dialogDeadline = [DateTime]::UtcNow.AddSeconds(20)
  while ([DateTime]::UtcNow -lt $dialogDeadline -and $saveDialog -eq [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 100
    Assert-NotCancelled
    $saveDialog = [VectorMagicNative]::FindTopLevelWindow($mainProcess.Id, '#32770', '')
  }
  if ($saveDialog -eq [IntPtr]::Zero) {
    throw 'VECTOR_MAGIC_SAVE_DIALOG_TIMEOUT'
  }

  # A native common dialog created by a hidden owner is not fully committed
  # until it has been shown once. Show it far outside the desktop so Windows
  # initialises its controls without exposing any Vector Magic UI to the user.
  [VectorMagicNative]::ShowOffscreen($saveDialog)
  Start-Sleep -Milliseconds 200
  if (-not [VectorMagicNative]::SelectSvgFormat($saveDialog)) {
    throw 'VECTOR_MAGIC_SVG_FORMAT_UNAVAILABLE'
  }
  Start-Sleep -Milliseconds 150
  if (-not [VectorMagicNative]::SetOutputPath($saveDialog, $OutputPath)) {
    throw 'VECTOR_MAGIC_FILENAME_CONTROL_UNAVAILABLE'
  }

  Write-AutomationStatus -State 'exporting' -Progress 0.94
  Start-Sleep -Milliseconds 100
  [VectorMagicNative]::ConfirmSave($saveDialog)

  $saveDeadline = [DateTime]::UtcNow.AddSeconds(45)
  $stableSamples = 0
  $lastLength = -1L
  while ([DateTime]::UtcNow -lt $saveDeadline) {
    Start-Sleep -Milliseconds 150
    Assert-NotCancelled
    [VectorMagicNative]::HideWindow($mainWindow)
    if (Test-Path -LiteralPath $OutputPath -PathType Leaf) {
      $length = (Get-Item -LiteralPath $OutputPath).Length
      if ($length -gt 0 -and $length -eq $lastLength) {
        $stableSamples++
      } else {
        $stableSamples = 0
      }
      $lastLength = $length
      if ($stableSamples -ge 3) {
        break
      }
    }
  }

  if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf) -or
      (Get-Item -LiteralPath $OutputPath).Length -le 0) {
    throw 'VECTOR_MAGIC_SAVE_TIMEOUT'
  }

  Write-AutomationStatus -State 'complete' -Progress 1
  $exitCode = 0
}
catch [OperationCanceledException] {
  Write-AutomationStatus -State 'cancelled' -Progress 0 -ErrorCode 'VECTOR_MAGIC_CANCELLED'
  $exitCode = 2
}
catch {
  $message = $_.Exception.Message
  if (-not $message) {
    $message = 'VECTOR_MAGIC_AUTOMATION_FAILED'
  }
  Write-AutomationStatus -State 'error' -Progress 0 -ErrorCode $message
  $exitCode = 1
}
finally {
  if ($mainWindow -ne [IntPtr]::Zero) {
    [VectorMagicNative]::CloseWindow($mainWindow)
  }
  Start-Sleep -Milliseconds 500
  foreach ($owned in @(Get-OwnedProcesses)) {
    if (-not $owned.HasExited) {
      try {
        $owned.Kill()
      } catch {
        # The process may finish between the state check and Kill().
      }
    }
  }
}

exit $exitCode
