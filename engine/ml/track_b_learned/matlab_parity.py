"""
Python and MATLAB Numerical Parity Validation for Track B Learned Predictor.
Verifies that exported ONNX model matches PyTorch outputs with absolute error < 1e-4.
Generates parity vectors for MATLAB Deep Learning Toolbox validation.
"""

import os
import json
import numpy as np
import torch
from typing import Dict, Any, Tuple
from .model import TrajectoryGRUEncoderDecoder


def generate_test_inputs(batch_size: int = 16, seed: int = 1000):
    """Generates synthetic deterministic test inputs across classes."""
    rng = np.random.RandomState(seed)

    # 1. History (B, 10, 5)
    hist = np.zeros((batch_size, 10, 5), dtype=np.float32)
    for b in range(batch_size):
        v = rng.uniform(2.0, 8.0)
        yaw = rng.uniform(-0.5, 0.5)
        for t in range(10):
            hist[b, t, 0] = (t - 9) * 0.2 * v * np.cos(yaw)
            hist[b, t, 1] = (t - 9) * 0.2 * v * np.sin(yaw)
            hist[b, t, 2] = v * np.cos(yaw)
            hist[b, t, 3] = v * np.sin(yaw)
            hist[b, t, 4] = yaw

    # 2. Class one-hot (B, 6)
    cls_onehot = np.zeros((batch_size, 6), dtype=np.float32)
    for b in range(batch_size):
        c_idx = b % 6
        cls_onehot[b, c_idx] = 1.0

    # 3. Nearby agents (B, 4, 4)
    nearby = rng.uniform(-10.0, 10.0, size=(batch_size, 4, 4)).astype(np.float32)

    # 4. Corridor bounds (B, 2)
    bounds = np.tile([3.8, -3.8], (batch_size, 1)).astype(np.float32)

    return hist, cls_onehot, nearby, bounds


def run_parity_check(
    onnx_path: str = "engine/ml/models/learned_predictor.onnx",
    checkpoint_path: str = "engine/ml/models/best_learned_predictor.pt",
    vectors_json_path: str = "engine/ml/models/matlab_parity_vectors.json",
    tolerance: float = 1e-4,
) -> Dict[str, Any]:
    """
    Compares PyTorch outputs against ONNX model outputs and exports parity vectors.
    """
    # 1. Load PyTorch model
    model = TrajectoryGRUEncoderDecoder()
    if os.path.exists(checkpoint_path):
        ckpt = torch.load(checkpoint_path, map_location="cpu")
        state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
        model.load_state_dict(state_dict)
    model.eval()

    hist_np, cls_np, near_np, bnd_np = generate_test_inputs(batch_size=16)

    # 2. PyTorch inference
    with torch.no_grad():
        t_hist = torch.from_numpy(hist_np)
        t_cls = torch.from_numpy(cls_np)
        t_near = torch.from_numpy(near_np)
        t_bnd = torch.from_numpy(bnd_np)
        py_fut, py_w, py_cov = model(t_hist, t_cls, t_near, t_bnd)

    py_fut_np = py_fut.numpy()
    py_w_np = py_w.numpy()
    py_cov_np = py_cov.numpy()

    # 3. ONNX inference
    max_err_futures = 0.0
    max_err_weights = 0.0
    max_err_cov = 0.0
    onnx_available = False

    try:
        import onnxruntime as ort
        session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        inputs = {
            "history": hist_np,
            "class_onehot": cls_np,
            "nearby_agents": near_np,
            "corridor_bounds": bnd_np,
        }
        onnx_outputs = session.run(["futures", "weights", "cov_params"], inputs)
        ox_fut, ox_w, ox_cov = onnx_outputs[0], onnx_outputs[1], onnx_outputs[2]

        max_err_futures = float(np.max(np.abs(py_fut_np - ox_fut)))
        max_err_weights = float(np.max(np.abs(py_w_np - ox_w)))
        max_err_cov = float(np.max(np.abs(py_cov_np - ox_cov)))
        onnx_available = True
    except Exception as e:
        print(f"Warning: onnxruntime execution exception: {e}")

    parity_passed = bool(
        onnx_available
        and max_err_futures < tolerance
        and max_err_weights < tolerance
        and max_err_cov < tolerance
    )

    # 4. Export parity vectors for MATLAB
    os.makedirs(os.path.dirname(vectors_json_path), exist_ok=True)
    parity_data = {
        "metadata": {
            "description": "ADAPTIVE-PATH Track B PyTorch/ONNX MATLAB Parity Reference Vectors",
            "tolerance": tolerance,
            "num_samples": 4,
            "parity_passed": parity_passed,
        },
        "inputs": {
            "history": hist_np[:4].tolist(),
            "class_onehot": cls_np[:4].tolist(),
            "nearby_agents": near_np[:4].tolist(),
            "corridor_bounds": bnd_np[:4].tolist(),
        },
        "reference_outputs": {
            "futures": py_fut_np[:4].tolist(),
            "weights": py_w_np[:4].tolist(),
            "cov_params": py_cov_np[:4].tolist(),
        },
        "errors": {
            "max_err_futures": max_err_futures,
            "max_err_weights": max_err_weights,
            "max_err_cov": max_err_cov,
        },
    }

    with open(vectors_json_path, "w", encoding="utf-8") as f:
        json.dump(parity_data, f, indent=2)

    return {
        "onnx_available": onnx_available,
        "parity_passed": parity_passed,
        "max_err_futures": max_err_futures,
        "max_err_weights": max_err_weights,
        "max_err_cov": max_err_cov,
        "tolerance": tolerance,
        "vectors_json_path": vectors_json_path,
    }


if __name__ == "__main__":
    res = run_parity_check()
    print("=== Track B ONNX Parity Results ===")
    print(f"ONNX Available: {res['onnx_available']}")
    print(f"Parity Passed: {res['parity_passed']}")
    print(f"Max error futures: {res['max_err_futures']:.2e}")
    print(f"Max error weights: {res['max_err_weights']:.2e}")
    print(f"Max error covariance: {res['max_err_cov']:.2e}")

