# Speed Test PowerShell Script
# Tests the Casaway Backend Speed Test API

param(
    [string]$BaseUrl = "http://localhost:5000",
    [string]$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NzE0ZWUxNDJkMTllMzk3YWVlYTVjNSIsImlhdCI6MTc1NjQwMzQ3NCwiZXhwIjoxNzU3MDA4Mjc0fQ.Qph3eOedx1UjGSWIJi2vLHEu8jr7tTBMHXRtFlftzoY"
)

Write-Host "🚀 Casaway Speed Test - PowerShell Edition" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Test 1: Basic Speed Test
Write-Host "📡 Testing LibreSpeed API..." -ForegroundColor Yellow
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/speedtest" -Method POST -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $Token"
    } -Body "{}"
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    Write-Host "✅ Speed Test Completed Successfully!" -ForegroundColor Green
    Write-Host "⏱️  Response Time: $([math]::Round($duration, 2)) seconds" -ForegroundColor Cyan
    Write-Host ""
    
    # Display results in a nice format
    Write-Host "📊 Speed Test Results:" -ForegroundColor Magenta
    Write-Host "   Success: $($response.success)" -ForegroundColor White
    Write-Host "   Server: $($response.server)" -ForegroundColor White
    Write-Host "   Timestamp: $($response.timestamp)" -ForegroundColor White
    
    if ($response.ping) {
        Write-Host "   Ping: $($response.ping) ms" -ForegroundColor Green
    }
    if ($response.jitter) {
        Write-Host "   Jitter: $($response.jitter) ms" -ForegroundColor Green
    }
    if ($response.download) {
        Write-Host "   Download: $($response.download) Mbps" -ForegroundColor Green
    }
    if ($response.upload) {
        Write-Host "   Upload: $($response.upload) Mbps" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📋 Full Response:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Speed Test Failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Response: $errorBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔍 Testing Multiple Requests..." -ForegroundColor Yellow

# Test 2: Multiple Concurrent Requests
$concurrentTests = 3
Write-Host "Running $concurrentTests concurrent speed tests..." -ForegroundColor Cyan

$jobs = @()
for ($i = 1; $i -le $concurrentTests; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($url, $token, $testNum)
        try {
            $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $token"
            } -Body "{}"
            return @{
                TestNumber = $testNum
                Success = $true
                Response = $response
                Error = $null
            }
        } catch {
            return @{
                TestNumber = $testNum
                Success = $false
                Response = $null
                Error = $_.Exception.Message
            }
        }
    } -ArgumentList "$BaseUrl/api/speedtest", $Token, $i
}

# Wait for all jobs to complete
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

Write-Host ""
Write-Host "📈 Concurrent Test Results:" -ForegroundColor Magenta
foreach ($result in $results) {
    if ($result.Success) {
        Write-Host "   Test $($result.TestNumber): ✅ Success" -ForegroundColor Green
        if ($result.Response.download) {
            Write-Host "      Download: $($result.Response.download) Mbps" -ForegroundColor White
        }
        if ($result.Response.upload) {
            Write-Host "      Upload: $($result.Response.upload) Mbps" -ForegroundColor White
        }
    } else {
        Write-Host "   Test $($result.TestNumber): ❌ Failed - $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Performance Summary:" -ForegroundColor Magenta
$successfulTests = $results | Where-Object { $_.Success }
$failedTests = $results | Where-Object { -not $_.Success }

Write-Host "   Successful Tests: $($successfulTests.Count)/$concurrentTests" -ForegroundColor Green
Write-Host "   Failed Tests: $($failedTests.Count)/$concurrentTests" -ForegroundColor Red

if ($successfulTests.Count -gt 0) {
    $downloadSpeeds = $successfulTests | Where-Object { $_.Response.download } | ForEach-Object { $_.Response.download }
    $uploadSpeeds = $successfulTests | Where-Object { $_.Response.upload } | ForEach-Object { $_.Response.upload }
    
    if ($downloadSpeeds.Count -gt 0) {
        $avgDownload = ($downloadSpeeds | Measure-Object -Average).Average
        $maxDownload = ($downloadSpeeds | Measure-Object -Maximum).Maximum
        $minDownload = ($downloadSpeeds | Measure-Object -Minimum).Minimum
        
        Write-Host "   Download Speed (Mbps):" -ForegroundColor Cyan
        Write-Host "      Average: $([math]::Round($avgDownload, 2))" -ForegroundColor White
        Write-Host "      Maximum: $([math]::Round($maxDownload, 2))" -ForegroundColor White
        Write-Host "      Minimum: $([math]::Round($minDownload, 2))" -ForegroundColor White
    }
    
    if ($uploadSpeeds.Count -gt 0) {
        $avgUpload = ($uploadSpeeds | Measure-Object -Average).Average
        $maxUpload = ($uploadSpeeds | Measure-Object -Maximum).Maximum
        $minUpload = ($uploadSpeeds | Measure-Object -Minimum).Minimum
        
        Write-Host "   Upload Speed (Mbps):" -ForegroundColor Cyan
        Write-Host "      Average: $([math]::Round($avgUpload, 2))" -ForegroundColor White
        Write-Host "      Maximum: $([math]::Round($maxUpload, 2))" -ForegroundColor White
        Write-Host "      Minimum: $([math]::Round($minUpload, 2))" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "✨ Speed Test Complete!" -ForegroundColor Green
