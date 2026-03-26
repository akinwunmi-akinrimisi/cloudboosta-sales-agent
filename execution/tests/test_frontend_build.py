"""Frontend build verification tests for Sarah Dashboard."""

import os
import sys
import glob
import subprocess

# On Windows, npm is npm.cmd; on POSIX it is npm.
_NPM = "npm.cmd" if sys.platform == "win32" else "npm"

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "dashboard")
DIST_DIR = os.path.join(DASHBOARD_DIR, "dist")
ASSETS_DIR = os.path.join(DIST_DIR, "assets")


class TestBuild:
    def test_build_succeeds(self):
        result = subprocess.run(
            [_NPM, "run", "build"],
            cwd=DASHBOARD_DIR,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 0, f"Build failed:\n{result.stderr}"

    def test_dist_index_exists(self):
        assert os.path.isfile(os.path.join(DIST_DIR, "index.html"))


class TestIndexHtml:
    def _read_index(self):
        path = os.path.join(DIST_DIR, "index.html")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def test_dark_class(self):
        html = self._read_index()
        assert 'class="dark"' in html

    def test_title(self):
        html = self._read_index()
        assert "Sarah Dashboard" in html
        assert "Cloudboosta" in html

    def test_google_fonts_space_grotesk(self):
        html = self._read_index()
        assert "fonts.googleapis.com" in html
        assert "Space+Grotesk" in html

    def test_google_fonts_ibm_plex_mono(self):
        html = self._read_index()
        assert "IBM+Plex+Mono" in html


class TestAssets:
    def test_js_file_exists(self):
        js_files = glob.glob(os.path.join(ASSETS_DIR, "*.js"))
        assert len(js_files) >= 1, "No JS files in dist/assets/"

    def test_css_file_exists(self):
        css_files = glob.glob(os.path.join(ASSETS_DIR, "*.css"))
        assert len(css_files) >= 1, "No CSS files in dist/assets/"

    def test_css_contains_dark_glass_tokens(self):
        css_files = glob.glob(os.path.join(ASSETS_DIR, "*.css"))
        assert css_files, "No CSS files found"
        with open(css_files[0], "r", encoding="utf-8") as f:
            css = f.read()
        assert "backdrop-filter" in css, "CSS missing backdrop-filter (glass effect)"
