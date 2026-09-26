#!/usr/bin/env python3
"""Records the answers of the public GitHub API that the simulation replays.

Runs without a token, so it can only record public data: the authenticated user
of the simulation is the public profile of `octocat`, and the codespace list,
which GitHub never shows without a token, stays the hand-written
fixtures/codespaces.json. Every list is cut to one entry, as the end-to-end
tests ask for `per_page: 1`.

Usage: test/fake-github/record-fixtures.py
"""
import json
import pathlib
import time
import urllib.error
import urllib.request

API = 'https://api.github.com'
FIXTURES = pathlib.Path(__file__).resolve().parent / 'fixtures'
RECORD = {
    'user': '/users/octocat',
    'search-repositories': '/search/repositories?q=topic:mcp+language:typescript&per_page=1',
    'repo': '/repos/octocat/Hello-World',
    'branches': '/repos/octocat/Hello-World/branches?per_page=1',
    'commits': '/repos/octocat/Hello-World/commits?per_page=1',
    'git-ref': '/repos/octocat/Hello-World/git/ref/heads/master',
    'pulls': '/repos/octocat/Hello-World/pulls?state=all&per_page=1',
    'issues': '/repos/octocat/Hello-World/issues?per_page=1',
    'labels': '/repos/octocat/Hello-World/labels?per_page=1',
    'releases': '/repos/octocat/Hello-World/releases?per_page=1',
    'workflows': '/repos/mwaeckerlin/mcp-github/actions/workflows?per_page=1',
    'combined-status': '/repos/octocat/Hello-World/commits/master/status',
    'events': '/events?per_page=1',
    'deployments': '/repos/octocat/Hello-World/deployments?per_page=1',
    'rate-limit': '/rate_limit',
    'org-projects': '/orgs/github/projects?per_page=1',
}


def fetch(path):
    request = urllib.request.Request(API + path, headers={
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'mcp-github-fixture-recorder',
    })
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
        except (urllib.error.URLError, TimeoutError) as error:
            print(f'  {path}: {error}, attempt {attempt + 1}')
            time.sleep(5)
    raise SystemExit(f'{path}: GitHub did not answer')


for name, path in RECORD.items():
    status, body = fetch(path)
    if isinstance(body, list):
        body = body[:1]
    if body is None:
        raise SystemExit(f'{path}: empty answer')
    (FIXTURES / f'{name}.json').write_text(json.dumps({'status': status, 'body': body}, indent=2) + '\n', encoding='utf-8')
    print(name, status)
