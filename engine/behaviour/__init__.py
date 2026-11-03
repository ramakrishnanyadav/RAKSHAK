"""
Behaviour Logic package:
Explicit finite state machine managing FOLLOW, SLOW, YIELD, STOP, BYPASS, EMERGENCY_BRAKE.
"""

from .state_machine import BehaviourStateMachine, BehaviourDecision

__all__ = [
    "BehaviourStateMachine",
    "BehaviourDecision",
]
