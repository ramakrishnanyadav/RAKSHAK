import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createAsphaltTexture,
  createEgoVehicleMesh,
  createTruckMesh,
  createCattleMesh,
  createAutoRickshawMesh,
  createPedestrianMesh,
  createTwoWheelerMesh,
  createHandcartMesh,
  createAgentMesh,
  createTreeMesh,
  createSceneryTrafficVehicle,
} from '../components/scene/proceduralModels';
import { EgoState, AgentTrack } from '../types/apath_log';

describe('Procedural 3D Models Unit Tests', () => {
  it('creates an asphalt canvas texture with repeat wrapping', () => {
    const tex = createAsphaltTexture();
    expect(tex).toBeDefined();
    expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    expect(tex.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('creates an ego vehicle mesh for P3 (teal) with wheels and headlights', () => {
    const ego: EgoState = {
      x: 0,
      y: 0,
      yaw: 0,
      v: 5.0,
      steering: 0,
      acceleration: 0,
      jerk: 0,
      length: 4.2,
      width: 1.8,
      active_state: 'FOLLOW',
    };
    const mesh = createEgoVehicleMesh(ego, true);
    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(4); // chassis, cabin, 4 wheels, headlights
  });

  it('creates an auto-rickshaw compound mesh with 3 wheels and canopy', () => {
    const auto: AgentTrack = {
      id: 'auto_1',
      class_name: 'auto_rickshaw',
      x: 20,
      y: 0,
      yaw: 0,
      v_x: 4.0,
      v_y: 0,
      length: 2.6,
      width: 1.3,
      is_occluded: false,
      prediction_hypotheses: [],
      conformal_envelope: [],
    };
    const mesh = createAutoRickshawMesh(auto);
    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(5);
  });

  it('creates a cattle compound mesh with horns and zebu hump', () => {
    const cow: AgentTrack = {
      id: 'cow_1',
      class_name: 'cattle',
      x: 30,
      y: 1.0,
      yaw: 1.57,
      v_x: 0,
      v_y: -0.5,
      length: 2.4,
      width: 1.1,
      is_occluded: false,
      prediction_hypotheses: [],
      conformal_envelope: [],
    };
    const mesh = createCattleMesh(cow);
    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(6); // torso, hump, head, horns, legs
  });

  it('routes correctly through createAgentMesh factory', () => {
    const truck: AgentTrack = {
      id: 'tr_1',
      class_name: 'truck',
      x: 50,
      y: 0,
      yaw: 0,
      v_x: 6.0,
      v_y: 0,
      length: 7.5,
      width: 2.4,
      is_occluded: false,
      prediction_hypotheses: [],
      conformal_envelope: [],
    };
    const mesh = createAgentMesh(truck);
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it('creates procedural trees for deciduous and pine scenery variants', () => {
    const decTree = createTreeMesh('deciduous', 1.0);
    expect(decTree).toBeInstanceOf(THREE.Group);
    expect(decTree.children.length).toBeGreaterThanOrEqual(3);

    const pineTree = createTreeMesh('pine', 1.0);
    expect(pineTree).toBeInstanceOf(THREE.Group);
    expect(pineTree.children.length).toBeGreaterThanOrEqual(4);
  });

  it('creates scenery traffic vehicles with headlights and taillights', () => {
    const car = createSceneryTrafficVehicle('sedan', 0x3b82f6);
    expect(car).toBeInstanceOf(THREE.Group);
    expect(car.name).toBe('scenery_traffic_vehicle');
    expect(car.children.length).toBeGreaterThanOrEqual(6);
  });
});
