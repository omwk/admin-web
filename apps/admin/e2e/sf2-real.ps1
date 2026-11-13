param([Parameter(Mandatory=$true)][string]$BackendRoot, [string]$Origin = 'http://127.0.0.1:5666', [string]$RedisAddress = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$script:Root = (Resolve-Path -LiteralPath $BackendRoot).Path
$script:Artifacts = Join-Path ([IO.Path]::GetTempPath()) ('s3-smoke-' + [Guid]::NewGuid().ToString('N'))
$script:Schema = 's3_smoke_' + [Guid]::NewGuid().ToString('N')
$script:Deadline = [DateTime]::UtcNow.AddMinutes(5)
$script:Processes = New-Object 'Collections.Generic.List[object]'
$script:Secrets = New-Object 'Collections.Generic.List[string]'
$script:HTTP = New-Object 'Collections.Generic.List[object]'
$script:ChildEnv = @{}
$script:SchemaCreated = $false
$script:RedisClaimed = $false
$DatabaseUrl = ''
$RedisAddr = $RedisAddress
$KeepArtifacts = $false
$exitCode = 0
$cleanupOK = $false
$revision = (& git -C $script:Root rev-parse HEAD)
try {
    New-Item -ItemType Directory -Path $script:Artifacts | Out-Null
    . (Join-Path $script:Root 'scripts/smoke/support.ps1')
    . (Join-Path $script:Root 'scripts/smoke/process.ps1')
    . (Join-Path $script:Root 'scripts/smoke/setup.ps1')
    Initialize-Smoke
    $listener = New-Object Net.Sockets.TcpListener -ArgumentList ([Net.IPAddress]::Loopback), 0
    $listener.Start()
    try { $port = $listener.LocalEndpoint.Port } finally { $listener.Stop() }
    $script:ChildEnv.CH_APP_HTTP_ADDR = "127.0.0.1:$port"
    Invoke-SmokeNative (Join-Path $script:Artifacts 'cli.exe') @('seed') 'SF-2 seed' | Out-Null
    $script:API = Start-SmokeProcess (Join-Path $script:Artifacts 'api.exe') @() 'api'
    $script:Worker = Start-SmokeProcess (Join-Path $script:Artifacts 'worker.exe') @() 'worker'
    $script:ChildEnv.SF2_BACKEND = "http://127.0.0.1:$port"
    $script:ChildEnv.SF2_ORIGIN = $Origin
    $script:ChildEnv.SF2_ADMIN_PASSWORD = $script:Password
    $script:ChildEnv.SF2_SMOKE_HELPER = $script:Helper
    $script:ChildEnv.SF2_BACKEND_REV = (& git -C $script:Root rev-parse HEAD)
    $result = Invoke-SmokeNative (Get-Command node).Source @((Join-Path $PSScriptRoot 'sf2-real.mjs')) 'SF-2 browser acceptance'
    Write-Host $result.Trim()
} catch {
    $exitCode = 1
    Write-Host $_.Exception.Message
} finally {
    if (Get-Command Clear-Smoke -ErrorAction SilentlyContinue) {
        try {
            $script:Deadline = [DateTime]::UtcNow.AddSeconds(45)
            Clear-Smoke
            Remove-SmokeArtifacts
            $cleanupOK = $true
        } catch { $exitCode = 1; Write-Host $_.Exception.Message }
    }
    $evidence = Join-Path $PSScriptRoot '../../../docs/evidence/sf-2/real-runtime.json'
    @{ source='real-isolated-backend'; schema=$script:Schema; backend_revision=$revision; cleanup_ok=$cleanupOK; exit_code=$exitCode } | ConvertTo-Json | Set-Content -LiteralPath $evidence -Encoding utf8
    foreach ($entry in $script:Processes) { $entry.Job.Dispose(); $entry.Process.Dispose() }
}
exit $exitCode
