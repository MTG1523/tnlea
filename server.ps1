$root = "C:\Users\mokaa\.gemini\antigravity-ide\scratch\tnea-counselling-app"
$port = 3001

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff2"= "font/woff2"
    ".woff" = "font/woff"
    ".ttf"  = "font/ttf"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  TNLEA App is LIVE!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login : http://localhost:$port/login.html" -ForegroundColor Green
Write-Host "  Home  : http://localhost:$port/home.html" -ForegroundColor Green
Write-Host "  App   : http://localhost:$port/index.html" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

# Auto-open the login page
Start-Process "http://localhost:$port/login.html"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    try {
        $urlPath = $req.Url.AbsolutePath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = "login.html" }

        $filePath = Join-Path $root ($urlPath -replace '/', '\')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $res.ContentLength64 = $body.Length
            $res.OutputStream.Write($body, 0, $body.Length)
        }
    } catch { $res.StatusCode = 500 }
    finally { $res.OutputStream.Close() }
}
