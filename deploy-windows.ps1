# PowerShell script to deploy on Windows
# This works around a wrangler bug with WASM files on Windows

$ErrorActionPreference = "Stop"

# Get the deploy directory that wrangler creates
$wasmSource = "node_modules\.pnpm\next@16.0.5_@babel+core@7.28.5_react-dom@19.2.0_react@19.2.0__react@19.2.0\node_modules\next\dist\compiled\@vercel\og\resvg.wasm"
$wasmHash = "77d9faebf7af9e421806970ce10a58e9d83116d7"
$wasmFileName = "${wasmHash}-resvg.wasm"

Write-Host "🚀 Starting deployment with WASM workaround..." -ForegroundColor Cyan

# Start wrangler deploy in background to create the temp directory
$job = Start-Job -ScriptBlock {
    param($projectPath)
    Set-Location $projectPath
    npx wrangler deploy 2>&1
} -ArgumentList (Get-Location).Path

# Wait a bit for wrangler to create the temp directory
Start-Sleep -Seconds 3

# Find and populate the deploy temp directory
$attempts = 0
$maxAttempts = 30
$deployed = $false

while ($attempts -lt $maxAttempts) {
    $deployDirs = Get-ChildItem -Path ".wrangler\tmp" -Directory -Filter "deploy-*" -ErrorAction SilentlyContinue
    
    foreach ($dir in $deployDirs) {
        $wasmDest = Join-Path $dir.FullName $wasmFileName
        if (-not (Test-Path $wasmDest)) {
            Write-Host "📁 Found deploy directory: $($dir.Name)" -ForegroundColor Yellow
            Write-Host "📄 Copying WASM file..." -ForegroundColor Yellow
            Copy-Item $wasmSource $wasmDest -Force
            Write-Host "✅ WASM file copied successfully!" -ForegroundColor Green
        }
    }
    
    # Check if job is still running
    if ($job.State -ne "Running") {
        break
    }
    
    $attempts++
    Start-Sleep -Milliseconds 500
}

# Get the job output
$output = Receive-Job -Job $job -Wait
Remove-Job -Job $job

# Display output
Write-Host $output

if ($output -match "error" -and $output -notmatch "Success") {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Deployment process completed" -ForegroundColor Green
}
