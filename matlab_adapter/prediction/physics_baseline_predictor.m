% MATLAB Native Implementation of Track A: Physics Baseline Predictor
% Generates K=6 multi-modal trajectories with process noise covariance for 6 agent classes.

function [modes, weights, covariances] = physics_baseline_predictor(history_xyv, class_name, dt, H)
    if nargin < 3, dt = 0.2; end
    if nargin < 4, H = 15; end
    if nargin < 2 || isempty(class_name), class_name = 'auto_rickshaw'; end

    % History: [N x 5] where columns are [x, y, vx, vy, yaw]
    if size(history_xyv, 1) < 2
        error('History must contain at least 2 steps');
    end

    x0 = history_xyv(end, 1);
    y0 = history_xyv(end, 2);
    dx = x0 - history_xyv(end-1, 1);
    dy = y0 - history_xyv(end-1, 2);
    v0 = hypot(dx, dy) / dt;
    yaw0 = atan2(dy, dx);

    % Define intent modes
    intents = {'continue', 'stop', 'cross_left', 'cross_right', 'swerve_left', 'swerve_right'};
    K = length(intents);

    % Class priors for weights
    switch lower(class_name)
        case 'cattle'
            weights = [0.25; 0.35; 0.15; 0.15; 0.05; 0.05];
        case 'pedestrian'
            weights = [0.20; 0.25; 0.25; 0.25; 0.025; 0.025];
        case 'two_wheeler'
            weights = [0.40; 0.10; 0.10; 0.10; 0.15; 0.15];
        case 'auto_rickshaw'
            weights = [0.45; 0.20; 0.10; 0.10; 0.075; 0.075];
        case 'truck'
            weights = [0.70; 0.15; 0.05; 0.05; 0.025; 0.025];
        otherwise
            weights = [0.50; 0.20; 0.10; 0.10; 0.05; 0.05];
    end
    weights = weights / sum(weights);

    modes = zeros(K, H, 2);
    covariances = zeros(K, H, 2, 2);

    for k = 1:K
        xk = x0;
        yk = y0;
        vk = v0;
        yawk = yaw0;
        intent = intents{k};

        switch intent
            case 'continue'
                ak = 0.0; yrk = 0.0;
            case 'stop'
                ak = -max(1.5, vk / (H * dt * 0.6)); yrk = 0.0;
            case 'cross_left'
                ak = -0.2; yrk = 0.25;
            case 'cross_right'
                ak = -0.2; yrk = -0.25;
            case 'swerve_left'
                ak = 0.0; yrk = 0.45;
            case 'swerve_right'
                ak = 0.0; yrk = -0.45;
        end

        cov_k = diag([0.04, 0.04]);
        for t = 1:H
            vk = max(0.0, vk + ak * dt);
            yawk = yawk + yrk * dt;
            xk = xk + vk * cos(yawk) * dt;
            yk = yk + vk * sin(yawk) * dt;

            modes(k, t, 1) = xk;
            modes(k, t, 2) = yk;

            % Process noise expansion
            var_grow = 0.05 * (1 + 0.3 * t * dt);
            cov_k = cov_k + diag([var_grow, var_grow]) * dt;
            covariances(k, t, :, :) = cov_k;
        end
    end
end
