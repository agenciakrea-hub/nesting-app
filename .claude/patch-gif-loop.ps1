param(
  [string]$Path,
  [int]$LoopCount = 1
)

$bytes = [System.IO.File]::ReadAllBytes($Path)

$marker = [System.Text.Encoding]::ASCII.GetBytes("NETSCAPE2.0")
$idx = -1
for ($i = 0; $i -le $bytes.Length - $marker.Length; $i++) {
    $match = $true
    for ($j = 0; $j -lt $marker.Length; $j++) {
        if ($bytes[$i + $j] -ne $marker[$j]) { $match = $false; break }
    }
    if ($match) { $idx = $i; break }
}

if ($idx -lt 0) {
    Write-Output "NO_NETSCAPE_BLOCK_FOUND"
    exit 1
}

$llOffset = $idx + 13
$hhOffset = $idx + 14
$bytes[$llOffset] = [byte]($LoopCount -band 0xFF)
$bytes[$hhOffset] = [byte](($LoopCount -shr 8) -band 0xFF)

[System.IO.File]::WriteAllBytes($Path, $bytes)
Write-Output "PATCHED loopOffset=$llOffset newLoopCount=$LoopCount"
