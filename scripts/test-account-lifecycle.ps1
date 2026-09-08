$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$SupabaseUrl = "https://jrdmrhsqqclnrouoednn.supabase.co"
$AccountId = "f34da2dd-f70a-4d53-8a81-366a01887785"
$AccountName = "chaves"
$InstitutionId = "1dfded6b-f3bd-4252-af48-cb6cc6136c8a"
$InstitutionName = "escola+"
$AdminEmail = "atilajavert172@gmail.com"
$SuperAdminId = "5ab7cf5b-5778-4c8b-b42b-477eab75c888"
$SuperAdminEmail = "superadmin@admin.com"
$RequiredConfirmation = "EXCLUIR CHAVES DEFINITIVAMENTE"

function Stop-Test {
  param([Parameter(Mandatory = $true)][string]$Message)
  throw $Message
}

function Convert-ResponseJson {
  param(
    [Parameter(Mandatory = $true)][string]$Body,
    [Parameter(Mandatory = $true)][string]$Step
  )

  if ([string]::IsNullOrWhiteSpace($Body)) {
    return $null
  }

  try {
    return $Body | ConvertFrom-Json
  } catch {
    Stop-Test "$Step retornou um corpo que nao e JSON valido."
  }
}

function Invoke-CurlJson {
  param(
    [Parameter(Mandatory = $true)][string]$Step,
    [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [AllowNull()][object]$Payload = $null
  )

  $bodyFile = Join-Path ([IO.Path]::GetTempPath()) ("edumanager-audit-" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $arguments = @(
      "--silent",
      "--show-error",
      "--output", $bodyFile,
      "--write-out", "%{http_code}",
      "--request", $Method,
      "--header", "apikey: $env:ANON_KEY",
      "--header", "Authorization: Bearer $env:JWT",
      "--header", "Content-Type: application/json",
      $Url
    )

    if ($null -ne $Payload) {
      $arguments += @("--data-raw", ($Payload | ConvertTo-Json -Compress -Depth 10))
    }

    $httpStatusText = & curl.exe @arguments
    $curlExitCode = $LASTEXITCODE
    $responseBody = if (Test-Path -LiteralPath $bodyFile) {
      Get-Content -LiteralPath $bodyFile -Raw
    } else {
      ""
    }

    if ($curlExitCode -ne 0) {
      Stop-Test "$Step falhou no curl (exit code $curlExitCode)."
    }

    $httpStatus = 0
    if (-not [int]::TryParse(($httpStatusText | Out-String).Trim(), [ref]$httpStatus)) {
      Stop-Test "$Step nao retornou um HTTP status valido."
    }

    [pscustomobject]@{
      HttpStatus = $httpStatus
      Body = $responseBody
      CurlExitCode = $curlExitCode
      Json = Convert-ResponseJson -Body $responseBody -Step $Step
    }
  } finally {
    Remove-Item -LiteralPath $bodyFile -Force -ErrorAction SilentlyContinue
  }
}

function Assert-Success {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [Parameter(Mandatory = $true)][string]$Step
  )

  if ($Response.HttpStatus -lt 200 -or $Response.HttpStatus -ge 300) {
    Stop-Test "$Step falhou (HTTP $($Response.HttpStatus), curl $($Response.CurlExitCode))."
  }
}

function Get-RestRows {
  param(
    [Parameter(Mandatory = $true)][string]$Step,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $response = Invoke-CurlJson -Step $Step -Method GET -Url "$SupabaseUrl/rest/v1/$Path"
  Assert-Success -Response $response -Step $Step
  if ($null -eq $response.Json) {
    Stop-Test "$Step retornou resposta vazia."
  }
  return @($response.Json)
}

function Assert-SingleRow {
  param(
    [Parameter(Mandatory = $true)][object[]]$Rows,
    [Parameter(Mandatory = $true)][string]$Step
  )

  if ($Rows.Count -ne 1) {
    Stop-Test "$Step esperava exatamente um registro e encontrou $($Rows.Count)."
  }
  return $Rows[0]
}

function Assert-AccountStatus {
  param([Parameter(Mandatory = $true)][ValidateSet("ACTIVE", "CANCELED")][string]$Expected)

  $rows = Get-RestRows -Step "Validacao da conta $Expected" -Path "accounts?select=id,name,status,owner_profile_id&id=eq.$AccountId"
  $account = Assert-SingleRow -Rows $rows -Step "Validacao da conta $Expected"
  if ($account.id -ne $AccountId -or $account.name -ne $AccountName -or $account.status -ne $Expected) {
    Stop-Test "A conta alvo nao corresponde a chaves ou nao esta com status $Expected."
  }
  return $account
}

function Assert-InstitutionPreserved {
  $rows = Get-RestRows -Step "Validacao da instituicao" -Path "institutions?select=id,name,account_id,active&id=eq.$InstitutionId"
  $institution = Assert-SingleRow -Rows $rows -Step "Validacao da instituicao"
  if (
    $institution.id -ne $InstitutionId -or
    $institution.name -ne $InstitutionName -or
    $institution.account_id -ne $AccountId -or
    $institution.active -ne $true
  ) {
    Stop-Test "A instituicao alvo nao corresponde a escola+ ativa da conta chaves."
  }
}

function Assert-SuperAdminPreserved {
  $encodedEmail = [uri]::EscapeDataString($SuperAdminEmail)
  $rows = Get-RestRows -Step "Validacao do superadmin" -Path "profiles?select=id,email,platform_role,active&id=eq.$SuperAdminId&email=eq.$encodedEmail"
  $profile = Assert-SingleRow -Rows $rows -Step "Validacao do superadmin"
  if ($profile.email -ne $SuperAdminEmail -or $profile.platform_role -ne "SUPER_ADMIN" -or $profile.active -ne $true) {
    Stop-Test "superadmin@admin.com nao foi encontrado como SUPER_ADMIN ativo."
  }
}

function Get-OtherAccountIds {
  $rows = Get-RestRows -Step "Inventario das demais contas" -Path "accounts?select=id&order=id.asc"
  return @($rows | Where-Object { $_.id -ne $AccountId } | ForEach-Object { [string]$_.id } | Sort-Object)
}

function Assert-OtherAccountsUnchanged {
  param([Parameter(Mandatory = $true)][string[]]$Baseline)

  $current = @(Get-OtherAccountIds)
  $difference = Compare-Object -ReferenceObject $Baseline -DifferenceObject $current
  if ($null -ne $difference) {
    Stop-Test "O baseline das outras contas mudou. O hard delete permanece bloqueado."
  }
}

function Invoke-SoftDelete {
  param([Parameter(Mandatory = $true)][string]$Reason)

  $payload = @{
    target_account_id = $AccountId
    target_status = "CANCELED"
    actor_profile_id = $SuperAdminId
    change_reason = $Reason
  }
  $response = Invoke-CurlJson -Step "Soft delete" -Method POST -Url "$SupabaseUrl/rest/v1/rpc/change_account_status" -Payload $payload
  Assert-Success -Response $response -Step "Soft delete"
}

function Assert-NegativeDelete {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][hashtable]$Payload
  )

  $response = Invoke-CurlJson -Step $Name -Method POST -Url "$SupabaseUrl/functions/v1/delete-client-account" -Payload $Payload
  $reportedSuccess = $null -ne $response.Json -and
    $response.Json.PSObject.Properties.Name -contains "success" -and
    $response.Json.success -eq $true

  if (($response.HttpStatus -ge 200 -and $response.HttpStatus -lt 300) -or $reportedSuccess) {
    Stop-Test "$Name retornou sucesso quando deveria rejeitar a requisicao."
  }
  Write-Host "APROVADO: $Name rejeitado (HTTP $($response.HttpStatus))."
}

function Assert-AdminRemovedOrShared {
  param(
    [Parameter(Mandatory = $true)][string]$OwnerProfileId,
    [Parameter(Mandatory = $true)][string[]]$SharedProfileIds
  )

  $encodedEmail = [uri]::EscapeDataString($AdminEmail)
  $rows = @(Get-RestRows -Step "Validacao final do administrador" -Path "profiles?select=id,email,active&email=eq.$encodedEmail")
  if ($rows.Count -eq 0) {
    Write-Host "APROVADO: usuario administrador removido."
    return
  }

  if ($rows.Count -ne 1 -or $rows[0].id -ne $OwnerProfileId -or $rows[0].email -ne $AdminEmail) {
    Stop-Test "O resultado final do administrador nao corresponde ao usuario alvo."
  }
  if ($SharedProfileIds -notcontains $OwnerProfileId) {
    Stop-Test "O administrador foi preservado sem constar como perfil compartilhado."
  }

  $membershipRows = @(Get-RestRows -Step "Comprovacao de vinculo compartilhado" -Path "memberships?select=id,institution_id,active&profile_id=eq.$OwnerProfileId&active=is.true")
  $ownedAccounts = @(Get-RestRows -Step "Comprovacao de outra conta do administrador" -Path "accounts?select=id&owner_profile_id=eq.$OwnerProfileId")
  if ($membershipRows.Count -eq 0 -and $ownedAccounts.Count -eq 0) {
    Stop-Test "O administrador permaneceu sem vinculo compartilhado comprovado."
  }

  Write-Host "APROVADO: administrador preservado por vinculo compartilhado documentado."
}

$exitCode = 1
try {
  if ([string]::IsNullOrWhiteSpace($env:JWT) -or [string]::IsNullOrWhiteSpace($env:ANON_KEY)) {
    Stop-Test "JWT e ANON_KEY precisam estar configuradas."
  }
  if ($null -eq (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    Stop-Test "curl.exe nao foi encontrado."
  }

  Write-Host "Preflight somente leitura..."
  $initialAccount = Assert-AccountStatus -Expected "ACTIVE"
  Assert-InstitutionPreserved

  $encodedAdminEmail = [uri]::EscapeDataString($AdminEmail)
  $adminRows = Get-RestRows -Step "Validacao do administrador alvo" -Path "profiles?select=id,email,active&id=eq.$($initialAccount.owner_profile_id)&email=eq.$encodedAdminEmail"
  $admin = Assert-SingleRow -Rows $adminRows -Step "Validacao do administrador alvo"
  if ($admin.email -ne $AdminEmail) {
    Stop-Test "O e-mail do administrador nao corresponde a conta chaves."
  }
  Assert-SuperAdminPreserved
  $otherAccountsBaseline = @(Get-OtherAccountIds)
  Write-Host "APROVADO: identidade do alvo e baseline confirmados."

  Invoke-SoftDelete -Reason "Exclusao logica para teste de homologacao do ciclo de vida."
  $null = Assert-AccountStatus -Expected "CANCELED"
  Write-Host "APROVADO: soft delete e status CANCELED."

  $restorePayload = @{
    accountId = $AccountId
    reason = "Restauracao de homologacao para teste do ciclo de vida de contas."
  }
  $restore = Invoke-CurlJson -Step "Restore" -Method POST -Url "$SupabaseUrl/functions/v1/restore-client-account" -Payload $restorePayload
  Assert-Success -Response $restore -Step "Restore"
  if (
    $null -eq $restore.Json -or
    $restore.Json.success -ne $true -or
    $restore.Json.accountId -ne $AccountId -or
    $restore.Json.status -ne "ACTIVE"
  ) {
    Stop-Test "Restore nao confirmou sucesso da conta chaves."
  }
  $null = Assert-AccountStatus -Expected "ACTIVE"
  Assert-InstitutionPreserved
  Write-Host "APROVADO: restore, status ACTIVE e escola preservada."

  $validBase = @{
    accountId = $AccountId
    reason = "Teste de casos negativos com mais de dez caracteres."
    confirmationEmail = $AdminEmail
    confirmationText = "EXCLUIR DEFINITIVAMENTE"
    acknowledgement = $true
  }
  $wrongText = $validBase.Clone()
  $wrongText.confirmationText = "TEXTO ERRADO"
  Assert-NegativeDelete -Name "Texto incorreto" -Payload $wrongText
  $falseAcknowledgement = $validBase.Clone()
  $falseAcknowledgement.acknowledgement = $false
  Assert-NegativeDelete -Name "Acknowledgement false" -Payload $falseAcknowledgement
  $shortReason = $validBase.Clone()
  $shortReason.reason = "Curto"
  Assert-NegativeDelete -Name "Motivo curto" -Payload $shortReason

  Invoke-SoftDelete -Reason "Exclusao logica para preparar hard delete de homologacao."
  $accountBeforeHardDelete = Assert-AccountStatus -Expected "CANCELED"
  Assert-InstitutionPreserved
  Assert-SuperAdminPreserved
  Assert-OtherAccountsUnchanged -Baseline $otherAccountsBaseline
  Write-Host "APROVADO: novo soft delete, CANCELED e todas as travas pre-hard-delete."

  Write-Host ""
  Write-Host "ATENCAO: exclusao permanente liberada pelas validacoes."
  Write-Host "Conta: $AccountName"
  Write-Host "Account ID: $AccountId"
  Write-Host "Instituição: $InstitutionName"
  Write-Host "Administrador: $AdminEmail"
  $typedConfirmation = Read-Host "Digite exatamente: $RequiredConfirmation"
  if ($typedConfirmation -cne $RequiredConfirmation) {
    Stop-Test "Confirmacao exata nao fornecida. Hard delete cancelado."
  }

  $hardDeletePayload = @{
    accountId = $AccountId
    reason = "Exclusao permanente de homologacao apos validacoes completas do ciclo de vida."
    confirmationEmail = $AdminEmail
    confirmationText = "EXCLUIR DEFINITIVAMENTE"
    acknowledgement = $true
  }
  $hardDelete = Invoke-CurlJson -Step "Hard delete" -Method POST -Url "$SupabaseUrl/functions/v1/delete-client-account" -Payload $hardDeletePayload
  Assert-Success -Response $hardDelete -Step "Hard delete"
  if (
    $null -eq $hardDelete.Json -or
    $hardDelete.Json.success -ne $true -or
    $hardDelete.Json.accountId -ne $AccountId -or
    $hardDelete.Json.accountName -ne $AccountName -or
    [string]::IsNullOrWhiteSpace([string]$hardDelete.Json.auditId)
  ) {
    Stop-Test "Hard delete nao confirmou integralmente a exclusao da conta chaves."
  }
  if (@($hardDelete.Json.authDeletionFailed).Count -gt 0) {
    Stop-Test "Hard delete informou falha ao remover usuario de autenticacao."
  }

  $finalAccount = @(Get-RestRows -Step "Validacao final da conta" -Path "accounts?select=id&id=eq.$AccountId")
  if ($finalAccount.Count -ne 0) {
    Stop-Test "A conta chaves ainda existe apos o hard delete."
  }
  $finalInstitution = @(Get-RestRows -Step "Validacao final da instituicao" -Path "institutions?select=id&id=eq.$InstitutionId")
  if ($finalInstitution.Count -ne 0) {
    Stop-Test "A instituicao escola+ ainda existe apos o hard delete."
  }

  $sharedProfileIds = @($hardDelete.Json.sharedProfileIds | ForEach-Object { [string]$_ })
  Assert-AdminRemovedOrShared -OwnerProfileId ([string]$accountBeforeHardDelete.owner_profile_id) -SharedProfileIds $sharedProfileIds
  Assert-SuperAdminPreserved
  Assert-OtherAccountsUnchanged -Baseline $otherAccountsBaseline

  $auditId = [uri]::EscapeDataString([string]$hardDelete.Json.auditId)
  $auditRows = Get-RestRows -Step "Validacao da auditoria HARD_DELETE" -Path "platform_destructive_actions?select=id,action_type,target_account_id,target_account_name,result_status&id=eq.$auditId&action_type=eq.HARD_DELETE"
  $audit = Assert-SingleRow -Rows $auditRows -Step "Validacao da auditoria HARD_DELETE"
  if (
    $audit.target_account_id -ne $AccountId -or
    $audit.target_account_name -ne $AccountName -or
    $audit.result_status -ne "SUCCESS"
  ) {
    Stop-Test "A auditoria HARD_DELETE nao corresponde a exclusao concluida."
  }

  Write-Host ""
  Write-Host "TESTE CONCLUIDO COM SUCESSO"
  Write-Host "Soft delete: aprovado"
  Write-Host "Restore: aprovado"
  Write-Host "Casos negativos: bloqueados"
  Write-Host "Hard delete: aprovado"
  Write-Host "Conta chaves e instituicao escola+: removidas"
  Write-Host "superadmin@admin.com e demais contas: preservados"
  Write-Host "Auditoria HARD_DELETE: confirmada"
  $exitCode = 0
} catch {
  Write-Error ("FALHA: " + $_.Exception.Message)
  $exitCode = 1
} finally {
  Remove-Item Env:JWT -ErrorAction SilentlyContinue
  Remove-Item Env:ANON_KEY -ErrorAction SilentlyContinue
}

exit $exitCode
