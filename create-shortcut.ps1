$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
if (-not (Test-Path $DesktopPath)) {
    $DesktopPath = $WshShell.SpecialFolders("Desktop")
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = (Get-Location).Path
}

$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Apex Download Manager.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$ScriptDir\launch.vbs"""
$Shortcut.WorkingDirectory = "$ScriptDir"
$Shortcut.IconLocation = "$ScriptDir\extension\icons\icon.ico"
$Shortcut.Description = "Apex Download Manager (IDM Pro Edition)"
$Shortcut.Save()
Write-Host "Created shortcut successfully at $DesktopPath\Apex Download Manager.lnk"

