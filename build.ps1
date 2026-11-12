#Requires -Version 5.1
<#
.SYNOPSIS
    Build the Hide Manage XPI.

.DESCRIPTION
    Packages the contents of src/ (manifest.json, bootstrap.js, prefs.js and
    content/) into hide-manage.xpi at the repository root. The XPI keeps those
    files at its root, which Zotero requires.

.EXAMPLE
    pwsh ./build.ps1
#>

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$src = Join-Path $root "src"
$out = Join-Path $root "hide-manage.xpi"
$tmp = Join-Path $root "hide-manage.zip"

$manifest = Get-Content (Join-Path $src "manifest.json") -Raw | ConvertFrom-Json
Write-Host "Building Hide Manage v$($manifest.version)"

if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $tmp) { Remove-Item $tmp -Force }

Compress-Archive -Path (Join-Path $src "*") -DestinationPath $tmp -Force
Move-Item $tmp $out -Force

Write-Host "Built: $out ($((Get-Item $out).Length) bytes)"
