$transcript = "C:\Users\mokaa\.gemini\antigravity-ide\brain\ee34b4ab-bcaf-4202-afb1-ab82a34e1820\.system_generated\logs\transcript_full.jsonl"

Write-Host "Reading transcript..."
$content = Get-Content -Path $transcript -Raw

# Unescape newlines
$content = $content.Replace('\n', "`n").Replace('\r', "`r")

Write-Host "Extracting lines..."
$lines = $content -split "`n"

Write-Host "First 50 lines:"
for ($i = 0; $i -lt 50; $i++) {
    if ($i -lt $lines.Length) {
        Write-Host $lines[$i]
    }
}
