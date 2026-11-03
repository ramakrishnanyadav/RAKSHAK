"""
Scenario Catalog and Variant Authoring Router.
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import ScenarioRecord
from backend.app.schemas import ScenarioDetailResponse, ScenarioVariantCreateRequest
from backend.app.core.auth_layer import (
    require_permission,
    Action,
    Role,
    AuthenticatedUser,
    log_audit_event,
)
from backend.app.core.errors import ResourceNotFoundError
from engine.scenarios.registry import SCENARIOS_CATALOG, get_seeds_for_split

SPLIT_SEEDS = {
    "tune": get_seeds_for_split("tune"),
    "validate": get_seeds_for_split("validate"),
    "frozen_test": get_seeds_for_split("frozen_test"),
}

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=List[ScenarioDetailResponse])
def list_scenarios(
    include_variants: bool = True,
    user: AuthenticatedUser = Depends(require_permission(Action.READ_SCENARIO)),
    db: Session = Depends(get_db),
):
    """List standard catalog scenarios and custom authoring variants."""
    results: List[ScenarioDetailResponse] = []

    # 1. Standard catalog scenarios
    for sc_id, cfg in SCENARIOS_CATALOG.items():
        results.append(
            ScenarioDetailResponse(
                id=sc_id,
                name=cfg.name,
                description=cfg.description,
                target_distance_m=cfg.target_distance_m,
                timeout_s=cfg.timeout_s,
                nominal_speed_m_s=cfg.nominal_speed_m_s,
                splits=SPLIT_SEEDS,
                is_variant=False,
                base_scenario_id=None,
            )
        )

    # 2. Custom authoring variants from DB
    if include_variants:
        variants = db.query(ScenarioRecord).filter(ScenarioRecord.is_variant == True).all()
        for v in variants:
            results.append(
                ScenarioDetailResponse(
                    id=v.id,
                    name=v.name,
                    description=v.description,
                    target_distance_m=v.config_json.get("target_distance_m", 100.0),
                    timeout_s=v.config_json.get("timeout_s", 20.0),
                    nominal_speed_m_s=v.config_json.get("nominal_speed_m_s", 10.0),
                    splits=SPLIT_SEEDS,
                    is_variant=True,
                    base_scenario_id=v.base_scenario_id,
                )
            )

    return results


@router.get("/{scenario_id}", response_model=ScenarioDetailResponse)
def get_scenario(
    scenario_id: str,
    user: AuthenticatedUser = Depends(require_permission(Action.READ_SCENARIO)),
    db: Session = Depends(get_db),
):
    """Retrieve detailed scenario metadata and split configurations."""
    if scenario_id in SCENARIOS_CATALOG:
        cfg = SCENARIOS_CATALOG[scenario_id]
        return ScenarioDetailResponse(
            id=scenario_id,
            name=cfg.name,
            description=cfg.description,
            target_distance_m=cfg.target_distance_m,
            timeout_s=cfg.timeout_s,
            nominal_speed_m_s=cfg.nominal_speed_m_s,
            splits=SPLIT_SEEDS,
            is_variant=False,
            base_scenario_id=None,
        )

    variant = db.query(ScenarioRecord).filter(ScenarioRecord.id == scenario_id).first()
    if variant:
        return ScenarioDetailResponse(
            id=variant.id,
            name=variant.name,
            description=variant.description,
            target_distance_m=variant.config_json.get("target_distance_m", 100.0),
            timeout_s=variant.config_json.get("timeout_s", 20.0),
            nominal_speed_m_s=variant.config_json.get("nominal_speed_m_s", 10.0),
            splits=SPLIT_SEEDS,
            is_variant=True,
            base_scenario_id=variant.base_scenario_id,
        )

    raise ResourceNotFoundError(f"Scenario '{scenario_id}' not found.")


@router.post("/variants", response_model=ScenarioDetailResponse, status_code=status.HTTP_201_CREATED)
def create_scenario_variant(
    req: ScenarioVariantCreateRequest,
    user: AuthenticatedUser = Depends(require_permission(Action.CREATE_SCENARIO_VARIANT)),
    db: Session = Depends(get_db),
):
    """Create a new scenario variant (designer / admin only)."""
    if req.base_scenario_id not in SCENARIOS_CATALOG:
        raise ResourceNotFoundError(f"Base scenario '{req.base_scenario_id}' not found.")

    variant_id = f"var_{req.base_scenario_id.lower()}_{uuid.uuid4().hex[:6]}"
    base_cfg = SCENARIOS_CATALOG[req.base_scenario_id]

    variant_rec = ScenarioRecord(
        id=variant_id,
        name=req.name,
        description=req.description,
        is_variant=True,
        base_scenario_id=req.base_scenario_id,
        config_json=req.config_overrides,
        created_by=user.id,
    )
    db.add(variant_rec)
    db.commit()

    log_audit_event(
        db,
        user_id=user.id,
        action="scenario.create_variant",
        resource_type="scenario",
        resource_id=variant_id,
        details={"name": req.name, "base": req.base_scenario_id},
    )

    return ScenarioDetailResponse(
        id=variant_id,
        name=req.name,
        description=req.description,
        target_distance_m=req.config_overrides.get("target_distance_m", base_cfg.target_distance_m),
        timeout_s=req.config_overrides.get("timeout_s", base_cfg.timeout_s),
        nominal_speed_m_s=req.config_overrides.get("nominal_speed_m_s", base_cfg.nominal_speed_m_s),
        splits=SPLIT_SEEDS,
        is_variant=True,
        base_scenario_id=req.base_scenario_id,
    )


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_scenario_xml(
    payload: dict,
    user: AuthenticatedUser = Depends(require_permission(Action.CREATE_SCENARIO_VARIANT)),
    db: Session = Depends(get_db),
):
    """
    Secure import of OpenDRIVE / OpenSCENARIO XML documents.
    Enforces OWASP ASVS L2 XML hardening against XXE and recursive expansion.
    """
    from backend.app.core.xml_security import safe_parse_xml
    from backend.app.core.errors import ValidationException

    xml_text = payload.get("xml_content", "")
    if not xml_text:
        raise ValidationException("Field 'xml_content' cannot be empty.")

    try:
        root = safe_parse_xml(xml_text)
    except ValueError as e:
        raise ValidationException(f"XML Security Rejection: {str(e)}")

    scenario_name = payload.get("name") or root.attrib.get("name") or "Imported XML Scenario"
    scenario_id = f"imported_{uuid.uuid4().hex[:8]}"

    rec = ScenarioRecord(
        id=scenario_id,
        name=scenario_name,
        description=f"Imported from {root.tag} format",
        is_variant=True,
        base_scenario_id="SCENARIO_1_VILLAGE_ROAD",
        config_json={"imported_tag": root.tag, "attribs": dict(root.attrib)},
        created_by=user.id,
    )
    db.add(rec)
    db.commit()

    return {"id": scenario_id, "name": scenario_name, "root_tag": root.tag, "status": "imported"}

