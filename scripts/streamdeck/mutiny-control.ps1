# mutiny-control.ps1
# Sends a command to the Mutiny Stream Deck control server.
#
# Usage (from Stream Deck "System: Open" or "Run" action):
#   powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command toggle-mute
#   powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command toggle-deafen
#   powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command disconnect
#   powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command focus
#   powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command ping

param (
    [Parameter(Mandatory = $true)]
    [ValidateSet("toggle-mute", "mute", "toggle-deafen", "deafen", "disconnect", "leave", "focus", "ping")]
    [string]$Command
)

$Port    = 7423
$BaseUrl = "http://127.0.0.1:$Port"
$Url     = "$BaseUrl/$Command"

try {
    $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "OK: $($response | ConvertTo-Json -Compress)"
    exit 0
} catch {
    $code = $_.Exception.Response?.StatusCode?.value__
    if ($null -eq $code) {
        Write-Warning "Mutiny control server not reachable (is Mutiny running?)"
    } else {
        Write-Warning "Mutiny returned HTTP $code for /$Command"
    }
    exit 1
}
