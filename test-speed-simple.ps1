# Simple Speed Test PowerShell Script
# Tests download and upload speeds using HTTP requests

param(
    [string]$BaseUrl = "http://localhost:5000"
)

Write-Host "🚀 Simple Speed Test - PowerShell Edition" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Test 1: Download Speed Test
Write-Host "📥 Testing Download Speed..." -ForegroundColor Yellow

$downloadUrls = @(
    "https://httpbin.org/stream-bytes/1000000",  # 1MB
    "https://httpbin.org/stream-bytes/5000000",  # 5MB
    "https://httpbin.org/stream-bytes/10000000"  # 10MB
)

$downloadResults = @()

foreach ($url in $downloadUrls) {
    try {
        Write-Host "   Testing: $url" -ForegroundColor Cyan
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 30
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        # Calculate speed in Mbps
        $sizeInBytes = $response.Content.Length
        $sizeInMbps = ($sizeInBytes * 8) / 1000000  # Convert to Mbps
        $speedMbps = $sizeInMbps / $duration
        
        $result = @{
            Url = $url
            SizeMB = [math]::Round($sizeInBytes / 1000000, 2)
            Duration = [math]::Round($duration, 2)
            SpeedMbps = [math]::Round($speedMbps, 2)
        }
        
        $downloadResults += $result
        
        Write-Host "      Size: $($result.SizeMB) MB" -ForegroundColor White
        Write-Host "      Duration: $($result.Duration) seconds" -ForegroundColor White
        Write-Host "      Speed: $($result.SpeedMbps) Mbps" -ForegroundColor Green
        
    } catch {
        Write-Host "      ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 2: Upload Speed Test
Write-Host ""
Write-Host "📤 Testing Upload Speed..." -ForegroundColor Yellow

$uploadUrls = @(
    "https://httpbin.org/post",
    "https://httpbin.org/post",
    "https://httpbin.org/post"
)

$uploadSizes = @(1000000, 5000000, 10000000)  # 1MB, 5MB, 10MB
$uploadResults = @()

for ($i = 0; $i -lt $uploadUrls.Length; $i++) {
    try {
        $url = $uploadUrls[$i]
        $size = $uploadSizes[$i]
        $data = "x" * $size  # Create test data
        
        Write-Host "   Testing: $url ($([math]::Round($size / 1000000, 2)) MB)" -ForegroundColor Cyan
        
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri $url -Method POST -Body $data -ContentType "text/plain" -TimeoutSec 30
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        # Calculate speed in Mbps
        $sizeInMbps = ($size * 8) / 1000000  # Convert to Mbps
        $speedMbps = $sizeInMbps / $duration
        
        $result = @{
            Url = $url
            SizeMB = [math]::Round($size / 1000000, 2)
            Duration = [math]::Round($duration, 2)
            SpeedMbps = [math]::Round($speedMbps, 2)
        }
        
        $uploadResults += $result
        
        Write-Host "      Size: $($result.SizeMB) MB" -ForegroundColor White
        Write-Host "      Duration: $($result.Duration) seconds" -ForegroundColor White
        Write-Host "      Speed: $($result.SpeedMbps) Mbps" -ForegroundColor Green
        
    } catch {
        Write-Host "      ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Ping Test
Write-Host ""
Write-Host "🏓 Testing Ping..." -ForegroundColor Yellow

$pingHosts = @("8.8.8.8", "1.1.1.1", "google.com")
$pingResults = @()

foreach ($host in $pingHosts) {
    try {
        Write-Host "   Testing: $host" -ForegroundColor Cyan
        $ping = Test-Connection -ComputerName $host -Count 4 -Quiet
        if ($ping) {
            $pingTime = (Test-Connection -ComputerName $host -Count 1).ResponseTime
            $result = @{
                Host = $host
                Ping = $pingTime
                Status = "Success"
            }
            $pingResults += $result
            Write-Host "      Ping: $pingTime ms" -ForegroundColor Green
        } else {
            Write-Host "      ❌ Failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "      ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Summary
Write-Host ""
Write-Host "📊 Speed Test Summary" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

if ($downloadResults.Count -gt 0) {
    $avgDownload = ($downloadResults | Measure-Object -Property SpeedMbps -Average).Average
    $maxDownload = ($downloadResults | Measure-Object -Property SpeedMbps -Maximum).Maximum
    $minDownload = ($downloadResults | Measure-Object -Property SpeedMbps -Minimum).Minimum
    
    Write-Host "📥 Download Speed:" -ForegroundColor Cyan
    Write-Host "   Average: $([math]::Round($avgDownload, 2)) Mbps" -ForegroundColor White
    Write-Host "   Maximum: $([math]::Round($maxDownload, 2)) Mbps" -ForegroundColor White
    Write-Host "   Minimum: $([math]::Round($minDownload, 2)) Mbps" -ForegroundColor White
}

if ($uploadResults.Count -gt 0) {
    $avgUpload = ($uploadResults | Measure-Object -Property SpeedMbps -Average).Average
    $maxUpload = ($uploadResults | Measure-Object -Property SpeedMbps -Maximum).Maximum
    $minUpload = ($uploadResults | Measure-Object -Property SpeedMbps -Minimum).Minimum
    
    Write-Host "📤 Upload Speed:" -ForegroundColor Cyan
    Write-Host "   Average: $([math]::Round($avgUpload, 2)) Mbps" -ForegroundColor White
    Write-Host "   Maximum: $([math]::Round($maxUpload, 2)) Mbps" -ForegroundColor White
    Write-Host "   Minimum: $([math]::Round($minUpload, 2)) Mbps" -ForegroundColor White
}

if ($pingResults.Count -gt 0) {
    $avgPing = ($pingResults | Measure-Object -Property Ping -Average).Average
    Write-Host "🏓 Ping:" -ForegroundColor Cyan
    Write-Host "   Average: $([math]::Round($avgPing, 2)) ms" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Speed Test Complete!" -ForegroundColor Green

# Return results as JSON for API-like response
$finalResult = @{
    success = $true
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    download = if ($downloadResults.Count -gt 0) { [math]::Round(($downloadResults | Measure-Object -Property SpeedMbps -Average).Average, 2) } else { $null }
    upload = if ($uploadResults.Count -gt 0) { [math]::Round(($uploadResults | Measure-Object -Property SpeedMbps -Average).Average, 2) } else { $null }
    ping = if ($pingResults.Count -gt 0) { [math]::Round(($pingResults | Measure-Object -Property Ping -Average).Average, 2) } else { $null }
    method = "httpbin-speed-test"
    details = @{
        downloadTests = $downloadResults
        uploadTests = $uploadResults
        pingTests = $pingResults
    }
}

Write-Host ""
Write-Host "📋 JSON Response:" -ForegroundColor Magenta
$finalResult | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray

