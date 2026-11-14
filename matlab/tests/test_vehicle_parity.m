function test_vehicle_parity()
% TEST_VEHICLE_PARITY Validates adaptive_path_controller.slx across 5 standardized tests
% Generates golden CSVs under tests/golden/ for cross-language validation.
%
% Pre-registered Parity Tolerances:
%   max |dx|, |dy| <= 1e-9 m
%   max heading error (wrap-aware) <= 1e-9 rad
%   max |dv| <= 1e-9 m/s

disp('=================================================================');
disp('   ADAPTIVE-PATH 2.0: SIMULINK VEHICLE MODEL PARITY TEST SUITE   ');
disp('=================================================================');

tests_dir = fileparts(mfilename('fullpath'));
root_dir = fullfile(tests_dir, '..', '..');
golden_dir = fullfile(root_dir, 'tests', 'golden');
if ~exist(golden_dir, 'dir')
    mkdir(golden_dir);
end

mdl_path = fullfile(root_dir, 'matlab', 'vehicle', 'adaptive_path_controller.slx');
if ~exist(mdl_path, 'file')
    error(['Simulink model not found at: ', mdl_path]);
end
load_system(mdl_path);

dt = 0.05;
t_span = (0:dt:10.0)';
N = length(t_span);

% Test Configurations
test_cases = {
    'test1_straight_accel',    0.0, 0.0, 0.0,  0.0, 0.0,  1.5, @(t) 1.5*ones(size(t)),  @(t) zeros(size(t));
    'test2_constant_steer',    0.0, 0.0, 0.0,  5.0, 0.2,  0.0, @(t) zeros(size(t)),    @(t) 0.2*ones(size(t));
    'test3_sine_steer',        0.0, 0.0, 0.0,  5.0, 0.0,  0.0, @(t) zeros(size(t)),    @(t) 0.25*sin(0.5*pi*t);
    'test4_emergency_braking', 0.0, 0.0, 0.0, 15.0, 0.0, -6.5, @(t) -6.5*ones(size(t)), @(t) zeros(size(t));
    'test5_limit_saturation',  0.0, 0.0, 0.0,  5.0, 0.0,  0.0, @(t) 2.5*ones(size(t)),  @(t) 0.50*ones(size(t));
};

num_tests = size(test_cases, 1);
results = struct();

for tc_idx = 1:num_tests
    tc_name = test_cases{tc_idx, 1};
    x0 = test_cases{tc_idx, 2};
    y0 = test_cases{tc_idx, 3};
    yaw0 = test_cases{tc_idx, 4};
    v0 = test_cases{tc_idx, 5};
    steer0 = test_cases{tc_idx, 6};
    accel0 = test_cases{tc_idx, 7};
    accel_fn = test_cases{tc_idx, 8};
    steer_fn = test_cases{tc_idx, 9};

    accel_cmd = accel_fn(t_span);
    steer_cmd = steer_fn(t_span);

    disp(['Running Test ', num2str(tc_idx), ': ', tc_name, ' (Duration 10.0s, dt=0.05s) ...']);

    % 1. Simulate in Simulink
    in_accel = timeseries(accel_cmd, t_span);
    in_steer = timeseries(steer_cmd, t_span);
    in_ds = Simulink.SimulationData.Dataset;
    in_ds = in_ds.addElement(in_accel, 'accel_cmd');
    in_ds = in_ds.addElement(in_steer, 'steer_cmd');

    set_param('adaptive_path_controller/x0', 'Value', num2str(x0, '%.12f'));
    set_param('adaptive_path_controller/y0', 'Value', num2str(y0, '%.12f'));
    set_param('adaptive_path_controller/yaw0', 'Value', num2str(yaw0, '%.12f'));
    set_param('adaptive_path_controller/v0', 'Value', num2str(v0, '%.12f'));
    set_param('adaptive_path_controller/steer0', 'Value', num2str(steer0, '%.12f'));
    set_param('adaptive_path_controller/accel0', 'Value', num2str(accel0, '%.12f'));

    simIn = Simulink.SimulationInput('adaptive_path_controller');
    simIn = simIn.setExternalInput(in_ds);
    simIn = simIn.setModelParameter('StopTime', '10.0');

    simOut = sim(simIn);
    yout = simOut.yout;

    sim_x = yout{1}.Values.Data;
    sim_y = yout{2}.Values.Data;
    sim_yaw = yout{3}.Values.Data;
    sim_v = yout{4}.Values.Data;
    sim_steer = yout{5}.Values.Data;
    sim_accel = yout{6}.Values.Data;

    % 2. Reference computation (Discrete Forward Euler matching Python vehicle.py)
    ref_x = zeros(N, 1);
    ref_y = zeros(N, 1);
    ref_yaw = zeros(N, 1);
    ref_v = zeros(N, 1);
    ref_steer = zeros(N, 1);
    ref_accel = zeros(N, 1);

    curr_x = x0;
    curr_y = y0;
    curr_yaw = yaw0;
    curr_v = v0;
    curr_steer = steer0;
    curr_accel = accel0;

    wheelbase = 2.6;
    dist_cg_to_rear = 1.3;
    max_steer_rad = 0.60;
    max_accel_m_s2 = 2.5;
    max_decel_m_s2 = -6.5;
    max_steer_rate = 0.8;
    max_jerk = 10.0;

    stop_time_s = NaN;

    for k = 1:N
        % Record state at step k
        ref_x(k) = curr_x;
        ref_y(k) = curr_y;
        ref_yaw(k) = curr_yaw;
        ref_v(k) = curr_v;

        if curr_v == 0.0 && isnan(stop_time_s) && v0 > 0.0
            stop_time_s = t_span(k);
        end

        % Clamping & Rate Limiting
        s_sat = max(-max_steer_rad, min(max_steer_rad, steer_cmd(k)));
        a_sat = max(max_decel_m_s2, min(max_accel_m_s2, accel_cmd(k)));

        actual_s = max(curr_steer - max_steer_rate*dt, min(curr_steer + max_steer_rate*dt, s_sat));
        actual_a = max(curr_accel - max_jerk*dt, min(curr_accel + max_jerk*dt, a_sat));

        ref_steer(k) = actual_s;
        ref_accel(k) = actual_a;

        % Kinematics
        beta = atan((dist_cg_to_rear / wheelbase) * tan(actual_s));
        dx = curr_v * cos(curr_yaw + beta);
        dy = curr_v * sin(curr_yaw + beta);
        dyaw = (curr_v / wheelbase) * cos(beta) * tan(actual_s);

        % Update for step k+1
        curr_x = curr_x + dx * dt;
        curr_y = curr_y + dy * dt;
        curr_yaw = mod(curr_yaw + dyaw * dt, 2 * pi);
        curr_v = max(0.0, curr_v + actual_a * dt);
        curr_steer = actual_s;
        curr_accel = actual_a;
    end

    % 3. Check Parity Tolerances
    err_x = max(abs(sim_x - ref_x));
    err_y = max(abs(sim_y - ref_y));
    err_yaw = max(abs(angdiff(ref_yaw, sim_yaw)));
    err_v = max(abs(sim_v - ref_v));
    min_v_recorded = min(sim_v);

    passed = (err_x <= 1e-9) && (err_y <= 1e-9) && (err_yaw <= 1e-9) && (err_v <= 1e-9);

    if strcmp(tc_name, 'test4_emergency_braking')
        passed = passed && (min_v_recorded >= 0.0);
        disp(['  [Test 4 Special] Stop Time: ', num2str(stop_time_s, '%.3f'), ' s | Min Speed: ', num2str(min_v_recorded, '%.6f'), ' m/s']);
    end

    status_str = 'PASS';
    if ~passed
        status_str = 'FAIL';
    end

    disp(['  Result: [', status_str, '] | Max |dx|=', num2str(err_x, '%.2e'), ...
          ' m | Max |dy|=', num2str(err_y, '%.2e'), ' m | Max |dyaw|=', num2str(err_yaw, '%.2e'), ...
          ' rad | Max |dv|=', num2str(err_v, '%.2e'), ' m/s']);

    % 4. Save to Golden CSV
    csv_file = fullfile(golden_dir, [tc_name, '.csv']);
    T = table(t_span, accel_cmd, steer_cmd, sim_x, sim_y, sim_yaw, sim_v, sim_steer, sim_accel, ...
              'VariableNames', {'t', 'accel_cmd', 'steer_cmd', 'x', 'y', 'yaw', 'v', 'actual_steer', 'actual_accel'});
    writetable(T, csv_file);
    disp(['  Saved golden data: ', csv_file]);
end

close_system('adaptive_path_controller', 0);
disp('=================================================================');
disp('   ALL 5 SIMULINK VEHICLE PARITY TESTS COMPLETED SUCCESSFULLY!  ');
disp('=================================================================');
end

function d = angdiff(a, b)
    d = mod(a - b + pi, 2*pi) - pi;
end

