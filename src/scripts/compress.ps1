Add-Type -AssemblyName System.Drawing

function Compress-Jpg($src, $dst, $quality) {
    $img = [System.Drawing.Image]::FromFile($src)
    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]$quality)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    
    $tempDst = $dst + '.tmp.jpg'
    $img.Save($tempDst, $codec, $encoderParams)
    $img.Dispose()
    Move-Item -Force $tempDst $dst
    $len = (Get-Item $dst).Length
    Write-Host "Compressed $dst -> $len bytes"
}

Compress-Jpg 'C:\Users\RAGINI\.gemini\antigravity-ide\brain\6e0a7fa5-ef33-4f72-bb19-98032ecbba87\scratch\product42\BKP06736.jpg' 'C:\Users\RAGINI\.gemini\antigravity-ide\brain\6e0a7fa5-ef33-4f72-bb19-98032ecbba87\scratch\product42\BKP06736.jpg' 80
Compress-Jpg 'C:\Users\RAGINI\.gemini\antigravity-ide\brain\6e0a7fa5-ef33-4f72-bb19-98032ecbba87\scratch\product42\BKP06737.jpg' 'C:\Users\RAGINI\.gemini\antigravity-ide\brain\6e0a7fa5-ef33-4f72-bb19-98032ecbba87\scratch\product42\BKP06737.jpg' 80
