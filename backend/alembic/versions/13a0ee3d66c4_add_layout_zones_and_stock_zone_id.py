"""add_layout_zones_and_stock_zone_id

Revision ID: 13a0ee3d66c4
Revises: c48f21a9b3d7
Create Date: 2026-08-07 15:16:07.393262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13a0ee3d66c4'
down_revision: Union[str, Sequence[str], None] = 'c48f21a9b3d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'layout_zones',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('branch_id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('stock', sa.Column('zone_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_stock_zone_id_layout_zones', 'stock', 'layout_zones', ['zone_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_stock_zone_id_layout_zones', 'stock', type_='foreignkey')
    op.drop_column('stock', 'zone_id')
    op.drop_table('layout_zones')
