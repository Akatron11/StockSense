"""add positivity check constraints on sale_items

Revision ID: 09376591e0a7
Revises: 69e30c4d398d
Create Date: 2026-07-21 13:13:18.775931

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09376591e0a7'
down_revision: Union[str, Sequence[str], None] = '69e30c4d398d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        "ck_sale_items_quantity_positive", "sale_items", "quantity > 0"
    )
    op.create_check_constraint(
        "ck_sale_items_line_total_non_negative", "sale_items", "line_total >= 0"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_sale_items_line_total_non_negative", "sale_items", type_="check")
    op.drop_constraint("ck_sale_items_quantity_positive", "sale_items", type_="check")
