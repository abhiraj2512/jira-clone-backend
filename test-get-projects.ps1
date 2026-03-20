$ErrorActionPreference = "Stop"
$uidBase = [guid]::NewGuid().ToString().Substring(0, 5)

Write-Host "1. Registering User..."
$adminRes = Invoke-RestMethod -Uri http://localhost:5000/auth/register -Method Post -ContentType 'application/json' -Body (@{ email="getproj_$uidBase@example.com"; password="StrongPassword123!"; fullName="Get Proj User" } | ConvertTo-Json)

Write-Host "2. Logging In..."
$adminLogin = Invoke-RestMethod -Uri http://localhost:5000/auth/login -Method Post -ContentType 'application/json' -Body (@{ email="getproj_$uidBase@example.com"; password="StrongPassword123!" } | ConvertTo-Json)
$token = $adminLogin.accessToken

Write-Host "3. Creating Project 1..."
$projectBody1 = @{
    name = "Project A $uidBase"
    key = "PRA$uidBase".Substring(0, 10)
    description = "Test project description A"
} | ConvertTo-Json
$void1 = Invoke-RestMethod -Uri http://localhost:5000/projects -Method Post -Headers @{Authorization="Bearer $token"} -ContentType 'application/json' -Body $projectBody1

Write-Host "4. Creating Project 2..."
$projectBody2 = @{
    name = "Project B $uidBase"
    key = "PRB$uidBase".Substring(0, 10)
    description = "Test project description B"
} | ConvertTo-Json
$void2 = Invoke-RestMethod -Uri http://localhost:5000/projects -Method Post -Headers @{Authorization="Bearer $token"} -ContentType 'application/json' -Body $projectBody2

Write-Host "5. Getting User Projects..."
$res = Invoke-RestMethod -Uri http://localhost:5000/projects -Method Get -Headers @{Authorization="Bearer $token"}

Write-Host "Result:"
Write-Host ($res | ConvertTo-Json -Depth 5)
