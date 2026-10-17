Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir
ElectronExe = ScriptDir & "\node_modules\electron\dist\electron.exe"

If FSO.FileExists(ElectronExe) Then
    WshShell.Run """" & ElectronExe & """ """ & ScriptDir & """", 1, False
Else
    WshShell.Run "cmd.exe /c npx electron .", 0, False
End If
