#!/usr/bin/env python3
"""Low-impact production checks for the self-hosted TecEscola VPS."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


APP_ORIGIN = os.environ.get("TECESCOLA_APP_ORIGIN", "https://tecescola.grupotec.dev.br").rstrip("/")
API_ORIGIN = os.environ.get("TECESCOLA_API_ORIGIN", "https://api-edu-vps.grupotec.dev.br").rstrip("/")
BACKUP_ROOT = Path(os.environ.get("LOCAL_BACKUP_ROOT", "/srv/grupotec/backups/edumoney"))
OFFSITE_REMOTE = os.environ.get("OFFSITE_REMOTE", "gdrive-backups:tecescola-offsite").rstrip("/")
OFFSITE_STATE = Path(os.environ.get("OFFSITE_STATE_FILE", "/var/lib/tecescola-ops/offsite-backup.state"))
MONITOR_STATE = Path(os.environ.get("MONITOR_STATE_FILE", "/var/lib/tecescola-pilot-monitor/state.json"))
DB_CONTAINER = os.environ.get("EDUMONEY_DB_CONTAINER", "supabase-edumoney-db")
CADDY_CONTAINER = os.environ.get("CADDY_CONTAINER", "grupotec-edge")
VERIFY_SCRIPT = Path(os.environ.get(
    "BACKUP_VERIFY_SCRIPT",
    "/srv/grupotec/bin/verify-edumoney-bundle-stream.py",
))
HTTP_CHECKS = {"frontend", "backend", "auth", "postgrest"}
TIMEOUT_SECONDS = 8


def http_get(url: str, headers: dict[str, str] | None = None) -> tuple[int, bytes]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TecEscola-Pilot-Monitor/1.0", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, response.read(2_000_000)
    except urllib.error.HTTPError as error:
        return error.code, error.read(4096)


def discover_publishable_key(html: bytes) -> str:
    text = html.decode("utf-8", errors="replace")
    match = re.search(r'<script[^>]+src=["\']([^"\']+\.js[^"\']*)["\']', text, re.IGNORECASE)
    if not match:
        raise ValueError("app bundle missing")
    bundle_url = urllib.parse.urljoin(f"{APP_ORIGIN}/", match.group(1))
    status, bundle = http_get(bundle_url)
    if status != 200:
        raise ValueError("app bundle unavailable")
    escaped_api = re.escape(API_ORIGIN)
    key_match = re.search(rf'"{escaped_api}",[\w$]+="(eyJ[^"\s]+)"', bundle.decode("utf-8", errors="replace"))
    if not key_match:
        raise ValueError("publishable key unavailable")
    return key_match.group(1)


def check_frontend() -> tuple[str, str]:
    status, body = http_get(f"{APP_ORIGIN}/")
    html = body.decode("utf-8", errors="replace").lower()
    if status != 200 or "<html" not in html or not re.search(r'<div[^>]+id=["\']root["\']', html):
        return "FAIL", f"http={status} app_shell=missing"
    if not re.search(r'<script[^>]+src=["\'][^"\']+\.js', html):
        return "FAIL", "app_bundle=missing"
    return "PASS", "http=200 app_shell=present"


def check_backend() -> tuple[str, str]:
    _, html = http_get(f"{APP_ORIGIN}/")
    key = discover_publishable_key(html)
    status, _ = http_get(f"{API_ORIGIN}/auth/v1/health", {"apikey": key})
    if status != 200:
        return "FAIL", f"api_health_http={status}"
    return "PASS", "api_health_http=200"


def check_auth_and_rest() -> dict[str, tuple[str, str]]:
    try:
        status, html = http_get(f"{APP_ORIGIN}/")
        if status != 200:
            raise ValueError("app unavailable")
        key = discover_publishable_key(html)
    except Exception:
        return {"auth": ("FAIL", "probe_configuration_unavailable"), "postgrest": ("FAIL", "probe_configuration_unavailable")}

    headers = {"apikey": key}
    try:
        auth_status, _ = http_get(f"{API_ORIGIN}/auth/v1/health", headers)
        auth = ("PASS", f"http={auth_status}") if auth_status == 200 else ("FAIL", f"http={auth_status}")
    except Exception:
        auth = ("FAIL", "request_failed")

    try:
        rest_status, body = http_get(
            f"{API_ORIGIN}/rest/v1/institutions?select=id&limit=0",
            headers,
        )
        valid_body = rest_status == 200 and body.strip().startswith(b"[")
        postgrest = ("PASS", "http=200 read_only=ok") if valid_body else ("FAIL", f"http={rest_status}")
    except Exception:
        postgrest = ("FAIL", "request_failed")
    return {"auth": auth, "postgrest": postgrest}


def check_postgres() -> tuple[str, str]:
    result = subprocess.run(
        ["docker", "exec", DB_CONTAINER, "pg_isready", "-U", "postgres", "-d", "postgres"],
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SECONDS,
        check=False,
    )
    return ("PASS", "pg_isready=accepting") if result.returncode == 0 else ("FAIL", "pg_isready=not_accepting")


def check_disk() -> tuple[str, str]:
    paths = [Path("/"), BACKUP_ROOT, Path("/srv/grupotec/supabase-projects/edumoney/volumes/storage")]
    usage = [shutil.disk_usage(path) for path in paths if path.exists()]
    if not usage:
        return "FAIL", "no_monitored_filesystem"
    max_used = max(item.used / item.total for item in usage)
    percent = int(max_used * 100)
    if percent >= 90:
        return "CRITICAL", f"used_percent={percent}"
    if percent >= 80:
        return "WARNING", f"used_percent={percent}"
    return "PASS", f"used_percent={percent}"


def latest_backup() -> Path | None:
    candidates = list(BACKUP_ROOT.glob("edumoney-*.tar.gz"))
    return max(candidates, key=lambda item: item.stat().st_mtime, default=None)


def check_local_backup(now: datetime) -> tuple[str, str]:
    archive = latest_backup()
    if archive is None or archive.stat().st_size < 1_000_000:
        return "FAIL", "artifact_missing_or_too_small"
    age_hours = (now.timestamp() - archive.stat().st_mtime) / 3600
    if age_hours < -0.1 or age_hours > 26:
        return "FAIL", f"age_hours={age_hours:.1f}"
    try:
        with archive.open("rb") as source:
            result = subprocess.run(
                [sys.executable, str(VERIFY_SCRIPT), "--check"],
                stdin=source,
                capture_output=True,
                timeout=30,
                check=False,
            )
    except Exception:
        return "FAIL", "integrity_check_unavailable"
    if result.returncode != 0:
        return "FAIL", f"age_hours={age_hours:.1f} integrity=fail"
    return "PASS", f"age_hours={age_hours:.1f} integrity=pass bytes={archive.stat().st_size}"


def check_offsite_backup(now: datetime) -> tuple[str, str]:
    try:
        fields = dict(
            line.split("=", 1)
            for line in OFFSITE_STATE.read_text(encoding="utf-8").splitlines()
            if "=" in line
        )
        completed = datetime.strptime(fields["completed_at_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        age_hours = (now - completed).total_seconds() / 3600
        if fields.get("status") != "SUCCESS" or age_hours > 26 or age_hours < -0.1:
            return "FAIL", f"state={fields.get('status', 'missing')} age_hours={age_hours:.1f}"
        artifact = fields["artifact"]
        if not re.fullmatch(r"edumoney-[A-Za-z0-9TZ:.-]+\.tar\.gz\.age", artifact):
            return "FAIL", "artifact_name_invalid"
        remote_file = f"{OFFSITE_REMOTE}/{artifact}"
        result = subprocess.run(
            ["rclone", "lsjson", "--stat", remote_file],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if result.returncode != 0:
            return "FAIL", "remote_object_unavailable"
        remote_info = json.loads(result.stdout)
        if int(remote_info.get("Size", 0)) <= 0 or int(remote_info["Size"]) != int(fields["bytes"]):
            return "FAIL", "remote_object_size_mismatch"
        return "PASS", f"age_hours={age_hours:.1f} remote_object=verified bytes={remote_info['Size']}"
    except Exception:
        return "FAIL", "offsite_state_or_remote_unavailable"


def check_tls(hostname: str) -> tuple[str, str]:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=TIMEOUT_SECONDS) as raw_socket:
            with context.wrap_socket(raw_socket, server_hostname=hostname) as tls_socket:
                certificate = tls_socket.getpeercert()
        expires = datetime.strptime(certificate["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days = int((expires - datetime.now(timezone.utc)).total_seconds() // 86400)
        if days < 7:
            return "CRITICAL", f"days_remaining={days}"
        if days < 14:
            return "WARNING", f"days_remaining={days}"
        return "PASS", f"days_remaining={days}"
    except Exception:
        return "FAIL", "tls_handshake_or_certificate_failed"


def check_http_5xx() -> tuple[str, str]:
    result = subprocess.run(
        ["docker", "logs", "--since", "5m", "--tail", "10000", CADDY_CONTAINER],
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SECONDS,
        check=False,
    )
    statuses: list[int] = []
    for line in result.stdout.splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        value = record.get("status", record.get("status_code", record.get("statusCode")))
        if isinstance(value, int):
            statuses.append(value)
    if not statuses:
        return "UNKNOWN", "proxy_access_logs_without_http_status"
    errors = sum(500 <= status < 600 for status in statuses)
    rate = errors / len(statuses)
    if errors >= 5 or (len(statuses) >= 50 and rate > 0.02):
        return "CRITICAL", f"http_5xx={errors} requests={len(statuses)} rate_percent={rate * 100:.1f}"
    return "PASS", f"http_5xx={errors} requests={len(statuses)}"


def advance_state(
    previous: dict[str, object], check_name: str, status: str, min_failures: int = 1
) -> tuple[dict[str, object], str | None]:
    checks = previous.setdefault("checks", {})
    current = checks.get(check_name, {})
    current = current if isinstance(current, dict) else {}
    failures = int(current.get("consecutive_failures", 0))
    failures = failures + 1 if status in {"FAIL", "CRITICAL"} else 0
    if status == "WARNING" or status == "UNKNOWN":
        severity = "WARNING"
    elif status in {"FAIL", "CRITICAL"} and failures >= min_failures:
        severity = "CRITICAL"
    else:
        severity = "OK"

    old_severity = str(current.get("alert_severity", "OK"))
    event = None
    if severity != old_severity:
        if severity == "OK" and old_severity != "OK":
            event = "RECOVERY"
        elif severity != "OK":
            event = "ALERT"

    checks[check_name] = {
        "status": status,
        "consecutive_failures": failures,
        "alert_severity": severity,
    }
    return previous, event


def load_state(path: Path) -> dict[str, object]:
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        return state if isinstance(state, dict) else {"checks": {}}
    except (OSError, json.JSONDecodeError):
        return {"checks": {}}


def run_self_test() -> None:
    state: dict[str, object] = {"checks": {}}
    sequence = ["PASS", "FAIL", "FAIL", "FAIL", "PASS"]
    events = [advance_state(state, "auth", status, min_failures=2)[1] for status in sequence]
    if events != [None, None, "ALERT", None, "RECOVERY"]:
        raise SystemExit("MONITOR_STATE_TEST=FAIL")
    print("MONITOR_STATE_TEST=PASS failure_threshold=2 spam_suppressed=recovery_emitted")


def run_checks() -> dict[str, tuple[str, str]]:
    now = datetime.now(timezone.utc)
    def safe(call):
        try:
            return call()
        except Exception:
            return "FAIL", "check_execution_failed"

    results = {
        "frontend": safe(check_frontend),
        "backend": safe(check_backend),
        "postgres": safe(check_postgres),
        "disk": safe(check_disk),
        "local_backup": safe(lambda: check_local_backup(now)),
        "offsite_backup": safe(lambda: check_offsite_backup(now)),
        "tls_frontend": safe(lambda: check_tls(urllib.parse.urlparse(APP_ORIGIN).hostname or "")),
        "tls_backend": safe(lambda: check_tls(urllib.parse.urlparse(API_ORIGIN).hostname or "")),
        "http_5xx": safe(check_http_5xx),
    }
    try:
        results.update(check_auth_and_rest())
    except Exception:
        results.update({"auth": ("FAIL", "check_execution_failed"), "postgrest": ("FAIL", "check_execution_failed")})
    return results


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test-state":
        run_self_test()
        return

    now = datetime.now(timezone.utc)
    state = load_state(MONITOR_STATE)
    state["run_count"] = int(state.get("run_count", 0)) + 1
    state["last_run_utc"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    checks = state.setdefault("checks", {})
    failures = 0
    for name, (status, detail) in run_checks().items():
        print(f"CHECK name={name} status={status} detail={detail}")
        minimum = 2 if name in HTTP_CHECKS else 1
        state, event = advance_state(state, name, status, minimum)
        if event:
            severity = state["checks"][name]["alert_severity"]
            print(f"{event} severity={severity} check={name} detail={detail}")
        if status in {"FAIL", "CRITICAL"}:
            failures += 1

    MONITOR_STATE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=MONITOR_STATE.parent, delete=False) as output:
        json.dump(state, output, separators=(",", ":"))
        output.write("\n")
        temp_path = Path(output.name)
    temp_path.chmod(0o600)
    temp_path.replace(MONITOR_STATE)
    MONITOR_STATE.parent.chmod(0o700)
    print(f"MONITOR_RUN=COMPLETE checks={len(state['checks'])} failures={failures} run_count={state['run_count']}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
