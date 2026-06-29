param(
  [string]$ApiBase = "https://api.twobrothersfreight.com/api",
  [string]$Origin = "https://db.twobrothersfreight.com"
)

function Test-UploadSize {
  param([int]$Bytes, [string]$Label)

  $path = Join-Path $env:TEMP "upload-verify-$Bytes.bin"
  [IO.File]::WriteAllBytes($path, [byte[]]::new($Bytes))

  $headersFile = Join-Path $env:TEMP "upload-verify-headers-$Bytes.txt"
  $bodyFile = Join-Path $env:TEMP "upload-verify-body-$Bytes.txt"

  $code = curl.exe -s -o $bodyFile -w "%{http_code}" -X POST "$ApiBase/my-files/upload" `
    -H "Origin: $Origin" `
    -H "Content-Type: application/octet-stream" `
    --data-binary "@$path" `
    -D $headersFile

  $headers = Get-Content $headersFile -Raw
  $body = Get-Content $bodyFile -Raw

  [PSCustomObject]@{
    Label = $Label
    Bytes = $Bytes
    Status = $code
    HasAppLayer = $headers -match 'X-App-Layer:\s*express'
    IsNginx413Html = $body -match 'nginx/1\.31\.2' -and $code -eq '413'
    Headers = $headers
  }
}

Write-Host "=== Health ==="
curl.exe -sI "$ApiBase/health" | Select-Object -First 8

Write-Host "`n=== Upload threshold tests ==="
$small = Test-UploadSize -Bytes 500000 -Label "500KB"
$edge = Test-UploadSize -Bytes 1048576 -Label "1MiB"
$over = Test-UploadSize -Bytes 1048577 -Label "1MiB+1B"
$twoMb = Test-UploadSize -Bytes 2097152 -Label "2MiB"

$small, $edge, $over, $twoMb | Format-Table Label, Bytes, Status, HasAppLayer, IsNginx413Html

if ($twoMb.IsNginx413Html) {
  Write-Error "2MB upload still blocked by nginx. Set client_max_body_size 50M in the ACTIVE nginx vhost for api.twobrothersfreight.com, then reload nginx."
  exit 1
}

if (-not $twoMb.HasAppLayer) {
  Write-Error "2MB upload did not reach Express (missing X-App-Layer header)."
  exit 1
}

Write-Host "PASS: 2MB upload reaches Express (HTTP $($twoMb.Status))."
