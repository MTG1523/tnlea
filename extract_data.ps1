$transcriptPath = "C:\Users\mokaa\.gemini\antigravity-ide\brain\ee34b4ab-bcaf-4202-afb1-ab82a34e1820\.system_generated\logs\transcript_full.jsonl"
$outputFile = "C:\Users\mokaa\.gemini\antigravity-ide\scratch\tnea-counselling-app\data.txt"

foreach ($line in Get-Content -Path $transcriptPath) {
    if ($line -match '"type":"USER_INPUT"') {
        $json = $line | ConvertFrom-Json
        if ($null -ne $json -and $null -ne $json.content) {
            $content = $json.content
            $start = $content.IndexOf("==Start of PDF==")
            $end = $content.LastIndexOf("==End of PDF==")
            
            if ($start -ge 0 -and $end -gt $start) {
                $pdfText = $content.Substring($start, $end - $start)
                Set-Content -Path $outputFile -Value $pdfText
                Write-Output "Successfully extracted data.txt"
                break
            }
        }
    }
}
