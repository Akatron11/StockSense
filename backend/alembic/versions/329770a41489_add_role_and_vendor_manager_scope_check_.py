"""add role and vendor manager scope check constraints

Revision ID: 329770a41489
Revises: 7f1c7c0d6c7c
Create Date: 2026-07-27 13:13:38.604288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '329770a41489'
down_revision: Union[str, Sequence[str], None] = '7f1c7c0d6c7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        "ck_employees_role_valid",
        "employees",
        "role IN ('cashier', 'branch_manager', 'region_manager', 'general_manager', "
        "'stock_manager', 'seller_manager', 'operations_chief', 'company_it', 'vendor_manager')",
    )
    op.create_check_constraint(
        "ck_employees_vendor_manager_scope",
        "employees",
        "(role = 'vendor_manager' AND branch_id IS NULL AND region_id IS NULL AND company_id IS NULL) "
        "OR (role != 'vendor_manager' AND company_id IS NOT NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_employees_vendor_manager_scope", "employees", type_="check")
    op.drop_constraint("ck_employees_role_valid", "employees", type_="check")
