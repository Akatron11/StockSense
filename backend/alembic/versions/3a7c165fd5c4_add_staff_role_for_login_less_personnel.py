"""add staff role for login-less personnel

Revision ID: 3a7c165fd5c4
Revises: 4f863d87c1d2
Create Date: 2026-07-31 14:19:26.102180

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a7c165fd5c4'
down_revision: Union[str, Sequence[str], None] = '4f863d87c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("ck_employees_role_valid", "employees", type_="check")
    op.create_check_constraint(
        "ck_employees_role_valid",
        "employees",
        "role IN ('cashier', 'branch_manager', 'region_manager', 'general_manager', "
        "'stock_manager', 'seller_manager', 'operations_chief', 'company_it', 'vendor_manager', 'staff')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_employees_role_valid", "employees", type_="check")
    op.create_check_constraint(
        "ck_employees_role_valid",
        "employees",
        "role IN ('cashier', 'branch_manager', 'region_manager', 'general_manager', "
        "'stock_manager', 'seller_manager', 'operations_chief', 'company_it', 'vendor_manager')",
    )
