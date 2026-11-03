"""
Multi-Object Tracker: Data association, track maintenance, and state estimation.
"""

import math
from typing import List, Dict, Any, Optional
from engine.sensors.base import RawDetection
from .track import ObjectTrack


class MultiObjectTracker:
    """
    Multi-sensor multi-object tracker:
    - Gated association matching sensor detections to active tracks
    - EKF state filtering for continuous position, velocity, and heading
    - Confidence tracking and trajectory history logging
    - Track confirmation and deletion lifecycle
    """

    def __init__(
        self,
        gating_threshold_m: float = 4.0,
        max_coast_frames: int = 4,
        min_hits_to_confirm: int = 2,
    ):
        self.gating_threshold_m = gating_threshold_m
        self.max_coast_frames = max_coast_frames
        self.min_hits_to_confirm = min_hits_to_confirm
        self.tracks: Dict[str, ObjectTrack] = {}
        self._next_track_idx = 1

    def reset(self):
        self.tracks.clear()
        self._next_track_idx = 1

    def step(self, raw_detections: List[RawDetection], dt: float) -> List[ObjectTrack]:
        """
        1. Predict active tracks forward by dt
        2. Associate raw detections to existing tracks
        3. Update matched tracks with Kalman update
        4. Spawn tentative tracks for unmatched detections
        5. Prune dead tracks that exceeded max_coast_frames
        6. Return all active tracks (confirmed or active)
        """
        # 1. Predict
        for track in self.tracks.values():
            track.predict(dt)

        # 2. Association (Greedy Nearest Neighbor with Gating)
        unmatched_detections = list(range(len(raw_detections)))
        matched_tracks = set()

        for det_idx, det in enumerate(raw_detections):
            best_track_id = None
            min_dist = float("inf")

            for t_id, track in self.tracks.items():
                if t_id in matched_tracks:
                    continue
                # Class match preference
                if track.class_name != det.class_name:
                    continue
                dist = math.hypot(det.x - track.x, det.y - track.y)
                if dist < self.gating_threshold_m and dist < min_dist:
                    min_dist = dist
                    best_track_id = t_id

            if best_track_id is not None:
                self.tracks[best_track_id].update(det)
                matched_tracks.add(best_track_id)
                if det_idx in unmatched_detections:
                    unmatched_detections.remove(det_idx)

        # 3. Spawn new tracks for unmatched detections
        for det_idx in unmatched_detections:
            det = raw_detections[det_idx]
            # Use det.agent_id if unique or generate new track ID
            t_id = det.agent_id if det.agent_id not in self.tracks else f"track_{self._next_track_idx}"
            self._next_track_idx += 1
            new_track = ObjectTrack(det, track_id=t_id)
            self.tracks[t_id] = new_track

        # 4. Prune coasting tracks
        dead_tracks = [
            t_id
            for t_id, track in self.tracks.items()
            if track.time_since_update > self.max_coast_frames
        ]
        for t_id in dead_tracks:
            del self.tracks[t_id]

        # 5. Return active confirmed tracks (or tracks with >= 1 hit within 1 frame)
        active = [
            track for track in self.tracks.values()
            if track.hits >= self.min_hits_to_confirm or track.time_since_update == 0
        ]
        return active
