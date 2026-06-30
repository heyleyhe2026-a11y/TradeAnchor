# Frontend-only deploy pack — no backend, no nginx/gateway config, no docker-compose
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$archive = Join-Path $root "tradewise_frontend_only.tar.gz"
if (Test-Path $archive) { Remove-Item $archive -Force }

$items = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "Dockerfile.frontend",
    ".dockerignore",
    "k8s/nginx.conf",
    "packages/frontend",
    "packages/shared",
    "scripts/deploy-frontend-only.sh"
)

$tarArgs = @("-czf", $archive)
foreach ($ex in @("node_modules", "dist", ".env", "*.log", "coverage", "__tests__", "uploads")) {
    $tarArgs += "--exclude=$ex"
}
$tarArgs += $items

& tar @tarArgs

$size = (Get-Item $archive).Length
Write-Host "Created $archive ($([math]::Round($size/1MB, 2)) MB)"
