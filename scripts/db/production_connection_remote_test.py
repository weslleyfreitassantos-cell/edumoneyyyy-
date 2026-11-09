#!/usr/bin/env python3
"""Unit tests for the secret-free VPS metadata and Compose source parser."""

from __future__ import annotations

import json
import unittest

import production_connection_remote as connection


class ProductionConnectionRemoteTests(unittest.TestCase):
    def test_secret_file_requires_root_only_regular_file(self) -> None:
        connection.validate_secret_file_attributes(owner_uid=0, owner_gid=0, mode=0o600, is_regular=True)
        for owner_uid, owner_gid, mode, regular in (
            (1000, 0, 0o600, True), (0, 1000, 0o600, True),
            (0, 0, 0o640, True), (0, 0, 0o600, False),
        ):
            with self.subTest(owner_uid=owner_uid, owner_gid=owner_gid, mode=oct(mode), regular=regular):
                with self.assertRaises(connection.ConfigurationError):
                    connection.validate_secret_file_attributes(
                        owner_uid=owner_uid, owner_gid=owner_gid, mode=mode, is_regular=regular
                    )

    def test_compose_parser_returns_only_expected_database_identity(self) -> None:
        secret = "synthetic-fixture-password-not-production"
        config = {
            "services": {
                "db": {
                    "environment": {
                        "POSTGRES_PASSWORD": secret,
                        "POSTGRES_USER": "postgres",
                        "POSTGRES_DB": "postgres",
                    }
                }
            }
        }
        result = connection.parse_compose_configuration(json.dumps(config))
        self.assertEqual(result, (secret, "postgres", "postgres"))

    def test_compose_parser_rejects_wrong_database_user_and_empty_secret(self) -> None:
        for environment in (
            {"POSTGRES_PASSWORD": "fixture", "POSTGRES_USER": "root", "POSTGRES_DB": "postgres"},
            {"POSTGRES_PASSWORD": "", "POSTGRES_USER": "postgres", "POSTGRES_DB": "postgres"},
        ):
            with self.subTest(environment=environment):
                raw = json.dumps({"services": {"db": {"environment": environment}}})
                with self.assertRaises(connection.ConfigurationError):
                    connection.parse_compose_configuration(raw)

    def test_runtime_container_environment_must_match_compose_credentials(self) -> None:
        secret = "synthetic-fixture-password-not-production"
        raw = json.dumps(
            [
                f"POSTGRES_PASSWORD={secret}",
                "POSTGRES_USER=postgres",
                "POSTGRES_DB=postgres",
            ]
        )
        self.assertEqual(
            connection.parse_container_environment(raw),
            (secret, "postgres", "postgres"),
        )
        runtime_admin = json.dumps(
            [
                f"POSTGRES_PASSWORD={secret}",
                "POSTGRES_USER=supabase_admin",
                "POSTGRES_DB=postgres",
            ]
        )
        runtime = connection.parse_container_environment(runtime_admin)
        connection.validate_runtime_configuration((secret, "postgres", "postgres"), runtime)
        for invalid in (
            json.dumps(["POSTGRES_PASSWORD=", "POSTGRES_USER=postgres", "POSTGRES_DB=postgres"]),
            json.dumps(["POSTGRES_PASSWORD=fixture", "POSTGRES_USER=unexpected", "POSTGRES_DB=postgres"]),
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(connection.ConfigurationError):
                    connection.parse_container_environment(invalid)

        with self.assertRaises(connection.ConfigurationError):
            connection.validate_runtime_configuration(
                (secret, "postgres", "postgres"), ("different-fixture", "postgres", "postgres")
            )

    def test_container_must_be_the_expected_project_and_loopback_only(self) -> None:
        labels = {
            "com.docker.compose.project": "edumoney",
            "com.docker.compose.service": "db",
            "com.docker.compose.project.config_files": str(connection.COMPOSE_FILE),
            "com.docker.compose.project.environment_file": str(connection.ENV_FILE),
            "com.docker.compose.project.working_dir": str(connection.COMPOSE_FILE.parent),
        }
        ports = {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "55435"}]}
        port = connection.parse_container_metadata(json.dumps(labels), json.dumps(ports), "true")
        self.assertEqual(port, 55435)

        ports["5432/tcp"][0]["HostIp"] = "0.0.0.0"
        with self.assertRaises(connection.ConfigurationError):
            connection.parse_container_metadata(json.dumps(labels), json.dumps(ports), "true")

        ports["5432/tcp"][0]["HostIp"] = "127.0.0.1"
        labels["com.docker.compose.project.environment_file"] = "/tmp/unapproved.env"
        with self.assertRaises(connection.ConfigurationError):
            connection.parse_container_metadata(json.dumps(labels), json.dumps(ports), "true")

    def test_descriptive_metadata_does_not_contain_fixture_secret(self) -> None:
        secret = "synthetic-fixture-password-not-production"
        config = {"services": {"db": {"environment": {"POSTGRES_PASSWORD": secret}}}}
        parsed_secret, _, _ = connection.parse_compose_configuration(json.dumps(config))
        descriptive_metadata = json.dumps(
            {
                "vps_identity": connection.EXPECTED_HOST,
                "database_container": connection.CONTAINER,
                "database_host_port": 55435,
                "database_user": "postgres",
            }
        )
        self.assertEqual(parsed_secret, secret)
        self.assertNotIn(secret, descriptive_metadata)


if __name__ == "__main__":
    unittest.main()
