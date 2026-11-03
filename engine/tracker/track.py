"""
Individual Object Track Representation with Extended Kalman Filter (EKF),
confidence scoring, and historical trajectory.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from engine.sensors.base import RawDetection


class ObjectTrack:
    """
    State vector: [x, y, yaw, vx, vy]
    Maintains 5x5 error covariance, confidence score, and history buffer.
    """

    def __init__(self, detection: RawDetection, track_id: Optional[str] = None):
        self.track_id = track_id or detection.agent_id
        self.class_name = detection.class_name
        self.length = detection.length
        self.width = detection.width

        # State [x, y, yaw, vx, vy]
        self.x = detection.x
        self.y = detection.y
        self.yaw = detection.yaw
        self.vx = detection.vx
        self.vy = detection.vy

        # 5x5 Covariance Matrix P
        self.P = [
            [0.10, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.10, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.05, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.20, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.20],
        ]

        self.confidence = detection.confidence
        self.history: List[Tuple[float, float, float]] = [(self.x, self.y, self.yaw)]
        self.age = 1
        self.hits = 1
        self.time_since_update = 0
        self.is_confirmed = False

    def predict(self, dt: float):
        """Constant Velocity Motion Model Prediction with Process Noise Q."""
        self.x += self.vx * dt
        self.y += self.vy * dt
        # Heading gently tracks velocity vector if speed is significant
        speed = math.hypot(self.vx, self.vy)
        if speed > 0.5:
            vel_yaw = math.atan2(self.vy, self.vx)
            diff = (vel_yaw - self.yaw + math.pi) % (2 * math.pi) - math.pi
            self.yaw += 0.2 * diff

        # Process noise variance Q
        q_pos = 0.05 * dt
        q_yaw = 0.02 * dt
        q_vel = 0.25 * dt

        self.P[0][0] += q_pos
        self.P[1][1] += q_pos
        self.P[2][2] += q_yaw
        self.P[3][3] += q_vel
        self.P[4][4] += q_vel

        self.age += 1
        self.time_since_update += 1

    def update(self, detection: RawDetection):
        """Kalman Measurement Update."""
        z = [detection.x, detection.y, detection.yaw, detection.vx, detection.vy]
        x_pred = [self.x, self.y, self.yaw, self.vx, self.vy]

        # Measurement residual y = z - Hx (H is identity 5x5)
        residual = [z[i] - x_pred[i] for i in range(5)]
        # Normalize angle residual
        residual[2] = (residual[2] + math.pi) % (2 * math.pi) - math.pi

        # Measurement noise R from detection covariance
        R = detection.covariance if detection.covariance else [
            [0.05, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.05, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.02, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.10, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.10],
        ]

        # Kalman Gain K = P / (P + R)
        for i in range(5):
            var_p = self.P[i][i]
            var_r = R[i][i] if i < len(R) and i < len(R[i]) else 0.1
            k_gain = var_p / (var_p + var_r + 1e-6)

            x_pred[i] += k_gain * residual[i]
            self.P[i][i] = (1.0 - k_gain) * var_p

        self.x, self.y, self.yaw, self.vx, self.vy = x_pred
        self.yaw = (self.yaw + math.pi) % (2 * math.pi) - math.pi

        # Confidence update: weighted running average
        self.confidence = min(0.99, max(0.1, 0.85 * self.confidence + 0.15 * detection.confidence))
        self.hits += 1
        self.time_since_update = 0
        if self.hits >= 2:
            self.is_confirmed = True

        # Append to historical trajectory (keep last 30 points)
        self.history.append((round(self.x, 3), round(self.y, 3), round(self.yaw, 3)))
        if len(self.history) > 30:
            self.history.pop(0)

    def to_agent_track_dict(self) -> Dict[str, Any]:
        return {
            "id": self.track_id,
            "class_name": self.class_name,
            "x": round(self.x, 3),
            "y": round(self.y, 3),
            "yaw": round(self.yaw, 3),
            "v_x": round(self.vx, 3),
            "v_y": round(self.vy, 3),
            "length": self.length,
            "width": self.width,
            "confidence": round(self.confidence, 3),
            "history_len": len(self.history),
            "covariance": [[round(val, 4) for val in row] for row in self.P],
        }
