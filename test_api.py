import requests
import concurrent.futures
import os

pat = os.getenv("GITHUB_PAT", "YOUR_GITHUB_PAT")
headers = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github.v3+json"}
repos = []

print("Fetching repos...")
owner_res = requests.get("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner", headers=headers, timeout=5)
print(f"Status: {owner_res.status_code}")
if owner_res.status_code == 200:
    repos.extend(owner_res.json())

db_items = []

def fetch_repo_data(repo):
    repo_name = repo.get("full_name")
    if not repo_name: return None
    repo_updated_at = repo.get("updated_at", "")
    
    db_item = None
    try:
        runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?per_page=1"
        runs_res = requests.get(runs_url, headers=headers, timeout=3)
        if runs_res.status_code == 200:
            runs_data = runs_res.json()
            runs = runs_data.get("workflow_runs", [])
            if runs:
                run = runs[0]
                db_item = {
                    "commit_sha": run.get("head_sha", ""),
                    "repository": repo_name,
                }
            else:
                commits_url = f"https://api.github.com/repos/{repo_name}/commits?per_page=1"
                commits_res = requests.get(commits_url, headers=headers, timeout=3)
                if commits_res.status_code == 200:
                    commits = commits_res.json()
                    if commits and isinstance(commits, list) and len(commits) > 0:
                        db_item = {
                            "repository": repo_name,
                        }
    except Exception as e:
        print(f"Error on {repo_name}: {e}")
    
    if not db_item:
        db_item = {
            "repository": repo_name,
            "status": "completed",
        }
    
    return db_item

if repos:
    print(f"Found {len(repos)} repos, fetching workflows...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(fetch_repo_data, repos)
        for item in results:
            if item:
                db_items.append(item)

print(f"Total db_items: {len(db_items)}")
