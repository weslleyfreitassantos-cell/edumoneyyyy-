#!/usr/bin/env bash

# Retired compatibility path. Production promotion sources policy V14 directly.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf 'PROMOTION_POLICY_RETIRED=use_promote-single-migration-policy-v14.sh\n' >&2
  exit 2
fi
