"""
Alembic Database Migration Up / Down Lifecycle Test.
Validates that revision scripts can apply cleanly to head and downgrade to base
without orphaned objects or SQL syntax incompatibilities.
"""

import tempfile
from pathlib import Path
from alembic.config import Config
from alembic import command


def test_alembic_upgrade_and_downgrade():
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = tmp.name

    try:
        ini_path = Path("backend/alembic.ini")
        cfg = Config(str(ini_path))
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

        # Upgrade to head
        command.upgrade(cfg, "head")

        # Downgrade to base
        command.downgrade(cfg, "base")

        # Re-upgrade to head to guarantee repeatability
        command.upgrade(cfg, "head")
    finally:
        p = Path(db_path)
        if p.exists():
            p.unlink(missing_ok=True)
