# Creates one GitLab issue per file in training-plan/tickets/day-*.md. Requires glab (https://gitlab.com/gitlab-org/cli) and `glab auth login`.
# Usage: .\scripts\create-issues.ps1 [-DryRun]
param([switch]$DryRun)

$root = Split-Path $PSScriptRoot -Parent
Get-ChildItem "$root\training-plan\tickets\day-*.md" | Sort-Object Name | ForEach-Object {
    $lines = Get-Content $_.FullName
    $title = ($lines[0] -replace '^#\s*', '')
    $labels = ([regex]::Matches($lines[2], '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value }) -join ','
    if ($DryRun) { Write-Host "[dry-run] $title  [$labels]"; return }
    glab issue create --title $title --description ($lines[2..($lines.Count - 1)] -join "`n") --label $labels --yes
}
