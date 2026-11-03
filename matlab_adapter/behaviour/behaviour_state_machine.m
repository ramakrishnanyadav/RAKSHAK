classdef behaviour_state_machine < handle
    % BEHAVIOUR_STATE_MACHINE Explicit Tactical Decision State Machine for MATLAB/Simulink
    % Implements the 6-state behaviour logic identical to Python BehaviourStateMachine:
    % FOLLOW, SLOW, YIELD, STOP, BYPASS, EMERGENCY_BRAKE
    %
    % Smart India Hackathon 2026 - Problem SIH26037 (MathWorks)

    properties
        nominal_speed (1,1) double = 8.0
        uncertainty_mrm_threshold (1,1) double = 2.6
        ttc_emergency_s (1,1) double = 1.2

        current_state (1,1) string = "FOLLOW"
        state_dwell_time (1,1) double = 0.0
        last_transition_reason (1,1) string = "INITIALIZATION"
    end

    methods
        function obj = behaviour_state_machine(nominal_speed, uncertainty_threshold, ttc_thresh)
            if nargin >= 1, obj.nominal_speed = nominal_speed; end
            if nargin >= 2, obj.uncertainty_mrm_threshold = uncertainty_threshold; end
            if nargin >= 3, obj.ttc_emergency_s = ttc_thresh; end
        end

        function reset(obj, nominal_speed)
            if nargin >= 2, obj.nominal_speed = nominal_speed; end
            obj.current_state = "FOLLOW";
            obj.state_dwell_time = 0.0;
            obj.last_transition_reason = "RESET";
        end

        function [decision] = step(obj, ego_v, current_risk, forward_clearance, min_ttc, max_uncertainty, oncoming_threat, blocked_ahead, dt)
            obj.state_dwell_time = obj.state_dwell_time + dt;

            replan_req = false;
            trigger_reason = "NONE";
            new_state = obj.current_state;

            % 1. Evaluate State Transitions
            if min_ttc < obj.ttc_emergency_s || (forward_clearance < 3.2 && ego_v > 2.0)
                new_state = "EMERGENCY_BRAKE";
                trigger_reason = "RISK_THRESHOLD_EXCEEDED";
                replan_req = true;
            elseif max_uncertainty >= obj.uncertainty_mrm_threshold
                % Conservative Minimal-Risk Manoeuvre (MRM)
                new_state = "EMERGENCY_BRAKE";
                trigger_reason = "UNCERTAINTY_EXCEEDED_MRM";
                replan_req = true;
            elseif obj.current_state == "EMERGENCY_BRAKE"
                if min_ttc > 2.5 && forward_clearance > 8.0
                    new_state = "SLOW";
                    trigger_reason = "RISK_RESOLVED";
                    replan_req = true;
                end
            elseif oncoming_threat && forward_clearance < 25.0
                new_state = "YIELD";
                if obj.current_state ~= "YIELD"
                    replan_req = true;
                    trigger_reason = "PATH_BLOCKED";
                end
            elseif blocked_ahead && forward_clearance < 15.0
                if forward_clearance < 4.5 && ego_v < 1.0
                    new_state = "STOP";
                else
                    new_state = "BYPASS";
                end
                if obj.current_state ~= new_state
                    replan_req = true;
                    trigger_reason = "PATH_BLOCKED";
                end
            elseif current_risk > 0.35 || forward_clearance < 22.0
                new_state = "SLOW";
                if obj.current_state == "FOLLOW"
                    replan_req = true;
                    trigger_reason = "RISK_THRESHOLD_EXCEEDED";
                end
            else
                new_state = "FOLLOW";
                if (obj.current_state == "SLOW" || obj.current_state == "BYPASS" || obj.current_state == "YIELD") && obj.state_dwell_time > 1.0
                    replan_req = true;
                    trigger_reason = "PERIODIC";
                end
            end

            if new_state ~= obj.current_state
                obj.last_transition_reason = sprintf("%s -> %s (%s)", obj.current_state, new_state, trigger_reason);
                obj.current_state = new_state;
                obj.state_dwell_time = 0.0;
            end

            % 2. Setpoints
            switch obj.current_state
                case "FOLLOW"
                    target_speed = obj.nominal_speed;
                    lateral_bias = 0.0;
                case "SLOW"
                    target_speed = max(2.5, obj.nominal_speed * 0.55);
                    lateral_bias = 0.0;
                case "YIELD"
                    target_speed = max(1.0, obj.nominal_speed * 0.30);
                    lateral_bias = -1.2;
                case "BYPASS"
                    target_speed = max(3.0, obj.nominal_speed * 0.60);
                    lateral_bias = 1.3;
                case "STOP"
                    target_speed = 0.0;
                    lateral_bias = 0.0;
                case "EMERGENCY_BRAKE"
                    target_speed = 0.0;
                    lateral_bias = 0.0;
                otherwise
                    target_speed = obj.nominal_speed;
                    lateral_bias = 0.0;
            end

            decision.active_state = obj.current_state;
            decision.target_speed_m_s = target_speed;
            decision.lateral_bias_m = lateral_bias;
            decision.replan_requested = replan_req;
            decision.trigger_reason = trigger_reason;
        end
    end
end
