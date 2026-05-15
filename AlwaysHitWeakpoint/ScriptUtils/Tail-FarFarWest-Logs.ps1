param(
    [string]$PrimaryLog = "C:\Users\joema\Documents\FFWModding\Logs\FarFarWest.log"
)

$candidateLogs = @(
    $PrimaryLog,
    "$env:LOCALAPPDATA\FarFarWest\Saved\Logs\FarFarWest.log",
    "$env:LOCALAPPDATA\FarFarWest\Saved\Logs\FarFarWest-Win64-Shipping.log",
    "$env:LOCALAPPDATA\FarFarWest\Saved\Logs\FarFarWest-backup.log"
) | Where-Object { Test-Path -LiteralPath $_ }

if (-not $candidateLogs) {
    Write-Host "No Far Far West UE log files found yet."
    Write-Host "Launch with ScriptUtils\Launch-FarFarWest-Logged.ps1, then run this again."
    exit 1
}

$latest = $candidateLogs |
    ForEach-Object { Get-Item -LiteralPath $_ } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

Write-Host "Tailing $($latest.FullName)"
Get-Content -LiteralPath $latest.FullName -Wait -Tail 200
