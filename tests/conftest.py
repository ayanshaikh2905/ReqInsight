import os
import tempfile

# Point the API at a throwaway database before any test imports the app, so test
# runs never touch (or depend on) the developer's real analysis history.
_TMP_DIR = tempfile.mkdtemp(prefix="reqinsight-tests-")
os.environ.setdefault("REQINSIGHT_DB_PATH", os.path.join(_TMP_DIR, "reqinsight-test.db"))
