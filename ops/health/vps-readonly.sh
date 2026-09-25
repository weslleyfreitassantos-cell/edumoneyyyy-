#!/usr/bin/env bash
set -euo pipefail

printf 'captured_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '\n[uptime]\n'
uptime
printf '\n[memory]\n'
free -h
printf '\n[disk]\n'
df -h

if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  printf '\nDOCKER=FAIL\n'
  exit 1
fi

printf '\n[containers]\n'
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
printf '\n[container_resource_snapshot]\n'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}'
printf '\n[restart_counts]\n'
for container in $(docker ps -q); do
  docker inspect --format '{{.Name}} restarts={{.RestartCount}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$container"
done
printf '\nDOCKER=PASS\n'
