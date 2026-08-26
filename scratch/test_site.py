"""Lightweight smoke test for the static GREATNESS portal.

The test intentionally verifies stable structural contracts rather than volatile
business content such as roster names, vehicle counts, or prices.
"""
from pathlib import Path
import sys
import urllib.request

BASE_URL = "http://localhost:8000"


def fetch(path: str) -> str:
    with urllib.request.urlopen(f"{BASE_URL}/{path}", timeout=5) as response:
        return response.read().decode("utf-8")


def main() -> int:
    html = fetch("index.html")

    required_html = {
        'id="nav-menu"': "main navigation",
        'id="home"': "home section",
        'id="jobs"': "jobs section",
        'id="fleet"': "fleet section",
        'id="prices"': "prices section",
        'id="contracts"': "contracts section",
        'id="gallery"': "gallery section",
        'href="css/main.css"': "modular stylesheet entry point",
        'src="js/app.js"': "JavaScript bootstrap",
    }

    failures = []
    for token, description in required_html.items():
        if token in html:
            print(f"[PASS] {description}")
        else:
            failures.append(f"[FAIL] Missing {description}: {token}")

    required_files = [
        "css/main.css",
        "css/base.css",
        "css/sections/contracts.css",
        "js/app.js",
        "js/modules/navigation.js",
        "js/modules/contracts.js",
    ]

    for relative_path in required_files:
        if Path(relative_path).is_file():
            print(f"[PASS] {relative_path}")
        else:
            failures.append(f"[FAIL] Missing file: {relative_path}")

    if failures:
        print("\nSmoke test failures:")
        print("\n".join(failures))
        return 1

    print("\nStatic structure smoke test passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
