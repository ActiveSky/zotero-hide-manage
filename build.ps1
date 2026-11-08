#Requires -Version 5.1
<#
.SYNOPSIS
    Build the Hide Manage XPI.

.DESCRIPTION
    Packages manifest.json, bootstrap.js, prefs.js and content/ into
    hide-manage.xpi at the repository root.

.EXAMPLE
    pwsh ./build.ps1
#>

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$out = Join-Path $root "hide-manage.xpi"
$tmp = Join-Path $root "hide-manage.zip"

$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
Write-Host "Building Hide Manage v$($manifest.version)"

if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $tmp) { Remove-Item $tmp -Force }

$files = @(
    (Join-Path $root "manifest.json"),
    (Join-Path $root "bootstrap.js"),
    (Join-Path $root "prefs.js"),
    (Join-Path $root "content")
)

Compress-Archive -Path $files -DestinationPath $tmp -Force
Move-Item $tmp $out -Force

Write-Host "Built: $out ($((Get-Item $out).Length) bytes)"
