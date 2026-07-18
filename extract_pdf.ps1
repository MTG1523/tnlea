$transcriptPath = "C:\Users\mokaa\.gemini\antigravity-ide\brain\ee34b4ab-bcaf-4202-afb1-ab82a34e1820\.system_generated\logs\transcript_full.jsonl"
$outputFile = "C:\Users\mokaa\.gemini\antigravity-ide\scratch\tnea-counselling-app\pdf_content.txt"

$inPdf = $false
$pdfContent = @()

Get-Content -Path $transcriptPath | ForEach-Object {
    if ($_ -match '"content"\s*:\s*"(.*)"') {
        # This is very basic matching, but jsonl has escaped newlines "\n".
        # It's better to just write a fast .NET C# script inline in PowerShell, which handles JSON better.
    }
}
