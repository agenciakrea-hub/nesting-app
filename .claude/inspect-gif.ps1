param(
  [string]$Path
)

$bytes = [System.IO.File]::ReadAllBytes($Path)
Write-Output "Tamaño del archivo: $($bytes.Length) bytes"

$marker = [System.Text.Encoding]::ASCII.GetBytes("NETSCAPE2.0")
$idx = -1
for ($i = 0; $i -le $bytes.Length - $marker.Length; $i++) {
    $match = $true
    for ($j = 0; $j -lt $marker.Length; $j++) {
        if ($bytes[$i + $j] -ne $marker[$j]) { $match = $false; break }
    }
    if ($match) { $idx = $i; break }
}

if ($idx -ge 0) {
    Write-Output "NETSCAPE2.0 encontrado en offset $idx"
    $subBlockSize = $bytes[$idx + 11]
    $subBlockId = $bytes[$idx + 12]
    $ll = $bytes[$idx + 13]
    $hh = $bytes[$idx + 14]
    $terminator = $bytes[$idx + 15]
    $loopCount = $ll + ($hh * 256)
    Write-Output "subBlockSize=$subBlockSize subBlockId=$subBlockId loopCountBytes=$ll,$hh terminator=$terminator"
    Write-Output "LOOP_COUNT=$loopCount"
    Write-Output "LOOP_OFFSET=$($idx + 13)"
} else {
    Write-Output "NO_NETSCAPE_BLOCK"
}

$gceCount = 0
for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
    if ($bytes[$i] -eq 0x21 -and $bytes[$i+1] -eq 0xF9) { $gceCount++ }
}
Write-Output "FRAME_COUNT_APROX=$gceCount"
