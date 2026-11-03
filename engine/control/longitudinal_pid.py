"""
Longitudinal PID Controller with Feedforward, Anti-Windup Clamping, and Comfort Jerk Limiting.
"""

from typing import Optional


class LongitudinalPIDController:
    """
    Longitudinal Velocity & Acceleration Controller:
    - Proportional + Integral + Derivative error feedback
    - Anti-windup integrator clamping
    - Hard acceleration limits [-6.0, +2.5] m/s^2
    - Maximum jerk limits for passenger comfort
    """

    def __init__(
        self,
        kp: float = 1.10,
        ki: float = 0.15,
        kd: float = 0.08,
        max_accel_m_s2: float = 2.50,
        max_decel_m_s2: float = -6.00,
        max_jerk_m_s3: float = 8.00,
        integrator_min: float = -2.50,
        integrator_max: float = 2.00,
    ):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.max_accel = max_accel_m_s2
        self.max_decel = max_decel_m_s2
        self.max_jerk = max_jerk_m_s3
        self.integrator_min = integrator_min
        self.integrator_max = integrator_max

        self.integral_error: float = 0.0
        self.prev_error: float = 0.0
        self.prev_accel: float = 0.0

    def reset(self):
        self.integral_error = 0.0
        self.prev_error = 0.0
        self.prev_accel = 0.0

    def compute_acceleration(
        self,
        current_v: float,
        target_v: float,
        feedforward_accel: float = 0.0,
        dt: float = 0.1,
    ) -> float:
        """Computes rate-limited command acceleration in m/s^2."""
        error = target_v - current_v

        # Integral accumulation with anti-windup clamping
        self.integral_error += error * dt
        self.integral_error = max(
            self.integrator_min, min(self.integrator_max, self.integral_error)
        )

        # Derivative error
        derivative_error = (error - self.prev_error) / max(1e-4, dt)
        self.prev_error = error

        # Raw PID command
        raw_cmd = (
            feedforward_accel
            + self.kp * error
            + self.ki * self.integral_error
            + self.kd * derivative_error
        )

        # Saturation clamping
        accel_clamped = max(self.max_decel, min(self.max_accel, raw_cmd))

        # Jerk rate limiting (comfort jerk for normal drive; emergency deceleration allows rapid response)
        max_d_acc = self.max_jerk * dt
        max_d_dec = 30.0 * dt if accel_clamped < -2.0 else max_d_acc
        accel_rate_limited = max(
            self.prev_accel - max_d_dec, min(self.prev_accel + max_d_acc, accel_clamped)
        )

        self.prev_accel = accel_rate_limited
        return accel_rate_limited
