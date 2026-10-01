#!/usr/bin/env bash
set -euo pipefail

printf 'captured_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '\n[uptime]\n'
uptime
printf '\n[memory]\n'
free -h
printf '\n[disk]\n'
df -h
printf '\n[inodes]\n'
df -ih

if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  printf '\nDOCKER=FAIL\n'
  exit 1
fi

printf '\n[compose_projects]\n'
docker compose ls --all
printf '\n[containers_all]\n'
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
printf '\n[container_resource_snapshot]\n'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}'
printf '\n[restart_counts]\n'
while IFS= read -r container; do
  [[ -n "$container" ]] || continue
  docker inspect --format '{{.Name}} image={{.Config.Image}} image_id={{.Image}} compose_project={{index .Config.Labels "com.docker.compose.project"}} compose_service={{index .Config.Labels "com.docker.compose.service"}} restarts={{.RestartCount}} state={{.State.Status}} health={{with index .State "Health"}}{{.Status}}{{else}}n/a{{end}} restart_policy={{.HostConfig.RestartPolicy.Name}} ports={{json .NetworkSettings.Ports}} networks={{range $name, $network := .NetworkSettings.Networks}}{{$name}},{{end}} created={{.Created}}' "$container"
done < <(docker ps -aq)
printf '\n[networks]\n'
docker network ls
printf '\n[volumes]\n'
docker volume ls
printf '\n[docker_disk_usage]\n'
docker system df
printf '\nDOCKER=PASS\n'
