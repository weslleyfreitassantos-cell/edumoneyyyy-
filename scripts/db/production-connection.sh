#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

root_dir="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'CONNECTION_ABORTED=repository_checkout_required\n' >&2
  exit 1
}
expected_origin='https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
origin="$(git -C "$root_dir" remote get-url origin 2>/dev/null)" || {
  printf 'CONNECTION_ABORTED=repository_origin_unavailable\n' >&2
  exit 1
}
if [[ "$origin" != "$expected_origin" && "$origin" != 'git@github.com:weslleyfreitassantos-cell/edumoneyyyy-.git' ]]; then
  printf 'CONNECTION_ABORTED=repository_not_authorized_for_tecescola_database\n' >&2
  exit 1
fi

ssh_alias="${TECESCOLA_SSH_ALIAS:-tecescola-vps}"
database_user="${TECESCOLA_DATABASE_USER:-supabase_admin}"
expected_host='grupotec.vps-kinghost.net'
remote_helper="$root_dir/scripts/db/production_connection_remote.py"
preflight_sql="$root_dir/scripts/db/production-preflight.sql"
for required_file in "$remote_helper" "$preflight_sql"; do
  [[ -f "$required_file" ]] || {
    printf 'CONNECTION_ABORTED=required_versioned_helper_missing\n' >&2
    exit 1
  }
done
if [[ "$database_user" != 'postgres' && "$database_user" != 'supabase_admin' ]]; then
  printf 'CONNECTION_ABORTED=database_user_not_allowlisted\n' >&2
  exit 1
fi

resolve_psql() {
  command -v psql >/dev/null 2>&1 && return 0
  local candidate
  for candidate in /c/Program\ Files/PostgreSQL/*/bin/psql.exe; do
    if [[ -f "$candidate" ]]; then
      PATH="$(dirname "$candidate"):$PATH"
      export PATH
      command -v psql >/dev/null 2>&1 && return 0
    fi
  done
  return 1
}

remote_helper_call() {
  local action="$1"
  ssh -T -o BatchMode=yes "$ssh_alias" "python3 - $action" < "$remote_helper" 2>/dev/null
}

load_connection() {
  command -v ssh >/dev/null 2>&1 || {
    printf 'CONNECTION_ABORTED=ssh_unavailable\n' >&2
    return 1
  }
  command -v node >/dev/null 2>&1 || {
    printf 'CONNECTION_ABORTED=node_unavailable\n' >&2
    return 1
  }
  resolve_psql || {
    printf 'CONNECTION_ABORTED=psql_unavailable\n' >&2
    return 1
  }

  local metadata
  if ! metadata="$(remote_helper_call --describe)"; then
    printf 'SSH_ACCESS=FAIL\nVPS_IDENTITY=FAIL\nPERSISTENT_SECRET_STORAGE=FAIL\n' >&2
    return 1
  fi
  local remote_port
  if ! remote_port="$(printf '%s' "$metadata" | EXPECTED_HOST="$expected_host" node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        if (data.vps_identity !== process.env.EXPECTED_HOST || data.executor !== "root" ||
            data.secret_owner !== "root:root" || data.secret_mode !== "600" ||
            data.secret_path !== "/srv/grupotec/supabase-projects/edumoney/.env" ||
            data.compose_project !== "edumoney" || data.database_container !== "supabase-edumoney-db" ||
            data.database_user !== "postgres" || data.database_name !== "postgres") throw new Error();
        const port = Number(data.database_host_port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
        process.stdout.write(String(port));
      } catch {
        process.exitCode = 1;
      }
    });
  ')"; then
    printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=FAIL\nPERSISTENT_SECRET_STORAGE=FAIL\n' >&2
    return 1
  fi

  db_password=""
  if ! db_password="$(remote_helper_call --password)" || [[ -z "$db_password" ]]; then
    printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=PASS\nPERSISTENT_SECRET_STORAGE=FAIL\n' >&2
    return 1
  fi

  local local_port encoded_password
  local_port="$(node -e 'const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})')"
  [[ "$local_port" =~ ^[0-9]{1,5}$ ]] || {
    db_password=''
    printf 'CONNECTION_ABORTED=local_tunnel_port_unavailable\n' >&2
    return 1
  }
  ssh -T -N -L "127.0.0.1:${local_port}:127.0.0.1:${remote_port}" \
    -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=2 "$ssh_alias" >/dev/null 2>&1 &
  tunnel_pid=$!
  export tunnel_pid

  local ready=0 attempt
  for attempt in {1..40}; do
    if ! kill -0 "$tunnel_pid" 2>/dev/null; then
      db_password=''
      printf 'CONNECTION_ABORTED=ssh_tunnel_failed\n' >&2
      return 1
    fi
    if LOCAL_PORT="$local_port" node -e 'const net=require("node:net");const s=net.connect(Number(process.env.LOCAL_PORT),"127.0.0.1");s.once("connect",()=>{s.destroy();process.exit(0)});s.once("error",()=>process.exit(1));setTimeout(()=>process.exit(1),200)' >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.1
  done
  if [[ "$ready" != 1 ]]; then
    db_password=''
    printf 'CONNECTION_ABORTED=ssh_tunnel_not_ready\n' >&2
    return 1
  fi

  encoded_password="$(TECESCOLA_DB_PASSWORD="$db_password" node -e 'process.stdout.write(encodeURIComponent(process.env.TECESCOLA_DB_PASSWORD))')"
  export PRODUCTION_DB_URL="postgresql://${database_user}:${encoded_password}@127.0.0.1:${local_port}/postgres?sslmode=disable"
  export TECESCOLA_PREFLIGHT_URL="postgresql://${database_user}@127.0.0.1:${local_port}/postgres?sslmode=disable"
  export TECESCOLA_LOCAL_DB_PORT="$local_port"
}

cleanup_connection() {
  PRODUCTION_DB_URL=''
  TECESCOLA_PREFLIGHT_URL=''
  db_password=''
  if [[ -n "${tunnel_pid:-}" ]]; then
    kill "$tunnel_pid" >/dev/null 2>&1 || true
    wait "$tunnel_pid" 2>/dev/null || true
    unset tunnel_pid
  fi
}

preflight_connection() {
  if ! PGPASSWORD="$db_password" psql "$TECESCOLA_PREFLIGHT_URL" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; then
    printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=PASS\nPERSISTENT_SECRET_STORAGE=PASS\nDATABASE_CONNECTIVITY=FAIL\nDATABASE_IDENTITY=NOT_VERIFIED\nSESSION_USER=NOT_VERIFIED\nCURRENT_USER=NOT_VERIFIED\nREQUIRED_ROLE_PERMISSIONS=NOT_VERIFIED\nMIGRATION_LEDGER_ACCESS=NOT_VERIFIED\n' >&2
    return 1
  fi
  local snapshot
  if ! snapshot="$(PGPASSWORD="$db_password" psql "$TECESCOLA_PREFLIGHT_URL" -X -A -t -v ON_ERROR_STOP=1 -f "$preflight_sql" 2>/dev/null)"; then
    printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=PASS\nPERSISTENT_SECRET_STORAGE=PASS\nDATABASE_CONNECTIVITY=PASS\nDATABASE_PREFLIGHT_QUERY=FAIL\nDATABASE_IDENTITY=NOT_VERIFIED\nSESSION_USER=NOT_VERIFIED\nCURRENT_USER=NOT_VERIFIED\nREQUIRED_ROLE_PERMISSIONS=NOT_VERIFIED\nMIGRATION_LEDGER_ACCESS=NOT_VERIFIED\n' >&2
    return 1
  fi
  local checks
  if ! checks="$(printf '%s' "$snapshot" | EXPECTED_CLUSTER='7687199237633114148' node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const d = JSON.parse(input.trim());
        const identity = `${d.system_identifier}|${d.database}`;
        const identityOk = identity === `${process.env.EXPECTED_CLUSTER}|postgres`;
        const rolePairOk =
          (d.session_user === "postgres" && d.current_user === "postgres" &&
            (d.is_superuser === true || d.owns_v12_protected_relations === true)) ||
          (d.session_user === "supabase_admin" && d.current_user === "supabase_admin" &&
            d.is_superuser === true) ||
          (d.session_user === "supabase_admin" && d.current_user === "postgres" &&
            (d.session_role_is_superuser === true || d.owns_v12_protected_relations === true));
        const roleOk = rolePairOk && d.can_read_cluster_identity === true &&
          d.can_create_private_objects === true && d.can_write_migration_ledger === true;
        const ledgerOk = d.can_read_migration_ledger === true && /^[0-9]{14}$/.test(d.latest_migration || "");
        console.log(`DATABASE_IDENTITY=${identityOk ? "PASS" : "FAIL"}:${identity}`);
        console.log(`SESSION_USER=${d.session_user}`);
        console.log(`CURRENT_USER=${d.current_user}`);
        console.log(`REQUIRED_ROLE_PERMISSIONS=${roleOk ? "PASS" : "FAIL"}`);
        console.log(`ROLE_CAPABILITIES=current_superuser:${d.is_superuser};session_superuser:${d.session_role_is_superuser};owns_v12_relations:${d.owns_v12_protected_relations};private_schema_create:${d.can_create_private_objects};cluster_identity_read:${d.can_read_cluster_identity};ledger_insert_update:${d.can_write_migration_ledger}`);
        console.log(`V12_RELATION_OWNERS=${JSON.stringify(d.v12_relation_owners)}`);
        console.log(`MIGRATION_LEDGER_ACCESS=${ledgerOk ? "PASS" : "FAIL"}`);
        console.log(`MIGRATION_LEDGER_WRITE=${d.can_write_migration_ledger === true ? "PASS" : "FAIL"}`);
        console.log(`LATEST_MIGRATION=${d.latest_migration || "NONE"}`);
        if (!identityOk || !roleOk || !ledgerOk) process.exitCode = 1;
      } catch {
        process.exitCode = 1;
      }
    });
  ')"; then
    printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=PASS\nPERSISTENT_SECRET_STORAGE=PASS\nDATABASE_CONNECTIVITY=PASS\n%s\n' "$checks" >&2
    return 1
  fi
  printf 'SSH_ACCESS=PASS\nVPS_IDENTITY=PASS\nPERSISTENT_SECRET_STORAGE=PASS\nDATABASE_CONNECTIVITY=PASS\nDATABASE_PREFLIGHT_QUERY=PASS\n%s\n' "$checks"
}

mode="${1:-preflight}"
case "$mode" in
  preflight)
    trap cleanup_connection EXIT INT TERM HUP
    load_connection
    preflight_connection
    ;;
  run)
    shift
    [[ "${1:-}" == '--' ]] || {
      printf 'CONNECTION_ABORTED=run_requires_double_dash\n' >&2
      exit 2
    }
    shift
    [[ "$#" -gt 0 ]] || {
      printf 'CONNECTION_ABORTED=child_command_required\n' >&2
      exit 2
    }
    trap cleanup_connection EXIT INT TERM HUP
    load_connection
    preflight_connection
    "$@"
    ;;
  *)
    printf 'Usage: %s [preflight | run -- COMMAND [ARGS...]]\n' "$0" >&2
    exit 2
    ;;
esac
