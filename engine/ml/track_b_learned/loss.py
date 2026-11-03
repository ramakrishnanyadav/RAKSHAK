"""
Winner-Takes-All (WTA) Multi-Modal Trajectory Loss.
Combines:
1. WTA L2/Smooth-L1 regression on the best-matching mode
2. Bivariate Gaussian Negative Log-Likelihood (NLL) on the winning mode
3. Cross-entropy classification on mode selection weights
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple


class MultiModalWTALoss(nn.Module):
    """
    Computes Winner-Takes-All multi-modal trajectory loss with 2D Gaussian NLL.
    """

    def __init__(
        self,
        lambda_reg: float = 1.0,
        lambda_nll: float = 0.2,
        lambda_cls: float = 0.5,
    ):
        super().__init__()
        self.lambda_reg = lambda_reg
        self.lambda_nll = lambda_nll
        self.lambda_cls = lambda_cls

    def forward(
        self,
        pred_futures: torch.Tensor,   # (B, K, H, 2)
        pred_weights: torch.Tensor,   # (B, K)
        pred_cov_params: torch.Tensor,# (B, K, H, 3) [sigma_x, sigma_y, rho]
        target_futures: torch.Tensor, # (B, H, 2)
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """
        Calculates combined loss.
        """
        B, K, H, _ = pred_futures.shape

        # Step 1: Winner-Takes-All Mode Selection
        # Compute L2 distance for each mode: (B, K, H) -> (B, K)
        targets_exp = target_futures.unsqueeze(1).repeat(1, K, 1, 1) # (B, K, H, 2)
        dist_per_mode = torch.norm(pred_futures - targets_exp, dim=-1).mean(dim=-1) # (B, K)
        best_mode_idx = torch.argmin(dist_per_mode, dim=-1) # (B,)

        # Gather winner predictions
        batch_idx = torch.arange(B, device=pred_futures.device)
        winner_futures = pred_futures[batch_idx, best_mode_idx] # (B, H, 2)
        winner_cov = pred_cov_params[batch_idx, best_mode_idx]  # (B, H, 3)

        # Step 2: WTA Regression Loss
        loss_reg = F.smooth_l1_loss(winner_futures, target_futures, reduction="mean")

        # Step 3: Bivariate Gaussian NLL Loss on Winning Mode
        dx = target_futures[..., 0] - winner_futures[..., 0]
        dy = target_futures[..., 1] - winner_futures[..., 1]
        sig_x = winner_cov[..., 0]
        sig_y = winner_cov[..., 1]
        rho = winner_cov[..., 2]

        one_minus_rho2 = torch.clamp(1.0 - rho ** 2, min=1e-4)
        z = (dx ** 2) / (sig_x ** 2) + (dy ** 2) / (sig_y ** 2) - (2.0 * rho * dx * dy) / (sig_x * sig_y)
        nll = torch.log(sig_x) + torch.log(sig_y) + 0.5 * torch.log(one_minus_rho2) + (z / (2.0 * one_minus_rho2))
        loss_nll = torch.clamp(nll, min=-5.0, max=25.0).mean()

        # Step 4: Weight Classification Loss (Cross Entropy pulling toward winner)
        eps = 1e-7
        winner_prob = pred_weights[batch_idx, best_mode_idx]
        loss_cls = -torch.log(winner_prob + eps).mean()

        # Combined Total Loss
        total_loss = (
            self.lambda_reg * loss_reg
            + self.lambda_nll * loss_nll
            + self.lambda_cls * loss_cls
        )

        metrics = {
            "loss_total": float(total_loss.item()),
            "loss_reg": float(loss_reg.item()),
            "loss_nll": float(loss_nll.item()),
            "loss_cls": float(loss_cls.item()),
        }

        return total_loss, metrics
