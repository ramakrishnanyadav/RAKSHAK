"""
Track B Learned Trajectory Predictor.
PyTorch GRU-based encoder-decoder for multi-agent trajectory forecasting on unstructured roads.
Outputs K=6 modes with mixture weights and per-step 2D Gaussian covariances.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Dict, Any


class TrajectoryGRUEncoderDecoder(nn.Module):
    """
    Lightweight GRU Encoder-Decoder trajectory predictor.
    Designed for high inference speed (<20 ms for 60 agents) and MATLAB ONNX compatibility.
    """

    def __init__(
        self,
        hist_len: int = 10,
        fut_len: int = 15,
        num_classes: int = 6,
        num_modes: int = 6,
        hist_dim: int = 5,
        nearby_dim: int = 16, # 4 nearby agents * 4 dims
        hidden_dim: int = 64,
    ):
        super().__init__()
        self.hist_len = hist_len
        self.fut_len = fut_len
        self.num_classes = num_classes
        self.num_modes = num_modes
        self.hidden_dim = hidden_dim

        # Class embedding layer
        self.class_emb = nn.Linear(num_classes, 16)

        # Agent history encoder
        # Input: state (5) + class_emb (16) = 21
        self.agent_gru = nn.GRU(
            input_size=hist_dim + 16,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.1,
        )

        # Context encoders
        self.nearby_encoder = nn.Sequential(
            nn.Linear(nearby_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 32),
            nn.ReLU(),
        )

        self.boundary_encoder = nn.Sequential(
            nn.Linear(2, 16),
            nn.ReLU(),
            nn.Linear(16, 16),
            nn.ReLU(),
        )

        # Combined latent dimension: hidden_dim (64) + 32 + 16 = 112
        latent_dim = hidden_dim + 32 + 16

        # Mode mixture weights head
        self.weight_head = nn.Sequential(
            nn.Linear(latent_dim, 48),
            nn.ReLU(),
            nn.Linear(48, num_modes),
        )

        # Trajectory & covariance generator head
        # For each mode k in 1..K and each time step t in 1..H:
        # Predicts [dx, dy, log_sig_x, log_sig_y, rho_raw] (5 parameters per step)
        self.trajectory_head = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
            nn.Linear(128, num_modes * fut_len * 5),
        )

    def forward(
        self,
        history: torch.Tensor,         # (B, 10, 5)
        class_onehot: torch.Tensor,    # (B, 6)
        nearby_agents: torch.Tensor,   # (B, 4, 4)
        corridor_bounds: torch.Tensor, # (B, 2)
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass.
        Returns:
            futures: (B, K, H, 2) predicted [x, y] coordinates
            weights: (B, K) mixture probabilities summing to 1
            cov_params: (B, K, H, 3) [sigma_x, sigma_y, rho] per step
        """
        B = history.size(0)

        # Encode class
        c_emb = F.relu(self.class_emb(class_onehot)) # (B, 16)
        c_emb_expanded = c_emb.unsqueeze(1).repeat(1, self.hist_len, 1) # (B, 10, 16)

        # Concatenate history and class
        gru_input = torch.cat([history, c_emb_expanded], dim=-1) # (B, 10, 21)

        # Encode history
        _, h_last = self.agent_gru(gru_input)
        h_agent = h_last[-1] # (B, 64)

        # Encode context
        nearby_flat = nearby_agents.reshape(B, -1) # (B, 16)
        h_near = self.nearby_encoder(nearby_flat)  # (B, 32)
        h_env = self.boundary_encoder(corridor_bounds) # (B, 16)

        # Fused context
        latent = torch.cat([h_agent, h_near, h_env], dim=-1) # (B, 112)

        # Mixture weights
        logits = self.weight_head(latent) # (B, 6)
        weights = F.softmax(logits, dim=-1) # (B, 6)

        # Futures and uncertainties
        raw_out = self.trajectory_head(latent) # (B, K * H * 5)
        raw_out = raw_out.view(B, self.num_modes, self.fut_len, 5)

        # Coordinates: accumulate deltas from t=0 origin (last observed position history[:, -1, :2])
        dxy = raw_out[..., 0:2] # (B, K, H, 2)
        origin_xy = history[:, -1:, :2].unsqueeze(1) # (B, 1, 1, 2)
        futures = origin_xy + torch.cumsum(dxy, dim=2) # (B, K, H, 2)

        # Covariance parameters: [sigma_x, sigma_y, rho]
        # Standard deviation > 0, bounded correlation in (-1, 1)
        sigma_x = F.softplus(raw_out[..., 2]) + 0.05
        sigma_y = F.softplus(raw_out[..., 3]) + 0.05
        rho = 0.95 * torch.tanh(raw_out[..., 4])
        cov_params = torch.stack([sigma_x, sigma_y, rho], dim=-1) # (B, K, H, 3)

        return futures, weights, cov_params
