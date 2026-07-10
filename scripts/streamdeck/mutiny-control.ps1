# mutiny-control.ps1
# Sends an authenticated command to the Mutiny Stream Deck control server.
param (
    [Parameter(Mandatory = $true)]
    [ValidateSet("toggle-mute", "mute", "toggle-deafen", "deafen", "disconnect", "leave", "focus", "ping")]
    [string]$Command,
    [string]$TokenPath = (Join-Path $env:APPDATA "Mutiny\streamdeck-token")
)

$Port = 7423
$Url = "http://127.0.0.1:$Port/$Command"

try {
    if ($Command -eq "ping") {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction Stop
    } else {
        if (-not (Test-Path -LiteralPath $TokenPath)) {
            throw "Mutiny token file not found. Start Mutiny once, or pass -TokenPath."
        }
        $token = (Get-Content -LiteralPath $TokenPath -Raw).Trim()
        $headers = @{ Authorization = "Bearer $token" }
        $response = Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -TimeoutSec 3 -ErrorAction Stop
    }
    Write-Host "OK: $($response | ConvertTo-Json -Compress)"
    exit 0
} catch {
    $code = $_.Exception.Response?.StatusCode?.value__
    if ($null -eq $code) {
        Write-Warning $_.Exception.Message
    } else {
        Write-Warning "Mutiny returned HTTP $code for /$Command"
    }
    exit 1
}
