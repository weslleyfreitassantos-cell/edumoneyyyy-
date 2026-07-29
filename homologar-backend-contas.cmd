@echo off
setlocal EnableExtensions EnableDelayedExpansion

title EduManager Pro - Homologacao Backend de Contas

REM ============================================================
REM CONFIGURACAO
REM ============================================================

set "TEST_PROJECT_REF=whztnyifxpqgilvurymx"
set "PROD_PROJECT_REF=jrdmrhsqqclnrouoednn"

set "RESTORE_FUNCTION=restore-client-account"
set "DELETE_FUNCTION=delete-client-account"

set "LOG_DIR=.homologation-logs"

for /f "tokens=1-4 delims=/ " %%a in ("%date%") do (
    set "DATE_TAG=%%d-%%b-%%c"
)

set "TIME_TAG=%time::=-%"
set "TIME_TAG=%TIME_TAG: =0%"
set "LOG_FILE=%LOG_DIR%\homologacao-%DATE_TAG%-%TIME_TAG%.log"

REM ============================================================
REM PREPARACAO
REM ============================================================

echo.
echo ============================================================
echo  EduManager Pro - Homologacao Backend de Contas
echo ============================================================
echo.
echo Projeto de TESTE: %TEST_PROJECT_REF%
echo Projeto de PRODUCAO PROIBIDO: %PROD_PROJECT_REF%
echo.

if not exist "package.json" (
    echo [ERRO] package.json nao encontrado.
    echo Execute este script na raiz do projeto.
    exit /b 1
)

if not exist "supabase\config.toml" (
    echo [ERRO] supabase\config.toml nao encontrado.
    echo Execute este script na raiz do projeto.
    exit /b 1
)

if not exist "supabase\functions\%RESTORE_FUNCTION%\index.ts" (
    echo [ERRO] Funcao %RESTORE_FUNCTION% nao encontrada.
    exit /b 1
)

if not exist "supabase\functions\%DELETE_FUNCTION%\index.ts" (
    echo [ERRO] Funcao %DELETE_FUNCTION% nao encontrada.
    exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Inicio: %date% %time% > "%LOG_FILE%"
echo Projeto de teste: %TEST_PROJECT_REF% >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM ============================================================
REM VERIFICAR FERRAMENTAS
REM ============================================================

echo.
echo [1/9] Verificando Git...
git --version >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [ERRO] Git nao encontrado.
    exit /b 1
)

echo [2/9] Verificando Supabase CLI...
call npx supabase --version >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [ERRO] Supabase CLI nao disponivel.
    echo Execute: npm install
    exit /b 1
)

echo [3/9] Verificando estado do Git...
git status -sb
git status -sb >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [ERRO] Nao foi possivel consultar o Git.
    exit /b 1
)

REM ============================================================
REM CONFIRMACAO FORTE
REM ============================================================

echo.
echo ATENCAO:
echo Este script aplicara migration e Edge Functions apenas em:
echo %TEST_PROJECT_REF%
echo.
echo Nao sera executado supabase config push.
echo Nao sera usado o projeto de producao.
echo.

set /p "CONFIRM_REF=Digite exatamente o project ref de TESTE para continuar: "

if /I not "%CONFIRM_REF%"=="%TEST_PROJECT_REF%" (
    echo [ABORTADO] Project ref informado nao corresponde ao teste.
    exit /b 1
)

REM ============================================================
REM LINK DO PROJETO
REM ============================================================

echo.
echo [4/9] Vinculando ao projeto de TESTE...
call npx supabase link --project-ref "%TEST_PROJECT_REF%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [ERRO] Falha ao vincular ao projeto de teste.
    echo Consulte o log:
    echo %LOG_FILE%
    exit /b 1
)

REM ============================================================
REM PROTECAO CONTRA PRODUCAO
REM ============================================================

if exist "supabase\.temp\project-ref" (
    set /p "LINKED_REF="<"supabase\.temp\project-ref"
) else (
    echo [ERRO] Nao foi possivel confirmar o project ref vinculado.
    echo Arquivo supabase\.temp\project-ref nao encontrado.
    exit /b 1
)

echo Project ref vinculado: !LINKED_REF!
echo Project ref vinculado: !LINKED_REF! >> "%LOG_FILE%"

if /I "!LINKED_REF!"=="%PROD_PROJECT_REF%" (
    echo.
    echo [BLOQUEADO] O projeto vinculado e PRODUCAO.
    echo Nenhuma migration ou funcao sera aplicada.
    exit /b 1
)

if /I not "!LINKED_REF!"=="%TEST_PROJECT_REF%" (
    echo.
    echo [BLOQUEADO] O projeto vinculado nao corresponde ao projeto de teste.
    exit /b 1
)

REM ============================================================
REM MIGRATIONS ANTES
REM ============================================================

echo.
echo [5/9] Listando migrations antes do push...
call npx supabase migration list --linked
call npx supabase migration list --linked >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo [ERRO] Nao foi possivel listar migrations.
    exit /b 1
)

echo.
echo O proximo passo aplicara migrations pendentes em HOMOLOGACAO.
set /p "CONFIRM_PUSH=Digite APLICAR EM HOMOLOGACAO para continuar: "

if /I not "%CONFIRM_PUSH%"=="APLICAR EM HOMOLOGACAO" (
    echo [ABORTADO] Confirmacao de migration incorreta.
    exit /b 1
)

REM ============================================================
REM DB PUSH
REM ============================================================

echo.
echo [6/9] Aplicando migrations no projeto de TESTE...
call npx supabase db push --linked
set "DB_PUSH_RESULT=!errorlevel!"

echo db push exit code: !DB_PUSH_RESULT! >> "%LOG_FILE%"

if not "!DB_PUSH_RESULT!"=="0" (
    echo [ERRO] db push falhou.
    echo As Edge Functions nao serao implantadas.
    echo Consulte:
    echo %LOG_FILE%
    exit /b 1
)

REM ============================================================
REM DEPLOY RESTORE
REM ============================================================

echo.
echo [7/9] Implantando %RESTORE_FUNCTION%...
call npx supabase functions deploy "%RESTORE_FUNCTION%" --project-ref "%TEST_PROJECT_REF%"
set "RESTORE_RESULT=!errorlevel!"

echo restore deploy exit code: !RESTORE_RESULT! >> "%LOG_FILE%"

if not "!RESTORE_RESULT!"=="0" (
    echo [ERRO] Deploy de %RESTORE_FUNCTION% falhou.
    exit /b 1
)

REM ============================================================
REM DEPLOY DELETE
REM ============================================================

echo.
echo [8/9] Implantando %DELETE_FUNCTION%...
call npx supabase functions deploy "%DELETE_FUNCTION%" --project-ref "%TEST_PROJECT_REF%"
set "DELETE_RESULT=!errorlevel!"

echo delete deploy exit code: !DELETE_RESULT! >> "%LOG_FILE%"

if not "!DELETE_RESULT!"=="0" (
    echo [ERRO] Deploy de %DELETE_FUNCTION% falhou.
    exit /b 1
)

REM ============================================================
REM VALIDACAO FINAL
REM ============================================================

echo.
echo [9/9] Validando migrations e funcoes...
echo.

echo -------- MIGRATIONS --------
call npx supabase migration list --linked
call npx supabase migration list --linked >> "%LOG_FILE%" 2>&1

echo.
echo -------- EDGE FUNCTIONS --------
call npx supabase functions list --project-ref "%TEST_PROJECT_REF%"
call npx supabase functions list --project-ref "%TEST_PROJECT_REF%" >> "%LOG_FILE%" 2>&1

echo.
echo ============================================================
echo HOMOLOGACAO TECNICA CONCLUIDA
echo ============================================================
echo.
echo Projeto alterado:
echo %TEST_PROJECT_REF%
echo.
echo Projeto de producao:
echo NAO ALTERADO
echo.
echo Agora executar manualmente:
echo 1. Criar Conta A e Conta B
echo 2. Excluir logicamente Conta A
echo 3. Restaurar Conta A
echo 4. Excluir novamente
echo 5. Excluir permanentemente
echo 6. Confirmar Conta B e SUPER_ADMIN intactos
echo.
echo Log:
echo %LOG_FILE%
echo.

endlocal
exit /b 0
