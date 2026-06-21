param(
    [string]$ApiUrl = "https://pockettrade-ebaq.onrender.com",
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot "mobile"
$flutter = "C:\src\flutter\bin\flutter.bat"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$apk = Join-Path $mobileRoot "build\app\outputs\flutter-apk\app-arm64-v8a-debug.apk"

function Set-Stage {
    param([int]$Percent, [string]$Status)
    Write-Progress -Activity "PocketTrade Android build and install" -Status $Status -PercentComplete $Percent
    Write-Host "[$Percent%] $Status"
}

function Get-ConnectedDevice {
    $devices = & $adb devices | Select-Object -Skip 1 | ForEach-Object {
        if ($_ -match "^(?<serial>\S+)\s+device$") { $Matches.serial }
    }
    if ($devices.Count -eq 1) { return $devices[0] }
    if ($devices.Count -gt 1) { throw "More than one ADB device is connected: $($devices -join ', '). Disconnect the extra device." }

    Set-Stage 65 "No device connected. Looking for the single wireless ADB address..."
    $addresses = & $adb mdns services | ForEach-Object {
        if ($_ -match "(?<address>(?:\d{1,3}\.){3}\d{1,3}:\d+)") { $Matches.address }
    } | Sort-Object -Unique
    if ($addresses.Count -ne 1) {
        throw "No connected phone found. Enable Wireless debugging, pair/connect it once, then rerun this script."
    }

    & $adb connect $addresses[0] | Out-Host
    $devices = & $adb devices | Select-Object -Skip 1 | ForEach-Object {
        if ($_ -match "^(?<serial>\S+)\s+device$") { $Matches.serial }
    }
    if ($devices.Count -ne 1) { throw "ADB could not connect to the phone at $($addresses[0])." }
    return $devices[0]
}

if (-not (Test-Path -LiteralPath $flutter)) { throw "Flutter was not found at $flutter." }
if (-not (Test-Path -LiteralPath $adb)) { throw "ADB was not found at $adb." }

try {
    if (-not $SkipBuild) {
        Set-Stage 5 "Building PocketTrade against $ApiUrl..."
        Push-Location $mobileRoot
        try {
            & $flutter build apk --debug --split-per-abi "--dart-define=API_URL=$ApiUrl"
            if ($LASTEXITCODE -ne 0) { throw "Flutter build failed with exit code $LASTEXITCODE." }
        }
        finally { Pop-Location }
    }

    if (-not (Test-Path -LiteralPath $apk)) { throw "APK was not found at $apk. Run without -SkipBuild." }
    Set-Stage 70 "Finding your phone..."
    $serial = Get-ConnectedDevice
    Set-Stage 80 "Installing APK on $serial..."
    & $adb -s $serial install -r $apk | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "APK install failed with exit code $LASTEXITCODE." }
    Set-Stage 95 "Launching PocketTrade..."
    & $adb -s $serial shell monkey -p com.pocket_trade -c android.intent.category.LAUNCHER 1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "App launch failed with exit code $LASTEXITCODE." }
    Set-Stage 100 "PocketTrade is installed and open."
}
finally {
    Write-Progress -Activity "PocketTrade Android build and install" -Completed
}
