classdef pure_pursuit_pid < handle
    % PURE_PURSUIT_PID Pure Pursuit Steering + Longitudinal PID for MATLAB/Simulink
    % Implements identical controller geometry to Python pure_pursuit and longitudinal_pid.
    %
    % Smart India Hackathon 2026 - Problem SIH26037 (MathWorks)

    properties
        wheelbase_m (1,1) double = 2.7
        k_look (1,1) double = 0.55
        min_lookahead_m (1,1) double = 3.5
        max_lookahead_m (1,1) double = 25.0
        max_steer_rad (1,1) double = 0.61
        max_steer_rate_rad_s (1,1) double = 0.65

        kp (1,1) double = 1.10
        ki (1,1) double = 0.15
        kd (1,1) double = 0.08
        max_accel (1,1) double = 2.50
        max_decel (1,1) double = -6.00
        max_jerk (1,1) double = 8.00

        prev_steer (1,1) double = 0.0
        integral_error (1,1) double = 0.0
        prev_error (1,1) double = 0.0
        prev_accel (1,1) double = 0.0
    end

    methods
        function obj = pure_pursuit_pid(L, k_look, kp, ki, kd)
            if nargin >= 1, obj.wheelbase_m = L; end
            if nargin >= 2, obj.k_look = k_look; end
            if nargin >= 3, obj.kp = kp; end
            if nargin >= 4, obj.ki = ki; end
            if nargin >= 5, obj.kd = kd; end
        end

        function reset(obj)
            obj.prev_steer = 0.0;
            obj.integral_error = 0.0;
            obj.prev_error = 0.0;
            obj.prev_accel = 0.0;
        end

        function [steer_cmd, accel_cmd] = step(obj, ego_x, ego_y, ego_yaw, ego_v, trajectory, target_v, dt)
            % 1. Steering via Pure Pursuit
            lookahead = max(obj.min_lookahead_m, min(obj.max_lookahead_m, obj.k_look * max(0.5, ego_v)));

            target_pt = trajectory(end, :);
            for i = 1:size(trajectory, 1)
                d = hypot(trajectory(i, 1) - ego_x, trajectory(i, 2) - ego_y);
                if d >= lookahead
                    target_pt = trajectory(i, :);
                    break;
                end
            end

            dx = target_pt(1) - ego_x;
            dy = target_pt(2) - ego_y;
            dist = hypot(dx, dy);

            if dist < 0.1
                steer_cmd = obj.prev_steer;
            else
                target_angle = atan2(dy, dx);
                alpha = mod(target_angle - ego_yaw + pi, 2*pi) - pi;
                curvature = 2.0 * sin(alpha) / dist;
                steer_target = atan(obj.wheelbase_m * curvature);
                steer_clamped = max(-obj.max_steer_rad, min(obj.max_steer_rad, steer_target));

                max_d_steer = obj.max_steer_rate_rad_s * dt;
                steer_cmd = max(obj.prev_steer - max_d_steer, min(obj.prev_steer + max_d_steer, steer_clamped));
                obj.prev_steer = steer_cmd;
            end

            % 2. Longitudinal PID
            error = target_v - ego_v;
            obj.integral_error = obj.integral_error + error * dt;
            obj.integral_error = max(-2.5, min(2.0, obj.integral_error));

            d_error = (error - obj.prev_error) / max(1e-4, dt);
            obj.prev_error = error;

            raw_accel = obj.kp * error + obj.ki * obj.integral_error + obj.kd * d_error;
            accel_clamped = max(obj.max_decel, min(obj.max_accel, raw_accel));

            max_d_accel = obj.max_jerk * dt;
            accel_cmd = max(obj.prev_accel - max_d_accel, min(obj.prev_accel + max_d_accel, accel_clamped));
            obj.prev_accel = accel_cmd;
        end
    end
end
