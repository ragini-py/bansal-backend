Add-Type -AssemblyName System.Drawing

function Convert-PngToJpg($src, $dst, $quality) {
    $img = [System.Drawing.Image]::FromFile($src)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
    $img.Save($dst, $codec, $encParams)
    $img.Dispose()
    Write-Host "Saved $dst"
}

Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\images\products\Luxury Ethnicwear Editorial in a Heritage Courtyard.png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\hero-slide-2.jpg' 88
Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\images\products\Regal South Asian Fashion in Sunlit Arches.png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\hero-slide-3.jpg' 88
Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\images\products\Teal and Gold Ethnic Couture Portrait.png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\hero-slide-4.jpg' 88
Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\images\hero\Embroidered Orange-Red Textile with Pearl Tassels (1).png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\craft-orange.jpg' 90
Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\images\hero\Regal Fuchsia Palace Portrait.png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\auth-hero.jpg' 90
Convert-PngToJpg 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\public\collections\Serene Blue Draped Fashion Portrait.png' 'e:\kbc-kolkatabusinessclub\bansalnx-regal-suite\src\assets\about-editorial.jpg' 90



