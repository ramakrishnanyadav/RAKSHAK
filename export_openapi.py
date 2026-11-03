"""
Export OpenAPI 3.1.0 schema specification from FastAPI app to JSON and YAML.
"""

import json
from pathlib import Path
from backend.app.main import app

out_dir = Path("schemas")
out_dir.mkdir(parents=True, exist_ok=True)

openapi_data = app.openapi()

# Export JSON
json_path = out_dir / "openapi.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(openapi_data, f, indent=2)

print(f"Exported OpenAPI JSON to {json_path}")

# Export YAML (try yaml if pyyaml installed, or formatted dump)
try:
    import yaml
    yaml_path = out_dir / "openapi.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(openapi_data, f, sort_keys=False)
    print(f"Exported OpenAPI YAML to {yaml_path}")
except ImportError:
    print("pyyaml not installed; JSON export succeeded.")
