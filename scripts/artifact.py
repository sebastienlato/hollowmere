"""Turn dist/index.html into a body-only page for publishing as a claude.ai Artifact
(the publisher wraps it in its own <html>/<head>/<body> skeleton)."""
import re
from pathlib import Path

dist = Path(__file__).resolve().parent.parent / "dist"
html = (dist / "index.html").read_text()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body[^>]*>(.*?)</body>", html, re.S).group(1)

title = re.search(r"<title>.*?</title>", head, re.S).group(0)
keep = [m.group(0) for m in re.finditer(r'<link[^>]+(?:fonts\.googleapis|fonts\.gstatic|rel="stylesheet"|rel="preload")[^>]*>', head)]
scripts = [m.group(0) for m in re.finditer(r"<script[^>]*></script>", head)]

page = "\n".join([title, *keep, body.strip(), *scripts]) + "\n"
(dist / "artifact.html").write_text(page)
print(page[:600])
