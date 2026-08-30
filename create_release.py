#!/usr/bin/env python3
import json
import subprocess
import sys

# Read release notes
with open('RELEASE_NOTES_v1.0.0.md', 'r') as f:
    body = f.read()

# Create release via GitHub API
payload = {
    "tag_name": "v1.0.0",
    "name": "v1.0.0 — Stable Production Ready",
    "body": body,
    "draft": False,
    "prerelease": False
}

payload_json = json.dumps(payload)

# Get GitHub token from environment or gh CLI
result = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True)
token = result.stdout.strip()

if not token:
    print("Error: Could not get GitHub token. Please run 'gh auth login' first.")
    sys.exit(1)

# Create release
curl_cmd = [
    'curl', '-s', '-X', 'POST',
    '-H', 'Accept: application/vnd.github.v3+json',
    '-H', f'Authorization: token {token}',
    'https://api.github.com/repos/Artemis-coder/Opti-Wifi/releases',
    '-d', payload_json
]

result = subprocess.run(curl_cmd, capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr, file=sys.stderr)
