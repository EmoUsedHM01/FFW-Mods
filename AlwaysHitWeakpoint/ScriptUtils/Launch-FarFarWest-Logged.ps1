param(
    [string]$GameRoot = "C:\Program Files (x86)\Steam\steamapps\common\FarFarWest",
    [string]$LogPath = "C:\Users\joema\Documents\FFWModding\Logs\FarFarWest.log"
)

$exe = Join-Path $GameRoot "FarFarWest\Binaries\Win64\FarFarWest-Win64-Shipping.exe"
$workDir = Split-Path -Parent $exe
$logDir = Split-Path -Parent $LogPath

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
if (Test-Path -LiteralPath $LogPath) {
    Remove-Item -LiteralPath $LogPath -Force
}

$args = @(
    "-log",
    "-stdout",
    "-FullStdOutLogOutput",
    "-abslog=`"$LogPath`""
)

Start-Process -FilePath $exe -WorkingDirectory $workDir -ArgumentList $args
Write-Host "Launched Far Far West with log path:"
Write-Host $LogPath
