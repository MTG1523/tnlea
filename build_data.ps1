$transcript = "C:\Users\mokaa\.gemini\antigravity-ide\brain\ee34b4ab-bcaf-4202-afb1-ab82a34e1820\.system_generated\logs\transcript_full.jsonl"
$output = "C:\Users\mokaa\.gemini\antigravity-ide\scratch\tnea-counselling-app\data.js"

Write-Host "Reading transcript..."
$content = Get-Content -Path $transcript -Raw

# Since JSON might have escaped newlines, let's unescape them to make it easier to parse
$content = $content -replace '\\n', "`n" -replace '\\r', "`r"

Write-Host "Extracting lines..."
$lines = $content -split "`n"

$colleges = @()
$currentCollegeCode = $null
$currentCollegeName = $null

Write-Host "Parsing data..."
foreach ($line in $lines) {
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    # Match College: e.g. "1304 Easwari Engineering College..."
    if ($line -match '^(\d{4})\s+(.+)$') {
        # It might be a college
        $code = $matches[1]
        $name = $matches[2]
        
        # Branch lines usually don't start with 4 digits unless it's a code, but codes are usually 4 digits.
        # Wait, branch lines start with 2 letters.
        $currentCollegeCode = $code
        # Escape quotes in name
        $currentCollegeName = $name -replace '"', '\"'
    }
    # Match Branch: e.g. "AD ARTIFICIAL INTELLIGENCE AND DATA SCIENCE 109"
    elseif ($line -match '^([A-Z]{2})\s+(.+)\s+(\d+)$') {
        if ($currentCollegeCode -ne $null) {
            $branchCode = $matches[1]
            $seats = $matches[3]
            $branchName = $matches[2].Trim() -replace '"', '\"'
            
            $colleges += "{ code: `"$currentCollegeCode`", name: `"$currentCollegeName`", branchCode: `"$branchCode`", branchName: `"$branchName`", seats: $seats }"
        }
    }
}

Write-Host "Found $($colleges.Count) branches."

if ($colleges.Count -gt 0) {
    $jsContent = "const collegesData = [`n  " + ($colleges -join ",`n  ") + "`n];"
    Set-Content -Path $output -Value $jsContent -Encoding UTF8
    Write-Host "Successfully generated data.js!"
} else {
    Write-Host "No data parsed."
}
