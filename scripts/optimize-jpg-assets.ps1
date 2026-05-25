param(
  [string]$ImageDir = "src/assets/img",
  [double]$MaxDimension = 1800.0,
  [long]$Quality = 78
)

Add-Type -AssemblyName System.Drawing

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality,
  $Quality
)

$files = Get-ChildItem -Path "$ImageDir/*" -Include *.jpg, *.jpeg -File |
  Where-Object { $_.Length -gt 1MB }

foreach ($file in $files) {
  $image = [System.Drawing.Image]::FromFile($file.FullName)

  try {
    $scale = [Math]::Min(1.0, $MaxDimension / [double]([Math]::Max($image.Width, $image.Height)))
    $width = [Math]::Max(1, [int]($image.Width * $scale))
    $height = [Math]::Max(1, [int]($image.Height * $scale))

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($image, 0, 0, $width, $height)

      $tempPath = "$($file.FullName).tmp.jpg"
      $bitmap.Save($tempPath, $codec, $encoderParams)
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
  finally {
    $image.Dispose()
  }

  Move-Item -LiteralPath $tempPath -Destination $file.FullName -Force
}

Get-ChildItem -Path "$ImageDir/*" -Include *.jpg, *.jpeg -File |
  Select-Object Name, @{Name = "KB"; Expression = { [math]::Round($_.Length / 1KB, 1) } }
