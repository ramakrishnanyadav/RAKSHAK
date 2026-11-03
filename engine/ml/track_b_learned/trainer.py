"""
Track B Training Pipeline with Deterministic Seeds, Early Stopping, and Checkpointing.
"""

import os
import random
import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from typing import Dict, Any, List, Tuple, Optional
from ..data.generator import generate_benchmark_dataset, TrajectorySequence
from .model import TrajectoryGRUEncoderDecoder
from .loss import MultiModalWTALoss


def set_seed(seed: int = 1000) -> None:
    """Sets deterministic seeds across Python, NumPy, and PyTorch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def sequences_to_tensors(
    sequences: List[TrajectorySequence],
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Converts list of TrajectorySequence objects into model-ready PyTorch tensors.
    """
    N = len(sequences)
    histories = np.zeros((N, 10, 5), dtype=np.float32)
    class_onehots = np.zeros((N, 6), dtype=np.float32)
    nearby_agents = np.zeros((N, 4, 4), dtype=np.float32)
    corridors = np.zeros((N, 2), dtype=np.float32)
    futures = np.zeros((N, 15, 2), dtype=np.float32)

    for i, seq in enumerate(sequences):
        # History
        h = np.array(seq.history_xyv, dtype=np.float32)
        if len(h) == 10:
            histories[i] = h

        # Class one-hot
        c_idx = max(0, min(5, seq.class_id))
        class_onehots[i, c_idx] = 1.0

        # Nearby agents: synthetic contextual neighbors (e.g. adjacent traffic)
        # Offset slightly by class for context variation
        rng_local = np.random.RandomState(i)
        nearby_agents[i, 0] = [rng_local.uniform(5.0, 15.0), rng_local.uniform(-2.0, 2.0), rng_local.uniform(-1.0, 1.0), 0.0]
        nearby_agents[i, 1] = [rng_local.uniform(-15.0, -5.0), rng_local.uniform(-2.0, 2.0), rng_local.uniform(-1.0, 1.0), 0.0]

        # Corridor boundaries
        b = seq.corridor_bounds or [3.8, -3.8]
        corridors[i] = [b[0], b[1]]

        # Future targets
        f = np.array(seq.future_xy, dtype=np.float32)
        if len(f) == 15:
            futures[i] = f

    return (
        torch.from_numpy(histories),
        torch.from_numpy(class_onehots),
        torch.from_numpy(nearby_agents),
        torch.from_numpy(corridors),
        torch.from_numpy(futures),
    )


class TrackBTrainer:
    """
    Manages deterministic training of the GRU trajectory predictor.
    """

    def __init__(
        self,
        output_dir: str = "engine/ml/models",
        batch_size: int = 64,
        lr: float = 1e-3,
        max_epochs: int = 25,
        patience: int = 5,
        seed: int = 1000,
    ):
        self.output_dir = output_dir
        self.batch_size = batch_size
        self.lr = lr
        self.max_epochs = max_epochs
        self.patience = patience
        self.seed = seed
        os.makedirs(self.output_dir, exist_ok=True)

    def train(self) -> Dict[str, Any]:
        """
        Executes end-to-end training and returns training history.
        """
        set_seed(self.seed)

        # 1. Load Data
        train_seqs = generate_benchmark_dataset(split="train")
        val_seqs = generate_benchmark_dataset(split="val")

        t_hist, t_cls, t_near, t_corr, t_fut = sequences_to_tensors(train_seqs)
        v_hist, v_cls, v_near, v_corr, v_fut = sequences_to_tensors(val_seqs)

        train_ds = TensorDataset(t_hist, t_cls, t_near, t_corr, t_fut)
        val_ds = TensorDataset(v_hist, v_cls, v_near, v_corr, v_fut)

        train_loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=self.batch_size, shuffle=False)

        # 2. Build Model & Loss
        model = TrajectoryGRUEncoderDecoder()
        criterion = MultiModalWTALoss(lambda_reg=1.0, lambda_nll=0.15, lambda_cls=0.5)
        optimizer = optim.Adam(model.parameters(), lr=self.lr, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=2)

        best_val_loss = float("inf")
        best_epoch = 0
        patience_counter = 0
        history_records = []

        checkpoint_path = os.path.join(self.output_dir, "best_learned_predictor.pt")

        for epoch in range(1, self.max_epochs + 1):
            model.train()
            train_loss_acc = 0.0
            num_batches = 0

            for b_hist, b_cls, b_near, b_corr, b_fut in train_loader:
                optimizer.zero_grad()
                pred_fut, pred_w, pred_cov = model(b_hist, b_cls, b_near, b_corr)
                loss, _ = criterion(pred_fut, pred_w, pred_cov, b_fut)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()

                train_loss_acc += loss.item()
                num_batches += 1

            train_epoch_loss = train_loss_acc / max(1, num_batches)

            # Validation Loop
            model.eval()
            val_loss_acc = 0.0
            val_reg_acc = 0.0
            val_batches = 0
            with torch.no_grad():
                for b_hist, b_cls, b_near, b_corr, b_fut in val_loader:
                    pred_fut, pred_w, pred_cov = model(b_hist, b_cls, b_near, b_corr)
                    loss, metrics = criterion(pred_fut, pred_w, pred_cov, b_fut)
                    val_loss_acc += loss.item()
                    val_reg_acc += metrics["loss_reg"]
                    val_batches += 1

            val_epoch_loss = val_loss_acc / max(1, val_batches)
            val_reg_loss = val_reg_acc / max(1, val_batches)
            scheduler.step(val_epoch_loss)

            history_records.append({
                "epoch": epoch,
                "train_loss": round(train_epoch_loss, 4),
                "val_loss": round(val_epoch_loss, 4),
                "val_reg_loss": round(val_reg_loss, 4),
            })

            # Early Stopping Check
            if val_epoch_loss < best_val_loss:
                best_val_loss = val_epoch_loss
                best_epoch = epoch
                patience_counter = 0
                torch.save(
                    {
                        "epoch": epoch,
                        "model_state_dict": model.state_dict(),
                        "val_loss": best_val_loss,
                        "seed": self.seed,
                    },
                    checkpoint_path,
                )
            else:
                patience_counter += 1
                if patience_counter >= self.patience:
                    break

        return {
            "best_epoch": best_epoch,
            "best_val_loss": round(best_val_loss, 4),
            "checkpoint_path": checkpoint_path,
            "history": history_records,
        }
