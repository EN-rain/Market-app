param(
  [string]$BaseUrl = "http://localhost:3000",
  [switch]$SkipApiE2E,
  [switch]$SkipApk,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $Root "backend"
$AdminDir = Join-Path $Root "admin"
$MobileDir = Join-Path $Root "mobile"
$ResultsDir = Join-Path $Root ("qa-results\{0:yyyyMMdd-HHmmss}" -f (Get-Date))
$Summary = New-Object System.Collections.Generic.List[object]
$StartedBackend = $null

New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

$FlutterBin = "C:\src\flutter\bin"
if (Test-Path $FlutterBin) {
  $env:Path = "$FlutterBin;$env:Path"
}

if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "development"
}
if (-not $env:ADMIN_BOOTSTRAP_EMAIL) {
  $env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.com"
}
if (-not $env:ADMIN_BOOTSTRAP_PASSWORD) {
  $env:ADMIN_BOOTSTRAP_PASSWORD = "TestAdminPass123!"
}

function Write-Line($Message) {
  Write-Host $Message
}

function Add-Result($Name, $Status, $Seconds, $Log, $ErrorMessage = "") {
  $Summary.Add([pscustomobject]@{
    Step = $Name
    Status = $Status
    Seconds = [math]::Round($Seconds, 1)
    Log = $Log
    Error = $ErrorMessage
  }) | Out-Null
}

function Invoke-Step($Name, [scriptblock]$Action) {
  $safeName = ($Name -replace '[^a-zA-Z0-9._-]+', '-').Trim('-').ToLowerInvariant()
  $log = Join-Path $ResultsDir "$safeName.log"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  Write-Line ""
  Write-Line "==> $Name"
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $Action *>&1 | Tee-Object -FilePath $log -Append
    $sw.Stop()
    Add-Result $Name "PASS" $sw.Elapsed.TotalSeconds $log
    Write-Line "PASS: $Name"
  } catch {
    $sw.Stop()
    $message = $_.Exception.Message
    $message | Tee-Object -FilePath $log -Append | Out-Host
    Add-Result $Name "FAIL" $sw.Elapsed.TotalSeconds $log $message
    Write-Line "FAIL: $Name"
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Invoke-External($Command, $WorkingDirectory) {
  Push-Location $WorkingDirectory
  try {
    & cmd.exe /d /s /c $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $Command"
    }
  } finally {
    Pop-Location
  }
}

function Test-HttpOk($Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Wait-ForHttp($Url, $Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk $Url) {
      return $true
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Ensure-NodeModules($Directory) {
  if (-not (Test-Path (Join-Path $Directory "node_modules"))) {
    Invoke-External "npm ci" $Directory
  }
}

function Start-BackendIfNeeded {
  $healthUrl = "$BaseUrl/health"
  if (Test-HttpOk $healthUrl) {
    Write-Line "Using existing backend at $BaseUrl"
    return $null
  }

  Write-Line "Starting local backend at $BaseUrl"
  Ensure-NodeModules $BackendDir
  Invoke-External "npm run prisma:generate" $BackendDir
  Invoke-External "npm run seed" $BackendDir

  $stdout = Join-Path $ResultsDir "backend-server.stdout.log"
  $stderr = Join-Path $ResultsDir "backend-server.stderr.log"
  $process = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @("dist/main.js") `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru

  if (-not (Wait-ForHttp $healthUrl 90)) {
    throw "Backend did not become healthy at $healthUrl. Logs: $stdout $stderr"
  }

  Write-Line "Started backend pid=$($process.Id)"
  return $process
}

function Invoke-ApiE2E {
  $email = "qa-{0}@example.com" -f ([guid]::NewGuid().ToString("N").Substring(0, 10))
  $adminEmail = $env:ADMIN_BOOTSTRAP_EMAIL
  $adminPassword = $env:ADMIN_BOOTSTRAP_PASSWORD
  $photo = Join-Path $ResultsDir "qa-photo.jpg"
  [IO.File]::WriteAllBytes($photo, [byte[]](0xff, 0xd8, 0xff, 0xe0, 0x50, 0x51, 0x41, 0xff, 0xd9))

  Write-Line "Health"
  Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/health" -TimeoutSec 10 | Out-Null

  $password = "QaPass123!"

  Write-Line "Register seller account"
  $otp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType "application/json" -Body (@{ email = $email; password = $password } | ConvertTo-Json)
  if (-not $otp.devCode) {
    throw "Register response did not include devCode. Run against NODE_ENV=development or provide a test email inbox flow."
  }

  Write-Line "Verify seller account"
  $auth = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/verify-otp" -ContentType "application/json" -Body (@{ email = $email; code = $otp.devCode } | ConvertTo-Json)
  if (-not $auth.accessToken -or -not $auth.refreshToken) {
    throw "Auth response missing accessToken or refreshToken"
  }
  if ($auth.user.displayName -ne ($email.Split("@")[0])) {
    throw "Display name was not derived from email prefix"
  }

  Write-Line "Password sign in"
  $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body (@{ email = $email; password = $password } | ConvertTo-Json)
  if (-not $login.accessToken -or -not $login.refreshToken) {
    throw "Login response missing accessToken or refreshToken"
  }

  Write-Line "Create listing with photo"
  $listingJson = & curl.exe -fsS -X POST "$BaseUrl/listings" `
    -H "Authorization: Bearer $($auth.accessToken)" `
    -F "photos=@$photo" `
    -F "brand=Apple" `
    -F "model=iPhone 14" `
    -F "price=699" `
    -F "condition=good" `
    -F "storage=128GB" `
    -F "colour=Midnight" `
    -F "location=New York, NY" `
    -F "description=PocketTrade automated QA listing."
  if ($LASTEXITCODE -ne 0) {
    throw "Listing creation curl failed with exit code $LASTEXITCODE"
  }
  $listing = $listingJson | ConvertFrom-Json
  if (-not $listing.id) {
    throw "Listing creation response missing id"
  }

  Write-Line "Admin login and approve listing"
  $admin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/admin/auth/login" -ContentType "application/json" -Body (@{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json)
  if (-not $admin.accessToken) {
    throw "Admin login response missing accessToken"
  }
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/admin/listings/$($listing.id)/approve" -Headers @{ Authorization = "Bearer $($admin.accessToken)" } | Out-Null

  Write-Line "Search listings"
  $search = Invoke-RestMethod -Method Get -Uri "$BaseUrl/listings?brand=Apple&model=iPhone&sort=relevant"
  if ($null -eq $search) {
    throw "Search response was empty"
  }

  Write-Line "Create buyer account"
  $buyerEmail = "qa-buyer-{0}@example.com" -f ([guid]::NewGuid().ToString("N").Substring(0, 10))
  $buyerPassword = "BuyerPass123!"
  $buyerOtp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType "application/json" -Body (@{ email = $buyerEmail; password = $buyerPassword } | ConvertTo-Json)
  if (-not $buyerOtp.devCode) {
    throw "Buyer register response did not include devCode"
  }
  $buyerAuth = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/verify-otp" -ContentType "application/json" -Body (@{ email = $buyerEmail; code = $buyerOtp.devCode } | ConvertTo-Json)
  if (-not $buyerAuth.accessToken -or -not $buyerAuth.refreshToken) {
    throw "Buyer auth response missing accessToken or refreshToken"
  }

  Write-Line "Forgot and reset password"
  $forgot = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/forgot-password" -ContentType "application/json" -Body (@{ email = $buyerEmail } | ConvertTo-Json)
  if (-not $forgot.devCode) {
    throw "Forgot password response did not include devCode"
  }
  $reset = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/reset-password" -ContentType "application/json" -Body (@{ email = $buyerEmail; code = $forgot.devCode; password = "BuyerPass456!" } | ConvertTo-Json)
  if (-not $reset.accessToken -or -not $reset.refreshToken) {
    throw "Reset password response missing accessToken or refreshToken"
  }
  $buyerAuth = $reset

  Write-Line "Favorite listing"
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/favorites" -Headers @{ Authorization = "Bearer $($buyerAuth.accessToken)" } -ContentType "application/json" -Body (@{ listingId = [int]$listing.id } | ConvertTo-Json) | Out-Null

  Write-Line "Create conversation"
  $conversation = Invoke-RestMethod -Method Post -Uri "$BaseUrl/conversations" -Headers @{ Authorization = "Bearer $($buyerAuth.accessToken)" } -ContentType "application/json" -Body (@{ listingId = [int]$listing.id } | ConvertTo-Json)
  if (-not $conversation.id) {
    throw "Conversation response missing id"
  }

  Write-Line "Send message"
  $message = Invoke-RestMethod -Method Post -Uri "$BaseUrl/conversations/$($conversation.id)/messages" -Headers @{ Authorization = "Bearer $($buyerAuth.accessToken)" } -ContentType "application/json" -Body (@{ content = "Automated QA message" } | ConvertTo-Json)
  if (-not $message.id) {
    throw "Message response missing id"
  }

  Write-Line "Report listing/conversation"
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/reports" -Headers @{ Authorization = "Bearer $($buyerAuth.accessToken)" } -ContentType "application/json" -Body (@{
      reportedListingId = [int]$listing.id
      conversationId = [int]$conversation.id
      reason = "scam"
      details = "Automated QA report"
    } | ConvertTo-Json) | Out-Null

  Write-Line "Logout"
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/logout" -Headers @{ Authorization = "Bearer $($buyerAuth.accessToken)" } -ContentType "application/json" -Body (@{ refreshToken = $buyerAuth.refreshToken } | ConvertTo-Json) | Out-Null
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/logout" -Headers @{ Authorization = "Bearer $($login.accessToken)" } -ContentType "application/json" -Body (@{ refreshToken = $login.refreshToken } | ConvertTo-Json) | Out-Null
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/logout" -Headers @{ Authorization = "Bearer $($auth.accessToken)" } -ContentType "application/json" -Body (@{ refreshToken = $auth.refreshToken } | ConvertTo-Json) | Out-Null

  Write-Line "API E2E passed: listing=$($listing.id) conversation=$($conversation.id)"
}

try {
  Invoke-Step "Preflight tools" {
    foreach ($tool in @("node", "npm", "git", "flutter")) {
      $cmd = Get-Command $tool -ErrorAction SilentlyContinue
      if (-not $cmd) {
        throw "Missing required tool on PATH: $tool"
      }
      Write-Line "$tool -> $($cmd.Source)"
    }
    node --version
    npm --version
    flutter --version
  }

  Invoke-Step "Backend dependencies" { Ensure-NodeModules $BackendDir }
  Invoke-Step "Backend Prisma generate" { Invoke-External "npm run prisma:generate" $BackendDir }
  Invoke-Step "Backend tests" { Invoke-External "npm test" $BackendDir }
  Invoke-Step "Backend build" { Invoke-External "npm run build" $BackendDir }

  Invoke-Step "Admin dependencies" { Ensure-NodeModules $AdminDir }
  Invoke-Step "Admin build" { Invoke-External "npm run build" $AdminDir }

  Invoke-Step "Mobile pub get" { Invoke-External "flutter pub get" $MobileDir }
  Invoke-Step "Mobile analyze" { Invoke-External "flutter analyze" $MobileDir }
  if (-not $SkipApk) {
    Invoke-Step "Mobile debug APK" { Invoke-External "flutter build apk --debug" $MobileDir }
  }

  if (-not $SkipApiE2E) {
    Invoke-Step "Local API E2E" {
      $script:StartedBackend = Start-BackendIfNeeded
      Invoke-ApiE2E
    }
  }
} finally {
  if ($StartedBackend -and -not $StartedBackend.HasExited) {
    Write-Line "Stopping backend pid=$($StartedBackend.Id)"
    Stop-Process -Id $StartedBackend.Id -Force -ErrorAction SilentlyContinue
  }

  $summaryPath = Join-Path $ResultsDir "summary.json"
  $Summary | ConvertTo-Json -Depth 4 | Set-Content -Path $summaryPath -Encoding UTF8

  Write-Line ""
  Write-Line "QA SUMMARY"
  Write-Line "=========="
  $Summary | Format-Table Step, Status, Seconds -AutoSize | Out-String | Write-Host
  Write-Line "Logs: $ResultsDir"

  $failed = @($Summary | Where-Object { $_.Status -ne "PASS" })
  if ($failed.Count -gt 0) {
    Write-Line "Failed steps:"
    foreach ($item in $failed) {
      Write-Line "- $($item.Step): $($item.Error)"
      Write-Line "  log: $($item.Log)"
    }
    if (-not $NoPause) {
      Write-Line ""
      Read-Host "Press Enter to close"
    }
    exit 1
  }

  Write-Line "All automated QA steps passed."
  if (-not $NoPause) {
    Write-Line ""
    Read-Host "Press Enter to close"
  }
}
