"""
ONNX Model Exporter for Track B Learned Predictor.
Exports PyTorch weights to an ONNX graph compatible with MATLAB Deep Learning Toolbox.
"""

import os
import sys
import onnx
import torch
from typing import Dict, Any, Optional
from .model import TrajectoryGRUEncoderDecoder

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def export_to_onnx(
    checkpoint_path: Optional[str] = "engine/ml/models/best_learned_predictor.pt",
    onnx_output_path: str = "engine/ml/models/learned_predictor.onnx",
    opset_version: int = 17,
) -> str:
    """
    Loads PyTorch checkpoint and exports model graph to standard ONNX.
    """
    os.makedirs(os.path.dirname(onnx_output_path), exist_ok=True)

    model = TrajectoryGRUEncoderDecoder()
    if checkpoint_path and os.path.exists(checkpoint_path):
        ckpt = torch.load(checkpoint_path, map_location="cpu")
        if "model_state_dict" in ckpt:
            model.load_state_dict(ckpt["model_state_dict"])
        else:
            model.load_state_dict(ckpt)
    model.eval()

    # Dummy inputs for tracing
    dummy_history = torch.randn(1, 10, 5, dtype=torch.float32)
    dummy_class = torch.zeros(1, 6, dtype=torch.float32)
    dummy_class[0, 0] = 1.0
    dummy_nearby = torch.randn(1, 4, 4, dtype=torch.float32)
    dummy_bounds = torch.tensor([[3.8, -3.8]], dtype=torch.float32)

    try:
        torch.onnx.export(
            model,
            (dummy_history, dummy_class, dummy_nearby, dummy_bounds),
            onnx_output_path,
            export_params=True,
            opset_version=opset_version,
            do_constant_folding=True,
            input_names=["history", "class_onehot", "nearby_agents", "corridor_bounds"],
            output_names=["futures", "weights", "cov_params"],
            dynamic_axes={
                "history": {0: "batch_size"},
                "class_onehot": {0: "batch_size"},
                "nearby_agents": {0: "batch_size"},
                "corridor_bounds": {0: "batch_size"},
                "futures": {0: "batch_size"},
                "weights": {0: "batch_size"},
                "cov_params": {0: "batch_size"},
            },
            dynamo=False,
        )
    except TypeError:
        torch.onnx.export(
            model,
            (dummy_history, dummy_class, dummy_nearby, dummy_bounds),
            onnx_output_path,
            export_params=True,
            opset_version=opset_version,
            do_constant_folding=True,
            input_names=["history", "class_onehot", "nearby_agents", "corridor_bounds"],
            output_names=["futures", "weights", "cov_params"],
            dynamic_axes={
                "history": {0: "batch_size"},
                "class_onehot": {0: "batch_size"},
                "nearby_agents": {0: "batch_size"},
                "corridor_bounds": {0: "batch_size"},
                "futures": {0: "batch_size"},
                "weights": {0: "batch_size"},
                "cov_params": {0: "batch_size"},
            },
        )

    # Validate ONNX model integrity
    onnx_model = onnx.load(onnx_output_path)
    onnx.checker.check_model(onnx_model)

    return onnx_output_path


if __name__ == "__main__":
    path = export_to_onnx()
    print(f"Successfully exported ONNX model to {path}")
