# Document Renaming Script
# Add timestamp prefix to today's documents

$date = "20260116"

$files = @(
    "EXECUTIVE_SUMMARY.md",
    "TODO_AND_ROADMAP.md",
    "ARCHITECTURE_SUMMARY.md",
    "COMPLETE_PROJECT_REVIEW.md",
    "QUICK_REFERENCE.md",
    "PROJECT_HEALTH_CHECK.md",
    "VICTORY_PURSUIT_REPORT.md",
    "DOCS_NAVIGATION.md",
    "AGENT_B_IO_ISSUE.md",
    "P1_IO_FIX_REPORT.md",
    "DOCS_TIMESTAMP_GUIDE.md"
)

Write-Host "Starting document renaming..." -ForegroundColor Cyan
Write-Host ""

$renamed = 0
$skipped = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        $newName = "${date}_$file"
        
        if (Test-Path $newName) {
            Write-Host "Skip: $file (target exists)" -ForegroundColor Yellow
            $skipped++
        } else {
            try {
                Rename-Item -Path $file -NewName $newName -ErrorAction Stop
                Write-Host "OK: $file -> $newName" -ForegroundColor Green
                $renamed++
            } catch {
                Write-Host "ERROR: $file ($_)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Skip: $file (not found)" -ForegroundColor Yellow
        $skipped++
    }
}

Write-Host ""
Write-Host "Renaming complete:" -ForegroundColor Cyan
Write-Host "  Success: $renamed files" -ForegroundColor Green
Write-Host "  Skipped: $skipped files" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Please check README.md for broken links" -ForegroundColor Cyan
