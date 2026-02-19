Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set procEnv = WshShell.Environment("Process")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverPath = fso.BuildPath(scriptDir, "server.mjs")
envPath = fso.BuildPath(scriptDir, "bridge.env")

If Not fso.FileExists(serverPath) Then
    MsgBox "Nie znaleziono pliku server.mjs w:" & vbCrLf & scriptDir, vbCritical, "POSNET Bridge - Blad"
    WScript.Quit 1
End If

' Load bridge.env if exists
If fso.FileExists(envPath) Then
    Set envFile = fso.OpenTextFile(envPath, 1)
    Do While Not envFile.AtEndOfStream
        line = Trim(envFile.ReadLine)
        If Len(line) > 0 And Left(line, 1) <> "#" Then
            eqPos = InStr(line, "=")
            If eqPos > 1 Then
                key = Trim(Left(line, eqPos - 1))
                val = Trim(Mid(line, eqPos + 1))
                procEnv(key) = val
            End If
        End If
    Loop
    envFile.Close
End If

WshShell.CurrentDirectory = scriptDir
WshShell.Run "node """ & serverPath & """", 0, False
