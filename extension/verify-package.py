"""Verify exactly what goes into each extension store ZIP."""
import json
import sys
from pathlib import PurePosixPath
from zipfile import ZipFile

browser, filename = sys.argv[1:]
with ZipFile(filename) as archive:
    entries = archive.infolist()
    names = {entry.filename for entry in entries if not entry.is_dir()}
    assert len(names) == sum(not entry.is_dir() for entry in entries), "Duplicate archive paths"
    required = {"manifest.json", "background.js", "contentscript.js", "popup.js", "popup.html", "popup.css", "content.css", "icons/icon48.png"}
    assert required <= names, f"Missing: {sorted(required - names)}"
    for entry in entries:
        path = PurePosixPath(entry.filename)
        assert not path.is_absolute() and ".." not in path.parts and "\\" not in entry.filename
        if entry.is_dir():
            continue
        assert path.name not in {".env", ".npmrc", "id_rsa", "id_ed25519"} and not path.name.startswith(".env.") and path.suffix.lower() not in {".map", ".key", ".pem"}, f"Unexpected file: {entry.filename}"
    manifest = json.loads(archive.read("manifest.json"))
    package = json.loads(open("package.json", encoding="utf-8").read())
    assert manifest.get("manifest_version") == 3 and manifest.get("version") == package["version"]
    assert ("browser_specific_settings" in manifest) == (browser == "firefox")
    assert sum(entry.file_size for entry in entries) < 2 * 1024 * 1024, "Extension exceeds 2 MiB budget"
print(f"{browser} package verified: {len(names)} files")
