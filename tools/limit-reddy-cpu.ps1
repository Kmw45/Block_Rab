# Limits how much CPU the background work started from a Reddy terminal may use
# (image generation, level generation, animation sheets, tests, dev server),
# so that it does not make the rest of the PC stutter.
#
# It pins those worker processes to the last N logical cores and lowers their priority.
#
# IMPORTANT: it does NOT touch the Reddy window, its terminal daemon, the agent CLI (claude.exe)
# or the shells they run in. Those carry the user's keystrokes; lowering their priority made
# typing in Reddy lag badly while a game was using the CPU (2026-10-05).
#
# Workers started later are not limited automatically (they inherit from the agent CLI, which
# stays at normal priority), so run this again right after starting a heavy job.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File tools\limit-reddy-cpu.ps1 [-Cores 4] [-Undo]
# (Comments are in English on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI.)
param(
  [int]$Cores = 4,
  [switch]$Undo
)

$total = [Environment]::ProcessorCount
if ($Cores -lt 1) { $Cores = 1 }
if ($Cores -gt $total) { $Cores = $total }

# Affinity mask: the last $Cores logical cores (or all of them with -Undo)
$all = [long]([math]::Pow(2, $total) - 1)
$mask = [long]0
for ($i = $total - $Cores; $i -lt $total; $i++) { $mask = $mask -bor ([long]1 -shl $i) }
if ($Undo) { $mask = $all }
$priority = 'BelowNormal'
if ($Undo) { $priority = 'Normal' }

$procs = Get-CimInstance Win32_Process
$byId = @{}
foreach ($p in $procs) { $byId[[int]$p.ProcessId] = $p }

# The input path: never limited. Reddy itself, the daemon, the agent CLI, consoles,
# and every ancestor of the agent CLI (the shell it was started from).
$keep = New-Object System.Collections.Generic.HashSet[int]
$agents = @()
foreach ($p in $procs) {
  if (@('Reddy.exe', 'reddy-terminal-daemon.exe', 'claude.exe', 'conhost.exe', 'OpenConsole.exe') -contains $p.Name) { [void]$keep.Add([int]$p.ProcessId) }
  if ($p.Name -eq 'claude.exe') { $agents += [int]$p.ProcessId }
}
foreach ($a in $agents) {
  $cur = $a
  for ($n = 0; $n -lt 20; $n++) {
    if (-not $byId.ContainsKey($cur)) { break }
    $cur = [int]$byId[$cur].ParentProcessId
    if ($cur -le 4) { break }
    [void]$keep.Add($cur)
  }
}

# Workers: everything the agent CLI started, plus detached helpers whose command line
# points into a Reddy workspace (a detached job loses its parent link).
$ids = New-Object System.Collections.Generic.HashSet[int]
foreach ($a in $agents) { [void]$ids.Add($a) }
do {
  $added = 0
  foreach ($p in $procs) {
    if ($ids.Contains([int]$p.ParentProcessId) -and -not $ids.Contains([int]$p.ProcessId)) {
      [void]$ids.Add([int]$p.ProcessId)
      $added++
    }
  }
} while ($added -gt 0)
foreach ($p in $procs) {
  if (@('node.exe', 'cmd.exe', 'powershell.exe', 'codex.exe') -contains $p.Name -and [string]$p.CommandLine -match 'reddy') { [void]$ids.Add([int]$p.ProcessId) }
}
# With -Undo, also restore the input path in case an older version of this script lowered it
if ($Undo) { foreach ($k in $keep) { [void]$ids.Add($k) } }

$done = 0
$failed = 0
foreach ($id in $ids) {
  if (-not $Undo -and $keep.Contains($id)) { continue }
  try {
    $proc = Get-Process -Id $id -ErrorAction Stop
    $proc.ProcessorAffinity = [IntPtr]$mask
    $proc.PriorityClass = $priority
    $done++
  } catch {
    $failed++
  }
}
$used = $Cores
if ($Undo) { $used = $total }
Write-Output ("workers: {0} set, {1} skipped | cores: {2} of {3} | priority: {4} | input path untouched: {5} processes" -f $done, $failed, $used, $total, $priority, $keep.Count)
