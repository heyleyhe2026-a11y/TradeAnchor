# Lean pack for blog deploy: source only, exclude node_modules/dist and nginx config
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$archive = Join-Path $root "tradewise_blog_fe_be.tar.gz"
if (Test-Path $archive) { Remove-Item $archive -Force }

$items = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "Dockerfile.backend",
    "Dockerfile.frontend",
    "docker-compose.prod.yml",
    ".dockerignore",
    "k8s/nginx.conf",
    "packages/frontend",
    "packages/backend",
    "packages/shared",
    "scripts/deploy-blog-fe-be.sh"
)

# Build tar with exclusions via git archive style - use tar --exclude
$tarArgs = @("-czf", $archive)
foreach ($ex in @("node_modules", "dist", ".env", "*.log", "coverage", "__tests__")) {
    $tarArgs += "--exclude=$ex"
}
$tarArgs += $items

& tar @tarArgs

$size = (Get-Item $archive).Length
Write-Host "Created $archive ($([math]::Round($size/1MB, 2)) MB)"
tar -tzf $archive | Select-Object -First 8
Write-Host "..."
