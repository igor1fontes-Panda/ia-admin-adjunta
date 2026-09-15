#!/bin/sh
# Workspace shell environment — durable across ALL shell modes.
# Sources:
#   - /etc/profile.d/workspace-env.sh (login shells: bash -l, bash -il)
#   - project scripts via `sh -lc '. ./scripts/workspace-env.sh; ...'`
#
# Fixes the recurring "tool not found in login shells" problem: everything a
# shell session needs lives here, and profile.d + .bashrc + .profile all
# source it. Idempotent and safe to source any number of times.

# --- npm registry connection resilience (permanent, all shells) ---
export NPM_CONFIG_FUND="${NPM_CONFIG_FUND:-false}"
export NPM_CONFIG_AUDIT="${NPM_CONFIG_AUDIT:-false}"
export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MINTIMEOUT:-2000}"
export NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT:-60000}"
export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-120000}"
export NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"

# --- local bins that must be visible in every shell mode ---
case ":$PATH:" in
  *":/home/daytona/.local/bin:"*) ;;
  *) export PATH="/home/daytona/.local/bin:$PATH" ;;
esac
case ":$PATH:" in
  *":./node_modules/.bin:"*) ;;
  *) export PATH="./node_modules/.bin:$PATH" ;;
esac

# --- workspace marker ---
export FREEBUFF_WORKSPACE_ROOT="${FREEBUFF_WORKSPACE_ROOT:-/home/daytona/codebase}"
