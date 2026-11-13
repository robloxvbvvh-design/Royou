#!/usr/bin/env bash
# Поиск репозиториев на GitHub: scripts/find_github.sh "text to image api" [N]
q="${1:?usage: find_github.sh \"query\" [N]}"; n="${2:-10}"
gh api -X GET search/repositories -f q="$q" -f sort=stars -f per_page="$n" \
  --jq '.items[] | [.full_name, .stargazers_count, (.license.spdx_id // "no-license"), .pushed_at[0:10], .html_url] | @tsv' \
  | column -t -s $'\t'
