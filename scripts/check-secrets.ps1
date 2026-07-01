# Scan tracked git files for common secret patterns before pushing to GitHub.
# Usage: powershell -File scripts/check-secrets.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "Checking for sensitive files and patterns..." -ForegroundColor Cyan

$failures = @()

# 1. Block tracked .env files (except .env.example)
$trackedEnv = git ls-files 2>$null | Where-Object { $_ -match '\.env(\.|$)' -and $_ -notmatch '\.env\.example$' }
if ($trackedEnv) {
    $failures += "Tracked env files (must not be in git):`n  $($trackedEnv -join "`n  ")"
}

# 2. Block common secret file names
$blockedNames = @('id_rsa', 'credentials.json', 'secrets.json', 'deploy.ps1')
foreach ($name in $blockedNames) {
    $hit = git ls-files 2>$null | Where-Object { $_ -like "*$name*" }
    if ($hit) { $failures += "Sensitive file tracked in git: $hit" }
}

# 3. Scan only tracked source files (never local .env)
$patterns = @(
    @{ Name = 'OpenAI key'; Regex = 'sk-[a-zA-Z0-9]{20,}' },
    @{ Name = 'GitHub token'; Regex = 'ghp_[a-zA-Z0-9]{20,}' },
    @{ Name = 'AWS access key'; Regex = 'AKIA[0-9A-Z]{16}' },
    @{ Name = 'Private key block'; Regex = 'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY' }
)

$trackedFiles = git ls-files 2>$null | Where-Object {
    $_ -notmatch '\.env(\.|$)|\.env\.example$|node_modules/|/dist/|pnpm-lock\.yaml|\.wasm|query_compiler'
}

foreach ($p in $patterns) {
    foreach ($file in $trackedFiles) {
        if (-not (Test-Path $file)) { continue }
        $hits = Select-String -Path $file -Pattern $p.Regex -ErrorAction SilentlyContinue
        foreach ($hit in $hits) {
            $failures += "$($p.Name) in $file`:$($hit.LineNumber)"
        }
    }
}

# 4. Hardcoded dev password (exclude this scanner script — it mentions the pattern by name)
$seedHits = git grep -n "Tradewise2026" -- ':!node_modules' ':!scripts/check-secrets.ps1' 2>$null
if ($seedHits) {
    $failures += "Hardcoded password 'Tradewise2026' in tracked files:`n  $($seedHits -join "`n  ")"
}

# 5. Real personal emails in seed/docs (exclude this scanner script)
$personalEmailHits = git grep -n "1213129762@qq.com" -- ':!scripts/check-secrets.ps1' 2>$null
if ($personalEmailHits) {
    $failures += "Personal email in tracked files:`n  $($personalEmailHits -join "`n  ")"
}

if ($failures.Count -eq 0) {
    Write-Host "OK — tracked files look safe. Review 'git status' then commit and push." -ForegroundColor Green
    exit 0
}

Write-Host "FAILED — fix these before pushing to GitHub:" -ForegroundColor Red
$failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
exit 1
