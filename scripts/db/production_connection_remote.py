#!/usr/bin/env python3
"""Read the authorized Compose database configuration on the TecEscola VPS."""

from __future__ import annotations

import json
import os
import platform
import stat
import subprocess
import sys
from pathlib import Path

EXPECTED_HOST = "grupotec.vps-kinghost.net"
ENV_FILE = Path("/srv/grupotec/supabase-projects/edumoney/.env")
COMPOSE_FILE = Path("/srv/grupotec/supabase-projects/edumoney/docker-compose.yml")
CONTAINER = "supabase-edumoney-db"
EXPECTED_PROJECT = "edumoney"


class ConfigurationError(RuntimeError):
    pass


def validate_secret_file_attributes(
    *, owner_uid: int, owner_gid: int, mode: int, is_regular: bool
) -> None:
    if owner_uid != 0 or owner_gid != 0 or mode != 0o600 or not is_regular:
        raise ConfigurationError("persistent_secret_permissions_invalid")


def parse_compose_configuration(raw: str) -> tuple[str, str, str]:
    try:
        config = json.loads(raw)
        environment = config["services"]["db"]["environment"]
        if isinstance(environment, list):
            environment = dict(item.split("=", 1) for item in environment)
        password = environment["POSTGRES_PASSWORD"]
        user = environment.get("POSTGRES_USER", "postgres")
        database = environment.get("POSTGRES_DB", "postgres")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ConfigurationError("database_compose_configuration_invalid") from error

    if not isinstance(password, str) or not password or any(ch in password for ch in "\x00\r\n"):
        raise ConfigurationError("database_password_unavailable")
    if user != "postgres" or database != "postgres":
        raise ConfigurationError("database_connection_identity_unexpected")
    return password, user, database


def parse_container_environment(raw: str) -> tuple[str, str, str]:
    try:
        entries = json.loads(raw)
        environment = (
            dict(item.split("=", 1) for item in entries)
            if isinstance(entries, list)
            else entries
        )
        password = environment["POSTGRES_PASSWORD"]
        user = environment.get("POSTGRES_USER", "postgres")
        database = environment.get("POSTGRES_DB", "postgres")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ConfigurationError("database_runtime_configuration_invalid") from error

    if not isinstance(password, str) or not password or any(ch in password for ch in "\x00\r\n"):
        raise ConfigurationError("database_runtime_password_unavailable")
    if user not in {"postgres", "supabase_admin"} or database != "postgres":
        raise ConfigurationError("database_connection_identity_unexpected")
    return password, user, database


def validate_runtime_configuration(
    compose: tuple[str, str, str], runtime: tuple[str, str, str]
) -> None:
    if compose[0] != runtime[0] or compose[2] != runtime[2]:
        raise ConfigurationError("database_compose_runtime_configuration_mismatch")


def parse_container_metadata(labels_raw: str, ports_raw: str, running_raw: str) -> int:
    try:
        labels = json.loads(labels_raw)
        ports = json.loads(ports_raw)
    except json.JSONDecodeError as error:
        raise ConfigurationError("database_container_metadata_invalid") from error

    config_files = labels.get("com.docker.compose.project.config_files", "").split(",")
    if (
        labels.get("com.docker.compose.project") != EXPECTED_PROJECT
        or labels.get("com.docker.compose.service") != "db"
        or str(COMPOSE_FILE) not in config_files
        or labels.get("com.docker.compose.project.environment_file") != str(ENV_FILE)
        or labels.get("com.docker.compose.project.working_dir") != str(COMPOSE_FILE.parent)
        or running_raw.strip().lower() != "true"
    ):
        raise ConfigurationError("database_container_identity_unexpected")

    bindings = ports.get("5432/tcp") or []
    if len(bindings) != 1 or bindings[0].get("HostIp") != "127.0.0.1":
        raise ConfigurationError("database_loopback_binding_unexpected")
    try:
        port = int(bindings[0]["HostPort"])
    except (KeyError, TypeError, ValueError) as error:
        raise ConfigurationError("database_host_port_invalid") from error
    if not 1 <= port <= 65535:
        raise ConfigurationError("database_host_port_invalid")
    return port


def _run(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as error:
        raise ConfigurationError("authorized_database_configuration_unavailable") from error
    return result.stdout


def load_connection() -> tuple[dict[str, object], str]:
    try:
        secret_stat = ENV_FILE.lstat()
    except OSError as error:
        raise ConfigurationError("persistent_secret_file_unavailable") from error

    validate_secret_file_attributes(
        owner_uid=secret_stat.st_uid,
        owner_gid=secret_stat.st_gid,
        mode=stat.S_IMODE(secret_stat.st_mode),
        is_regular=stat.S_ISREG(secret_stat.st_mode) and not stat.S_ISLNK(secret_stat.st_mode),
    )
    if os.geteuid() != 0:
        raise ConfigurationError("authorized_vps_executor_must_be_root")

    hostname = _run(["hostname"]).strip()
    if hostname != EXPECTED_HOST or platform.node() not in (hostname, hostname.split(".")[0]):
        raise ConfigurationError("authorized_vps_identity_mismatch")

    labels = _run(["docker", "inspect", "--format", "{{json .Config.Labels}}", CONTAINER])
    ports = _run(["docker", "inspect", "--format", "{{json .NetworkSettings.Ports}}", CONTAINER])
    running = _run(["docker", "inspect", "--format", "{{.State.Running}}", CONTAINER])
    host_port = parse_container_metadata(labels, ports, running)

    compose_raw = _run(
        [
            "docker",
            "compose",
            "--env-file",
            str(ENV_FILE),
            "-f",
            str(COMPOSE_FILE),
            "config",
            "--format",
            "json",
        ]
    )
    password, user, database = parse_compose_configuration(compose_raw)
    runtime_environment = _run(
        ["docker", "inspect", "--format", "{{json .Config.Env}}", CONTAINER]
    )
    runtime_password, runtime_user, runtime_database = parse_container_environment(runtime_environment)
    validate_runtime_configuration(
        (password, user, database), (runtime_password, runtime_user, runtime_database)
    )
    metadata: dict[str, object] = {
        "vps_identity": hostname,
        "executor": "root",
        "secret_path": str(ENV_FILE),
        "secret_owner": "root:root",
        "secret_mode": "600",
        "compose_project": EXPECTED_PROJECT,
        "database_container": CONTAINER,
        "database_host_port": host_port,
        "database_user": user,
        "database_name": database,
    }
    return metadata, password


def main() -> int:
    if sys.argv[1:] not in (["--describe"], ["--password"]):
        print("connection_helper_usage_error", file=sys.stderr)
        return 2
    try:
        metadata, password = load_connection()
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        return 1

    if sys.argv[1] == "--describe":
        print(json.dumps(metadata, sort_keys=True))
    else:
        sys.stdout.write(password)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
