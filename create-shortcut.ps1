$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
if (-not (Test-Path $DesktopPath)) {
    $DesktopPath = $WshShell.SpecialFolders("Desktop")
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = (Get-Location).Path
}

$ElectronExe = "$ScriptDir\node_modules\electron\dist\electron.exe"
$IconPath = "$ScriptDir\extension\icons\icon.ico"

$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Apex Download Manager.lnk")
if (Test-Path $ElectronExe) {
    $Shortcut.TargetPath = $ElectronExe
    $Shortcut.Arguments = """$ScriptDir"""
} else {
    $Shortcut.TargetPath = "$ScriptDir\launch.vbs"
}
$Shortcut.WorkingDirectory = "$ScriptDir"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath"
}
$Shortcut.Description = "Apex Download Manager 6.42 Pro"
$Shortcut.Save()
Write-Host "Created shortcut successfully at $DesktopPath\Apex Download Manager.lnk"
