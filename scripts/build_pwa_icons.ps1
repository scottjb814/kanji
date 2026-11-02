# Optional Windows helper; generated PNGs are committed, so CI needs no image tools.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../icons'))
[IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
foreach ($item in @(@('icon-192.png', 192), @('icon-512.png', 512), @('icon-maskable-512.png', 512), @('apple-touch-icon.png', 180))) {
    $size = [int]$item[1]
    $bitmap = [Drawing.Bitmap]::new($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#A3271F'))
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    # Keep the entire character inside the central maskable safe area.
    $font = [Drawing.Font]::new('Yu Mincho', ($size * 0.55), [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
    $format = [Drawing.StringFormat]::new()
    $format.Alignment = [Drawing.StringAlignment]::Center
    $format.LineAlignment = [Drawing.StringAlignment]::Center
    $graphics.DrawString([string][char]0x5B57, $font, [Drawing.Brushes]::White, [Drawing.RectangleF]::new(0, ($size * 0.13), $size, $size), $format)
    $bitmap.Save((Join-Path $iconDirectory $item[0]), [Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
